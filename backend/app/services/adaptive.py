"""Rule-based, explainable adaptive training logic.

Deterministic functions of stored session history. No ML, no randomness
(docs/modules/aar_and_adaptive_training.md §4, §6). Aggregation and
recommendation are pure so they are unit-testable without HTTP.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.aar import PerformanceProfile, RecommendResponse
from app.schemas.scenario import Environment, TimeOfDay
from app.services.scoring import CLASSIFICATION_MAX, DETECTION_MAX, RESPONSE_MAX

IMPROVE_THRESHOLD = 90.0
DECLINE_THRESHOLD = 60.0
CONDITION_GAP = 15.0
LEVEL_MIN = 1
LEVEL_MAX = 10
MULTI_THREAT_MIN = 2
MULTI_THREAT_TARGET = 3


@dataclass(frozen=True)
class SessionSummary:
    final_score: float
    detection_score: float
    classification_score: float
    response_score: float
    environment: str
    time_of_day: str
    visibility: str
    threat_count: int
    average_reaction_ms: float | None


@dataclass(frozen=True)
class RecommendInput:
    recent_final_scores: list[float]
    overall_score: float | None
    night_score: float | None
    multi_threat_score: float | None
    last_environment: str
    last_time_of_day: str
    last_threat_count: int
    current_level: int


def mean(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def decide_difficulty_delta(recent_final_scores: list[float]) -> int:
    if len(recent_final_scores) >= 3 and all(
        score >= IMPROVE_THRESHOLD for score in recent_final_scores[-3:]
    ):
        return 1
    if len(recent_final_scores) >= 2 and all(
        score < DECLINE_THRESHOLD for score in recent_final_scores[-2:]
    ):
        return -1
    return 0


def clamp_level(level: int) -> int:
    return max(LEVEL_MIN, min(LEVEL_MAX, level))


def _accuracy(sessions: list[SessionSummary], attr: str, maximum: int) -> float:
    total = sum((getattr(session, attr) / maximum) * 100 for session in sessions)
    return round(total / len(sessions), 2)


def aggregate_performance(
    trainee_id: str, sessions: list[SessionSummary], current_level: int = 1
) -> PerformanceProfile:
    if not sessions:
        return PerformanceProfile(
            trainee_id=trainee_id, session_count=0, detection_accuracy=0.0,
            classification_accuracy=0.0, response_accuracy=0.0,
            current_level=clamp_level(current_level),
        )
    return PerformanceProfile(
        trainee_id=trainee_id,
        session_count=len(sessions),
        detection_accuracy=_accuracy(sessions, "detection_score", DETECTION_MAX),
        classification_accuracy=_accuracy(sessions, "classification_score", CLASSIFICATION_MAX),
        response_accuracy=_accuracy(sessions, "response_score", RESPONSE_MAX),
        average_reaction_time_ms=mean(
            [s.average_reaction_ms for s in sessions if s.average_reaction_ms is not None]
        ),
        day_score=mean([s.final_score for s in sessions if s.time_of_day == "day"]),
        night_score=mean([s.final_score for s in sessions if s.time_of_day == "night"]),
        multi_threat_score=mean(
            [s.final_score for s in sessions if s.threat_count >= MULTI_THREAT_MIN]
        ),
        low_visibility_score=mean(
            [s.final_score for s in sessions if s.visibility != "clear"]
        ),
        current_level=clamp_level(current_level),
    )


def build_recommendation(data: RecommendInput) -> RecommendResponse:
    overall = data.overall_score
    environment = Environment(data.last_environment)

    night_weak = (
        data.night_score is not None
        and overall is not None
        and (overall - data.night_score) > CONDITION_GAP
    )
    multi_weak = (
        data.multi_threat_score is not None
        and overall is not None
        and (overall - data.multi_threat_score) > CONDITION_GAP
    )

    if night_weak:
        level = clamp_level(data.current_level)
        gap = overall - data.night_score  # type: ignore[operator]
        return RecommendResponse(
            recommended_difficulty=level,
            environment=environment,
            time_of_day=TimeOfDay.night,
            threat_count=data.last_threat_count,
            reason=(
                f"Night score {data.night_score:.1f} is {gap:.1f} points below overall "
                f"{overall:.1f}; keeping difficulty at {level} and adding night repetitions."
            ),
        )

    if multi_weak:
        level = clamp_level(data.current_level)
        gap = overall - data.multi_threat_score  # type: ignore[operator]
        threat_count = (
            MULTI_THREAT_TARGET
            if data.last_threat_count < MULTI_THREAT_TARGET
            else data.last_threat_count
        )
        return RecommendResponse(
            recommended_difficulty=level,
            environment=environment,
            time_of_day=TimeOfDay(data.last_time_of_day),
            threat_count=threat_count,  # type: ignore[arg-type]
            reason=(
                f"Multi-threat score {data.multi_threat_score:.1f} is {gap:.1f} points below "
                f"overall {overall:.1f}; recommending a {threat_count}-threat scenario at "
                f"difficulty {level}."
            ),
        )

    delta = decide_difficulty_delta(data.recent_final_scores)
    level = clamp_level(data.current_level + delta)
    recent_mean = mean(data.recent_final_scores)
    if delta > 0:
        reason = (
            f"Last 3 sessions averaged {recent_mean:.1f} (>= {IMPROVE_THRESHOLD:.0f}); "
            f"increasing difficulty from {data.current_level} to {level}."
        )
    elif delta < 0:
        reason = (
            f"Last 2 sessions averaged {recent_mean:.1f} (< {DECLINE_THRESHOLD:.0f}); "
            f"decreasing difficulty from {data.current_level} to {level}."
        )
    elif overall is None:
        reason = f"No completed sessions yet; starting at difficulty {level}."
    else:
        reason = (
            f"Recent sessions averaged {recent_mean:.1f} (60-89); maintaining difficulty "
            f"at {level}."
        )
    return RecommendResponse(
        recommended_difficulty=level,
        environment=environment,
        time_of_day=TimeOfDay(data.last_time_of_day),
        threat_count=data.last_threat_count,  # type: ignore[arg-type]
        reason=reason,
    )
