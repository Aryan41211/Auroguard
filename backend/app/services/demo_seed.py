"""Deterministic demo-data seeder for the instructor dashboard.

Generates a reproducible population of completed training sessions so the
dashboard has meaningful history and trends. Determinism is binding: all
randomness flows through a single ``random.Random(base_seed)`` and every
scenario gets a unique, seed-derived id (no wall-clock influence on the
scores).

Design (docs/plans/phase-6-dashboard-instructor.md, Task 3):
- Six trainees with differentiated skill profiles (baseline accuracy,
  latency, false-alarm rate, night / multi-threat / visibility / sensor
  penalties) so trends and the weakness heatmap vary meaningfully.
- Per session: pick conditions from the RNG, re-roll difficulty until
  ``generate_scenario`` accepts it, validate, persist the ``ScenarioRow``.
- Then drive the *real* route functions (``create_session``,
  ``submit_event``, ``complete_session``) with the same db session, so
  scoring and business logic are exercised rather than hand-computed.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.sessions import complete_session, create_session, submit_event
from app.db.models import ScenarioRow, SessionRow
from app.schemas.events import EventCreateRequest, EventType
from app.schemas.scenario import (
    ClassificationLabel,
    Environment,
    ExpectedResponse,
    Scenario,
    ScenarioGenerateRequest,
    TimeOfDay,
)
from app.schemas.session import SessionCreateRequest
from app.services.scenario_generator import (
    BASE_DIFFICULTY,
    ENVIRONMENT_FACTOR,
    THREAT_COUNT_FACTOR,
    TIME_FACTOR,
    InfeasibleScenarioError,
    generate_scenario,
)
from app.services.scenario_validator import validate_scenario

DEFAULT_SESSIONS = 50
DEFAULT_BASE_SEED = 20260101

_MAX_DIFFICULTY_ATTEMPTS = 64
_MIN_PROBABILITY = 0.05
_MAX_PROBABILITY = 0.99
_NO_RESPONSE_PROBABILITY = 0.10

_ENVIRONMENTS: tuple[Environment, ...] = (Environment.urban, Environment.rural)
_TIMES_OF_DAY: tuple[TimeOfDay, ...] = (TimeOfDay.day, TimeOfDay.night)
_THREAT_COUNTS: tuple[int, ...] = (1, 2, 3, 5)
_LABELS: tuple[ClassificationLabel, ...] = tuple(ClassificationLabel)
_RESPONSES: tuple[ExpectedResponse, ...] = tuple(ExpectedResponse)


@dataclass(frozen=True)
class SkillProfile:
    """Differentiated trainee behaviour; all probabilities are baselines."""

    trainee_id: str
    detection: float
    classification: float
    response: float
    latency_mean_ms: float
    latency_sd_ms: float
    false_alarm_rate: float
    night_penalty: float
    multi_threat_penalty: float
    visibility_penalty: float
    sensor_penalty: float


PROFILES: tuple[SkillProfile, ...] = (
    SkillProfile(
        trainee_id="TRAIN-001",
        detection=0.72,
        classification=0.65,
        response=0.62,
        latency_mean_ms=5200.0,
        latency_sd_ms=900.0,
        false_alarm_rate=0.55,
        night_penalty=0.15,
        multi_threat_penalty=0.12,
        visibility_penalty=0.10,
        sensor_penalty=0.10,
    ),
    SkillProfile(
        trainee_id="TRAIN-002",
        detection=0.88,
        classification=0.82,
        response=0.80,
        latency_mean_ms=3400.0,
        latency_sd_ms=600.0,
        false_alarm_rate=0.25,
        night_penalty=0.06,
        multi_threat_penalty=0.08,
        visibility_penalty=0.06,
        sensor_penalty=0.06,
    ),
    SkillProfile(
        trainee_id="TRAIN-003",
        detection=0.92,
        classification=0.88,
        response=0.86,
        latency_mean_ms=2900.0,
        latency_sd_ms=500.0,
        false_alarm_rate=0.15,
        night_penalty=0.30,
        multi_threat_penalty=0.06,
        visibility_penalty=0.08,
        sensor_penalty=0.05,
    ),
    SkillProfile(
        trainee_id="TRAIN-004",
        detection=0.90,
        classification=0.85,
        response=0.83,
        latency_mean_ms=3100.0,
        latency_sd_ms=550.0,
        false_alarm_rate=0.20,
        night_penalty=0.06,
        multi_threat_penalty=0.30,
        visibility_penalty=0.07,
        sensor_penalty=0.06,
    ),
    SkillProfile(
        trainee_id="TRAIN-005",
        detection=0.97,
        classification=0.94,
        response=0.93,
        latency_mean_ms=1700.0,
        latency_sd_ms=300.0,
        false_alarm_rate=0.08,
        night_penalty=0.03,
        multi_threat_penalty=0.05,
        visibility_penalty=0.03,
        sensor_penalty=0.03,
    ),
    SkillProfile(
        trainee_id="TRAIN-006",
        detection=0.93,
        classification=0.70,
        response=0.66,
        latency_mean_ms=4200.0,
        latency_sd_ms=1500.0,
        false_alarm_rate=0.45,
        night_penalty=0.10,
        multi_threat_penalty=0.12,
        visibility_penalty=0.12,
        sensor_penalty=0.12,
    ),
)


@dataclass(frozen=True)
class SeedSummary:
    """Deterministic result of a seeding run (no wall-clock fields)."""

    sessions_requested: int
    sessions_completed: int
    trainee_ids: tuple[str, ...]
    scenario_ids: tuple[str, ...]
    final_scores: tuple[float, ...]
    per_trainee_counts: tuple[tuple[str, int], ...]


def _clamp_probability(value: float) -> float:
    return max(_MIN_PROBABILITY, min(_MAX_PROBABILITY, value))


def _effective_probabilities(
    profile: SkillProfile, scenario: Scenario
) -> tuple[float, float, float]:
    """Baseline detection/classification/response adjusted for conditions."""
    penalty = 0.0
    if scenario.time_of_day is TimeOfDay.night:
        penalty += profile.night_penalty
    if len(scenario.threats) >= 2:
        penalty += profile.multi_threat_penalty
    if scenario.visibility.value == "poor":
        penalty += profile.visibility_penalty * 2.0
    elif scenario.visibility.value == "reduced":
        penalty += profile.visibility_penalty
    if scenario.sensor_quality < 0.4:
        penalty += profile.sensor_penalty
    elif scenario.sensor_quality < 0.7:
        penalty += profile.sensor_penalty * 0.5
    return (
        _clamp_probability(profile.detection - penalty),
        _clamp_probability(profile.classification - penalty),
        _clamp_probability(profile.response - penalty),
    )


def _pick_scenario(rng, base_seed: int, index: int) -> Scenario:
    """Pick conditions and re-roll difficulty until the generator accepts."""
    environment = rng.choice(_ENVIRONMENTS)
    time_of_day = rng.choice(_TIMES_OF_DAY)
    threat_count = rng.choice(_THREAT_COUNTS)
    seed = base_seed + index

    for _ in range(_MAX_DIFFICULTY_ATTEMPTS):
        request = ScenarioGenerateRequest(
            difficulty=rng.randint(1, 10),
            environment=environment,
            time_of_day=time_of_day,
            threat_count=threat_count,
            seed=seed,
        )
        try:
            return generate_scenario(request, seed)
        except InfeasibleScenarioError:
            continue

    fixed = (
        BASE_DIFFICULTY
        + THREAT_COUNT_FACTOR[threat_count]
        + ENVIRONMENT_FACTOR[environment]
        + TIME_FACTOR[time_of_day]
    )
    difficulty = max(1, min(10, fixed))
    fallback = ScenarioGenerateRequest(
        difficulty=difficulty,
        environment=environment,
        time_of_day=time_of_day,
        threat_count=threat_count,
        seed=seed,
    )
    return generate_scenario(fallback, seed)


def _persist_scenario(db: Session, scenario: Scenario) -> None:
    if db.get(ScenarioRow, scenario.scenario_id) is not None:
        return
    db.add(ScenarioRow.from_schema(scenario))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def _emit(
    db: Session,
    session_id: str,
    event_type: EventType,
    timestamp_ms: int,
    threat_id: str | None = None,
    payload: dict | None = None,
) -> None:
    submit_event(
        session_id=session_id,
        body=EventCreateRequest(
            type=event_type,
            timestamp_ms=timestamp_ms,
            threat_id=threat_id,
            payload=payload or {},
        ),
        db=db,
    )


def _run_session(db: Session, rng, profile: SkillProfile, scenario: Scenario) -> str:
    """Drive the real routes for one session and return its id."""
    created = create_session(
        body=SessionCreateRequest(
            trainee_id=profile.trainee_id, scenario_id=scenario.scenario_id
        ),
        db=db,
    )
    session_id = created.session_id

    p_detect, p_class, p_response = _effective_probabilities(profile, scenario)

    clock = 0
    _emit(db, session_id, EventType.SESSION_STARTED, clock)
    _emit(db, session_id, EventType.SCENARIO_LOADED, clock)

    for threat in scenario.threats:
        clock += rng.randint(500, 2000)
        if rng.random() >= p_detect:
            continue

        detect_at = clock
        _emit(db, session_id, EventType.THREAT_DETECTED, detect_at, threat.id)

        latency = max(150, round(rng.gauss(profile.latency_mean_ms, profile.latency_sd_ms)))
        class_delta = max(50, round(latency * 0.4))
        response_delta = max(50, latency - class_delta)
        class_at = detect_at + class_delta

        if rng.random() < p_class:
            label = threat.classification_label
        else:
            alternatives = [item for item in _LABELS if item is not threat.classification_label]
            label = rng.choice(alternatives)
        _emit(
            db,
            session_id,
            EventType.CLASSIFICATION_SUBMITTED,
            class_at,
            threat.id,
            {"label": label.value},
        )

        response_at = class_at
        if rng.random() >= _NO_RESPONSE_PROBABILITY:
            response_at = class_at + response_delta
            if rng.random() < p_response:
                response_value = threat.expected_response
            else:
                alternatives = [
                    item for item in _RESPONSES if item is not threat.expected_response
                ]
                response_value = rng.choice(alternatives)
            _emit(
                db,
                session_id,
                EventType.RESPONSE_SUBMITTED,
                response_at,
                threat.id,
                {"response": response_value.value},
            )
        clock = response_at

    if rng.random() < profile.false_alarm_rate:
        clock += rng.randint(200, 800)
        _emit(db, session_id, EventType.FALSE_ALARM, clock)

    clock += rng.randint(200, 1000)
    _emit(db, session_id, EventType.SESSION_COMPLETED, clock)

    complete_session(session_id=session_id, db=db)
    return session_id


def seed_demo_data(
    db: Session, *, sessions: int = DEFAULT_SESSIONS, base_seed: int = DEFAULT_BASE_SEED
) -> SeedSummary:
    """Seed ``sessions`` deterministic completed sessions into ``db``."""
    if sessions < 0:
        raise ValueError("sessions must be >= 0")

    rng = random.Random(base_seed)
    scenario_ids: list[str] = []
    final_scores: list[float] = []
    counts: dict[str, int] = {}

    for index in range(sessions):
        profile = PROFILES[index % len(PROFILES)]
        scenario = _pick_scenario(rng, base_seed, index)
        validate_scenario(scenario)
        _persist_scenario(db, scenario)
        session_id = _run_session(db, rng, profile, scenario)

        scenario_ids.append(scenario.scenario_id)
        counts[profile.trainee_id] = counts.get(profile.trainee_id, 0) + 1
        row = db.get(SessionRow, session_id)
        if row is not None and row.final_score is not None:
            final_scores.append(row.final_score)

    trainee_ids = tuple(sorted(counts))
    per_trainee_counts = tuple((tid, counts[tid]) for tid in trainee_ids)
    return SeedSummary(
        sessions_requested=sessions,
        sessions_completed=len(final_scores),
        trainee_ids=trainee_ids,
        scenario_ids=tuple(scenario_ids),
        final_scores=tuple(final_scores),
        per_trainee_counts=per_trainee_counts,
    )
