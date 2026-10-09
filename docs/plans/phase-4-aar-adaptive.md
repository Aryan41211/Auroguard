# Phase 4 — AAR + Adaptive Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a completed, scored session into an explainable After Action Review and an evidence-based adaptive recommendation, exposed over the three Phase 4 routes already frozen in the contract.

**Architecture:** Two pure services — `services/aar.py` (facts: timing, mistakes, timeline, strengths/weaknesses) and `services/adaptive.py` (historical aggregation + rule-based recommendation) — sit behind thin routers (`api/aar.py`, `api/training.py`), exactly like the existing `scoring.py`. AAR free text (`summary`, `recommendation`) is produced by an injected `Narrator`: a deterministic `TemplateNarrator` (default, offline) or an optional OpenAI-compatible `LlmNarrator` that falls back to the template on any error. Aggregates are recomputed from persisted sessions/scores/events on each request.

**Tech Stack:** Python 3.12 · FastAPI 0.143 · Pydantic 2.14 · SQLAlchemy 2.1 · SQLite · pytest 9 · httpx (already a dependency via TestClient)

**Spec:** `docs/modules/aar_and_adaptive_training.md`, `docs/api/api_specification.md` (§6–8), `docs/api/openapi.yaml` (frozen contract: `AAR`, `TimingMetrics`, `Mistake`, `PerformanceProfile`, `RecommendRequest`, `RecommendResponse`), `docs/modules/event_and_data_model.md` (§7), `docs/guides/testing_validation.md` (§4 AAR, §5 adaptive), `docs/project-management/demo_validation.md` (5 validation questions)

## Global Constraints

- **API base:** `/api/v1`, `application/json`; validate every request; reject unknown enum values; return meaningful status codes (`docs/api/api_specification.md §9`).
- **Contract is binding:** every implemented route and response shape already exists in `docs/api/openapi.yaml`; `tests/test_contract.py` must stay green (it already lists all three paths and all six schemas). Do not modify the contract.
- **Authority split:** the server is the sole authority for scores, AAR, and recommendations; the client is untouched this phase.
- **Determinism:** `build_aar_facts`, `aggregate_performance`, `build_recommendation`, and `TemplateNarrator` are pure and deterministic. Tests must not hit the network — the LLM narrator is mocked.
- **Offline-first (user decision, 2026-10-09):** the LLM narrator is OPTIONAL. Unset by default; when unset the deterministic template is used. The LLM backend is provider-agnostic (any OpenAI-compatible `/chat/completions` endpoint, local or remote), configured purely by env vars.
- **Scoring values (verbatim, reuse from `scoring.py`):** `DETECTION_MAX=30`, `CLASSIFICATION_MAX=30`, `RESPONSE_MAX=25`, timing max `15`; `scoring_version = 1`.
- **Git:** direct commits to `main`, Conventional Commits, commit after every task, push at phase end (`docs/project-management/git_workflow.md`).
- **Quality gate:** `pytest` green (pristine, no warnings) + `git status` clean before any phase-complete claim.
- **No new dependencies:** `httpx` is already installed (FastAPI TestClient depends on it). Do not add or upgrade packages.

### Locked design decisions (agreed with the user, 2026-10-09)

1. **AAR text source = LLM, provider-agnostic with deterministic fallback.** `services/aar_narrator.py` defines `Narrator` (Protocol), `TemplateNarrator` (default), `LlmNarrator` (env-configured, timeout-guarded), and `get_narrator()`. Only the AAR `summary` and `recommendation` are narrated; every metric stays computed in code. The adaptive `reason` is deterministic and metric-cited (it must "explain why it changed" with numbers).
2. **Level tracking = persisted.** `PerformanceProfileRow.current_level` is stored; `/training/recommend` advances it and saves it, so recommendations build on history. `/performance` persists the recomputed aggregates too.
3. **Aggregates recomputed on GET** from persisted data (pure `aggregate_performance`), never maintained incrementally.
4. **Adaptive rule (verbatim from `aar_and_adaptive_training.md §4`, §6):** `last 3 ≥ 90 ⇒ +1`; `last 2 < 60 ⇒ −1`; else hold; clamp 1–10. Condition bias: if `night_score < overall − 15` recommend `time_of_day = night`; elif `multi_threat_score < overall − 15` recommend `threat_count = 3` (only one dimension changes at a time — no over-adaptation).

### Timing metric definitions (locked)

Per threat, using `spawn_ms = round(spawn_time × 1000)` and event `timestamp_ms`:
- `mean_time_to_detection_ms` = mean of `max(0, THREAT_DETECTED.ms − spawn_ms)` over detected threats
- `mean_detection_to_classification_ms` = mean of `max(0, CLASSIFICATION.ms − DETECTION.ms)` over detected+classified threats
- `mean_classification_to_response_ms` = mean of `max(0, RESPONSE.ms − CLASSIFICATION.ms)` over classified+responded threats
- `mean_total_decision_ms` = mean of `max(0, RESPONSE.ms − DETECTION.ms)` over detected+responded threats
- Each is `round(x, 2)`; `None` when there are no samples.

### Mistake definitions (locked)

- `missed_threat` — threat with no `THREAT_DETECTED` (timestamp = `spawn_ms`).
- `false_alarm` — every `FALSE_ALARM` event (timestamp = event ms).
- `classification_error` — detected threat whose first `CLASSIFICATION_SUBMITTED` is missing or has `payload.label != classification_label` (timestamp = classification ms if present, else detection ms).
- `response_error` — correctly-classified threat whose first `RESPONSE_SUBMITTED` is missing or has `payload.response != expected_response` (timestamp = response ms if present, else classification ms).
- Mistakes sorted by `(timestamp_ms, threat_id or "")`.

---

## File Structure

```text
backend/
  app/config.py                  (mod)  add AEROGUARD_LLM_* settings
  app/schemas/aar.py             (new)  MistakeKind, Mistake, TimingMetrics, AAR, PerformanceProfile, RecommendRequest, RecommendResponse
  app/services/aar.py            (new)  AarFacts + build_aar_facts + build_aar (pure)
  app/services/aar_narrator.py   (new)  Narrator protocol, TemplateNarrator, LlmNarrator, get_narrator
  app/services/adaptive.py       (new)  SessionSummary, RecommendInput, mean, decide_difficulty_delta, clamp_level, aggregate_performance, build_recommendation
  app/api/aar.py                 (new)  GET /sessions/{session_id}/aar
  app/api/training.py            (new)  GET /trainees/{trainee_id}/performance, POST /training/recommend
  app/main.py                    (mod)  mount aar + training routers
  .env.example                   (new)  document env vars (incl. optional LLM)
  tests/test_aar_schemas.py      (new)  Task 1
  tests/test_aar_service.py      (new)  Task 2
  tests/test_aar_narrator.py     (new)  Task 3
  tests/test_aar_api.py          (new)  Task 4
  tests/test_adaptive.py         (new)  Task 5
  tests/test_training_api.py     (new)  Task 6
  tests/test_phase4_validation.py(new)  Task 7
```

Each router owns one resource; services hold pure logic; schemas mirror the contract. Run all tests from `backend/` as `.venv/Scripts/python -m pytest tests -q`.

---

### Task 1: AAR / adaptive schemas + LLM config

**Files:**
- Create: `backend/app/schemas/aar.py`
- Modify: `backend/app/config.py`
- Create: `backend/.env.example`
- Create: `backend/tests/test_aar_schemas.py`

**Interfaces:**
- Consumes: `app.schemas.scenario.{Environment, TimeOfDay, ThreatCount}`, `app.schemas.scoring.ScoreResult`, `app.schemas.events.EventCreateRequest`.
- Produces:
  - `app.schemas.aar.MistakeKind` (str Enum: `missed_threat`, `false_alarm`, `classification_error`, `response_error`)
  - `app.schemas.aar.Mistake` (`kind: MistakeKind`, `timestamp_ms: int`, `threat_id: str | None = None`, `detail: str | None = None`)
  - `app.schemas.aar.TimingMetrics` (four `float | None` fields, default `None`)
  - `app.schemas.aar.AAR` (`session_id`, `scenario_id`, `summary`, `scores: ScoreResult`, `timing: TimingMetrics`, `mistakes: list[Mistake]`, `strengths: list[str]`, `weaknesses: list[str]`, `recommendation`, `timeline: list[EventCreateRequest]`)
  - `app.schemas.aar.PerformanceProfile` (`trainee_id`, `session_count`, `detection_accuracy`/`classification_accuracy`/`response_accuracy` 0–100, optional `average_reaction_time_ms`/`night_score`/`day_score`/`multi_threat_score`/`low_visibility_score`, `current_level` 1–10 default 1)
  - `app.schemas.aar.RecommendRequest` (`trainee_id: str`)
  - `app.schemas.aar.RecommendResponse` (`recommended_difficulty` 1–10, `environment: Environment`, `time_of_day: TimeOfDay`, `threat_count: ThreatCount`, `reason: str`)
  - `app.config.LLM_BASE_URL: str | None`, `LLM_API_KEY: str | None`, `LLM_MODEL: str | None`, `LLM_TIMEOUT_S: float`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_aar_schemas.py`

```python
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.aar import (
    AAR,
    Mistake,
    MistakeKind,
    PerformanceProfile,
    RecommendRequest,
    RecommendResponse,
    TimingMetrics,
)
from app.schemas.events import EventCreateRequest
from app.schemas.scoring import ScoreResult


def _score() -> ScoreResult:
    return ScoreResult(
        session_id="SES-0001", detection_score=30.0, classification_score=30.0,
        response_score=25.0, timing_score=15.0, penalty=0.0, final_score=100.0,
        scoring_version=1,
    )


def test_mistake_kind_matches_contract() -> None:
    assert {m.value for m in MistakeKind} == {
        "missed_threat", "false_alarm", "classification_error", "response_error",
    }


def test_aar_allows_empty_collections_and_none_timing() -> None:
    aar = AAR(
        session_id="SES-0001", scenario_id="SCN-000001", summary="s",
        scores=_score(), timing=TimingMetrics(), mistakes=[], strengths=[],
        weaknesses=[], recommendation="r",
        timeline=[EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=1, threat_id="T01")],
    )
    assert aar.timing.mean_total_decision_ms is None
    assert aar.timeline[0].type.value == "THREAT_DETECTED"


def test_mistake_requires_kind_and_timestamp() -> None:
    with pytest.raises(ValidationError):
        Mistake(kind="not_a_kind", timestamp_ms=0)


def test_performance_profile_defaults_and_bounds() -> None:
    profile = PerformanceProfile(
        trainee_id="TRAIN-001", session_count=2,
        detection_accuracy=50.0, classification_accuracy=50.0, response_accuracy=50.0,
    )
    assert profile.current_level == 1
    assert profile.night_score is None
    with pytest.raises(ValidationError):
        PerformanceProfile(
            trainee_id="T", session_count=1,
            detection_accuracy=101.0, classification_accuracy=0.0, response_accuracy=0.0,
        )


def test_recommend_models() -> None:
    assert RecommendRequest(trainee_id="TRAIN-001").trainee_id == "TRAIN-001"
    response = RecommendResponse(
        recommended_difficulty=6, environment="urban", time_of_day="night",
        threat_count=3, reason="why",
    )
    assert response.environment.value == "urban"
    with pytest.raises(ValidationError):
        RecommendResponse(
            recommended_difficulty=11, environment="urban", time_of_day="night",
            threat_count=3, reason="why",
        )
    with pytest.raises(ValidationError):
        RecommendResponse(
            recommended_difficulty=5, environment="urban", time_of_day="night",
            threat_count=4, reason="why",
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_aar_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.aar'`

- [ ] **Step 3: Implement** — `backend/app/schemas/aar.py`

```python
"""Pydantic models mirroring the frozen v1 AAR / performance / recommend contract.

Source of truth: docs/api/openapi.yaml (AAR, TimingMetrics, Mistake,
PerformanceProfile, RecommendRequest, RecommendResponse).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.events import EventCreateRequest
from app.schemas.scenario import Environment, ThreatCount, TimeOfDay
from app.schemas.scoring import ScoreResult


class MistakeKind(str, Enum):
    missed_threat = "missed_threat"
    false_alarm = "false_alarm"
    classification_error = "classification_error"
    response_error = "response_error"


class Mistake(BaseModel):
    kind: MistakeKind
    timestamp_ms: int
    threat_id: str | None = None
    detail: str | None = None


class TimingMetrics(BaseModel):
    mean_time_to_detection_ms: float | None = None
    mean_detection_to_classification_ms: float | None = None
    mean_classification_to_response_ms: float | None = None
    mean_total_decision_ms: float | None = None


class AAR(BaseModel):
    session_id: str
    scenario_id: str
    summary: str
    scores: ScoreResult
    timing: TimingMetrics
    mistakes: list[Mistake]
    strengths: list[str]
    weaknesses: list[str]
    recommendation: str
    timeline: list[EventCreateRequest]


class PerformanceProfile(BaseModel):
    trainee_id: str
    session_count: int
    detection_accuracy: float = Field(ge=0, le=100)
    classification_accuracy: float = Field(ge=0, le=100)
    response_accuracy: float = Field(ge=0, le=100)
    average_reaction_time_ms: float | None = None
    night_score: float | None = None
    day_score: float | None = None
    multi_threat_score: float | None = None
    low_visibility_score: float | None = None
    current_level: int = Field(default=1, ge=1, le=10)


class RecommendRequest(BaseModel):
    trainee_id: str


class RecommendResponse(BaseModel):
    recommended_difficulty: int = Field(ge=1, le=10)
    environment: Environment
    time_of_day: TimeOfDay
    threat_count: ThreatCount
    reason: str
```

- [ ] **Step 4: Implement config additions** — `backend/app/config.py` (final content)

```python
"""Runtime configuration (offline-first, env-overridable)."""

from __future__ import annotations

import os

DATABASE_URL: str = os.environ.get(
    "AEROGUARD_DATABASE_URL", "sqlite:///./aeroguard.db"
)

# Optional OpenAI-compatible narrator for AAR summary/recommendation.
# Unset => deterministic templated text (offline default).
LLM_BASE_URL: str | None = os.environ.get("AEROGUARD_LLM_BASE_URL")
LLM_API_KEY: str | None = os.environ.get("AEROGUARD_LLM_API_KEY")
LLM_MODEL: str | None = os.environ.get("AEROGUARD_LLM_MODEL")
LLM_TIMEOUT_S: float = float(os.environ.get("AEROGUARD_LLM_TIMEOUT_S", "5"))
```

- [ ] **Step 5: Write** — `backend/.env.example`

```text
# Aeroguard backend configuration (all optional; offline-first defaults apply).
AEROGUARD_DATABASE_URL=sqlite:///./aeroguard.db

# Optional LLM narrator for the AAR summary + recommendation (OpenAI-compatible).
# Leave BASE_URL/MODEL unset to use the deterministic templated narrator.
# Works with a local server (e.g. http://localhost:11434/v1) or a remote API.
AEROGUARD_LLM_BASE_URL=
AEROGUARD_LLM_API_KEY=
AEROGUARD_LLM_MODEL=
AEROGUARD_LLM_TIMEOUT_S=5
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests/test_aar_schemas.py -v`
Expected: PASS (5 tests)
Then run the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS (existing 93 + 5 = 98), pristine, `test_contract.py` green.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/aar.py backend/app/config.py backend/.env.example backend/tests/test_aar_schemas.py
git commit -m "feat(schemas): add AAR, performance, and recommendation models"
```

---

### Task 2: AAR service — facts, timing, mistakes, timeline

**Files:**
- Create: `backend/app/services/aar.py`
- Create: `backend/tests/test_aar_service.py`

**Interfaces:**
- Consumes: `app.schemas.events.{EventCreateRequest, EventType}`, `app.schemas.scenario.Scenario`, `app.schemas.scoring.ScoreResult`, `app.services.scoring.{DETECTION_MAX, CLASSIFICATION_MAX, RESPONSE_MAX}`.
- Produces:
  - `app.services.aar.AarFacts` (frozen dataclass: `session_id`, `scenario_id`, `final_score: float`, `detected: int`, `total: int`, `classified_correct: int`, `responded_correct: int`, `false_alarms: int`, `timing: TimingMetrics`, `mistakes: tuple[Mistake, ...]`, `strengths: tuple[str, ...]`, `weaknesses: tuple[str, ...]`, `weakest_dimension: str`)
  - `app.services.aar.build_aar_facts(session_id: str, scenario: Scenario, events: list[EventCreateRequest], score_result: ScoreResult) -> AarFacts`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_aar_service.py`

```python
from __future__ import annotations

from app.schemas.aar import MistakeKind
from app.schemas.events import EventCreateRequest
from app.schemas.scenario import Scenario
from app.schemas.scoring import ScoreResult
from app.services.aar import build_aar_facts
from app.services.scoring import score


def _scenario(*threats: dict) -> Scenario:
    return Scenario(
        scenario_id="SCN-000001", seed=1, generator_version="1.0", difficulty=3,
        environment="rural", time_of_day="day", visibility="clear",
        sensor_quality=0.9, duration_seconds=120.0, threats=list(threats),
    )


_HOSTILE = {
    "id": "T01", "classification_label": "hostile", "expected_response": "hold",
    "spawn_time": 10.0, "speed_class": "fast",
}


def _score(scenario, events) -> ScoreResult:
    return score("SES-TEST", scenario, events)


def test_perfect_session_has_no_mistakes_and_full_strengths() -> None:
    scenario = _scenario(_HOSTILE)
    events = [
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=10500, threat_id="T01"),
        EventCreateRequest(
            type="CLASSIFICATION_SUBMITTED", timestamp_ms=11500, threat_id="T01",
            payload={"label": "hostile"},
        ),
        EventCreateRequest(
            type="RESPONSE_SUBMITTED", timestamp_ms=12500, threat_id="T01",
            payload={"response": "hold"},
        ),
    ]
    facts = build_aar_facts("SES-TEST", scenario, events, _score(scenario, events))
    assert (facts.detected, facts.classified_correct, facts.responded_correct) == (1, 1, 1)
    assert facts.false_alarms == 0
    assert facts.mistakes == ()
    assert any("Detection" in s for s in facts.strengths)
    assert facts.weakest_dimension == "timing"  # all corrected at full marks


def test_timing_metrics_use_spawn_and_stage_gaps() -> None:
    scenario = _scenario(_HOSTILE)
    events = [
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=10500, threat_id="T01"),
        EventCreateRequest(
            type="CLASSIFICATION_SUBMITTED", timestamp_ms=11500, threat_id="T01",
            payload={"label": "hostile"},
        ),
        EventCreateRequest(
            type="RESPONSE_SUBMITTED", timestamp_ms=13500, threat_id="T01",
            payload={"response": "hold"},
        ),
    ]
    facts = build_aar_facts("SES-TEST", scenario, events, _score(scenario, events))
    assert facts.timing.mean_time_to_detection_ms == 500.0
    assert facts.timing.mean_detection_to_classification_ms == 1000.0
    assert facts.timing.mean_classification_to_response_ms == 2000.0
    assert facts.timing.mean_total_decision_ms == 3000.0


def test_missed_threat_is_recorded() -> None:
    scenario = _scenario(_HOSTILE)
    facts = build_aar_facts("SES-TEST", scenario, [], _score(scenario, []))
    kinds = [m.kind for m in facts.mistakes]
    assert MistakeKind.missed_threat in kinds
    assert facts.timing.mean_time_to_detection_ms is None


def test_false_alarm_and_wrong_classification_and_wrong_response() -> None:
    scenario = _scenario(
        {"id": "T01", "classification_label": "hostile", "expected_response": "hold",
         "spawn_time": 5.0, "speed_class": "fast"},
        {"id": "T02", "classification_label": "friendly", "expected_response": "monitor",
         "spawn_time": 20.0, "speed_class": "medium"},
    )
    events = [
        # T01: detected, wrong classification
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=6000, threat_id="T01"),
        EventCreateRequest(
            type="CLASSIFICATION_SUBMITTED", timestamp_ms=7000, threat_id="T01",
            payload={"label": "unknown"},
        ),
        # T02: detected, correct classification, wrong response
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=21000, threat_id="T02"),
        EventCreateRequest(
            type="CLASSIFICATION_SUBMITTED", timestamp_ms=22000, threat_id="T02",
            payload={"label": "friendly"},
        ),
        EventCreateRequest(
            type="RESPONSE_SUBMITTED", timestamp_ms=23000, threat_id="T02",
            payload={"response": "hold"},
        ),
        EventCreateRequest(type="FALSE_ALARM", timestamp_ms=30000),
    ]
    facts = build_aar_facts("SES-TEST", scenario, events, _score(scenario, events))
    kinds = {m.kind for m in facts.mistakes}
    assert kinds == {
        MistakeKind.classification_error, MistakeKind.response_error, MistakeKind.false_alarm,
    }
    assert facts.false_alarms == 1
    # mistakes are ordered by timestamp
    assert [m.timestamp_ms for m in facts.mistakes] == sorted(m.timestamp_ms for m in facts.mistakes)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_aar_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.aar'`

- [ ] **Step 3: Implement** — `backend/app/services/aar.py`

```python
"""Deterministic After Action Review facts.

A pure function of (scenario ground truth, recorded events, score). The
narrative text (summary/recommendation) is supplied separately by a
Narrator (see services/aar_narrator.py); everything measurable is computed
here so it is reproducible and testable.

Source of truth: docs/modules/aar_and_adaptive_training.md §1-3, §5.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.aar import Mistake, MistakeKind, TimingMetrics
from app.schemas.events import EventCreateRequest, EventType
from app.schemas.scenario import Scenario, ThreatProfile
from app.schemas.scoring import ScoreResult
from app.services.scoring import CLASSIFICATION_MAX, DETECTION_MAX, RESPONSE_MAX

TIMING_MAX = 15

_COMPONENTS: tuple[tuple[str, str], ...] = (
    ("detection", "Detection"),
    ("classification", "Classification"),
    ("response", "Response"),
    ("timing", "Timing"),
)


@dataclass(frozen=True)
class AarFacts:
    session_id: str
    scenario_id: str
    final_score: float
    detected: int
    total: int
    classified_correct: int
    responded_correct: int
    false_alarms: int
    timing: TimingMetrics
    mistakes: tuple[Mistake, ...]
    strengths: tuple[str, ...]
    weaknesses: tuple[str, ...]
    weakest_dimension: str


def _first(
    events: list[EventCreateRequest], event_type: EventType, threat_id: str
) -> EventCreateRequest | None:
    for event in events:
        if event.type == event_type and event.threat_id == threat_id:
            return event
    return None


def _spawn_ms(threat: ThreatProfile) -> int:
    return int(round(threat.spawn_time * 1000))


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def _timing(scenario: Scenario, events: list[EventCreateRequest]) -> TimingMetrics:
    to_detect: list[float] = []
    detect_to_class: list[float] = []
    class_to_response: list[float] = []
    total: list[float] = []
    for threat in scenario.threats:
        detection = _first(events, EventType.THREAT_DETECTED, threat.id)
        if detection is None:
            continue
        to_detect.append(max(0.0, float(detection.timestamp_ms - _spawn_ms(threat))))
        classification = _first(events, EventType.CLASSIFICATION_SUBMITTED, threat.id)
        if classification is not None:
            detect_to_class.append(
                max(0.0, float(classification.timestamp_ms - detection.timestamp_ms))
            )
        response = _first(events, EventType.RESPONSE_SUBMITTED, threat.id)
        if response is not None:
            total.append(
                max(0.0, float(response.timestamp_ms - detection.timestamp_ms))
            )
            if classification is not None:
                class_to_response.append(
                    max(0.0, float(response.timestamp_ms - classification.timestamp_ms))
                )
    return TimingMetrics(
        mean_time_to_detection_ms=_mean(to_detect),
        mean_detection_to_classification_ms=_mean(detect_to_class),
        mean_classification_to_response_ms=_mean(class_to_response),
        mean_total_decision_ms=_mean(total),
    )


def _counts(scenario: Scenario, events: list[EventCreateRequest]) -> tuple[int, int, int]:
    detected = classified = responded = 0
    for threat in scenario.threats:
        detection = _first(events, EventType.THREAT_DETECTED, threat.id)
        if detection is None:
            continue
        detected += 1
        classification = _first(events, EventType.CLASSIFICATION_SUBMITTED, threat.id)
        label = classification.payload.get("label") if classification else None
        if label != threat.classification_label.value:
            continue
        classified += 1
        response = _first(events, EventType.RESPONSE_SUBMITTED, threat.id)
        value = response.payload.get("response") if response else None
        if value == threat.expected_response.value:
            responded += 1
    return detected, classified, responded


def _mistakes(scenario: Scenario, events: list[EventCreateRequest]) -> list[Mistake]:
    mistakes: list[Mistake] = []
    for threat in scenario.threats:
        detection = _first(events, EventType.THREAT_DETECTED, threat.id)
        if detection is None:
            mistakes.append(
                Mistake(
                    kind=MistakeKind.missed_threat,
                    timestamp_ms=_spawn_ms(threat),
                    threat_id=threat.id,
                    detail="no detection recorded",
                )
            )
            continue
        classification = _first(events, EventType.CLASSIFICATION_SUBMITTED, threat.id)
        label = classification.payload.get("label") if classification else None
        if label != threat.classification_label.value:
            got = label if label is not None else "none"
            mistakes.append(
                Mistake(
                    kind=MistakeKind.classification_error,
                    timestamp_ms=classification.timestamp_ms if classification else detection.timestamp_ms,
                    threat_id=threat.id,
                    detail=f"classified '{got}', expected '{threat.classification_label.value}'",
                )
            )
            continue
        response = _first(events, EventType.RESPONSE_SUBMITTED, threat.id)
        value = response.payload.get("response") if response else None
        if value != threat.expected_response.value:
            got = value if value is not None else "none"
            mistakes.append(
                Mistake(
                    kind=MistakeKind.response_error,
                    timestamp_ms=response.timestamp_ms if response else classification.timestamp_ms,
                    threat_id=threat.id,
                    detail=f"responded '{got}', expected '{threat.expected_response.value}'",
                )
            )
    for event in events:
        if event.type == EventType.FALSE_ALARM:
            mistakes.append(
                Mistake(
                    kind=MistakeKind.false_alarm,
                    timestamp_ms=event.timestamp_ms,
                    threat_id=event.threat_id,
                    detail="false alarm",
                )
            )
    return sorted(mistakes, key=lambda m: (m.timestamp_ms, m.threat_id or ""))


def _assessment(score_result: ScoreResult) -> tuple[tuple[str, ...], tuple[str, ...], str]:
    values = {
        "detection": (score_result.detection_score, DETECTION_MAX),
        "classification": (score_result.classification_score, CLASSIFICATION_MAX),
        "response": (score_result.response_score, RESPONSE_MAX),
        "timing": (score_result.timing_score, TIMING_MAX),
    }
    strengths: list[str] = []
    weaknesses: list[str] = []
    worst_name = ""
    worst_lost = -1.0
    for key, label in _COMPONENTS:
        value, maximum = values[key]
        if value >= maximum:
            strengths.append(f"{label}: full marks ({value:.1f}/{maximum}).")
            continue
        lost = maximum - value
        weaknesses.append(f"{label}: lost {lost:.1f} of {maximum}.")
        if lost > worst_lost:
            worst_lost = lost
            worst_name = key
    weakest = worst_name if worst_name else "consistency at the current difficulty"
    return tuple(strengths), tuple(weaknesses), weakest


def build_aar_facts(
    session_id: str,
    scenario: Scenario,
    events: list[EventCreateRequest],
    score_result: ScoreResult,
) -> AarFacts:
    detected, classified, responded = _counts(scenario, events)
    false_alarms = sum(1 for e in events if e.type == EventType.FALSE_ALARM)
    strengths, weaknesses, weakest = _assessment(score_result)
    return AarFacts(
        session_id=session_id,
        scenario_id=scenario.scenario_id,
        final_score=score_result.final_score,
        detected=detected,
        total=len(scenario.threats),
        classified_correct=classified,
        responded_correct=responded,
        false_alarms=false_alarms,
        timing=_timing(scenario, events),
        mistakes=tuple(_mistakes(scenario, events)),
        strengths=strengths,
        weaknesses=weaknesses,
        weakest_dimension=weakest,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_aar_service.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full suite**

Run: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/aar.py backend/tests/test_aar_service.py
git commit -m "feat(aar): add deterministic AAR facts builder"
```

---

### Task 3: AAR narrator (template + optional LLM) and `build_aar`

**Files:**
- Create: `backend/app/services/aar_narrator.py`
- Modify: `backend/app/services/aar.py` (add `build_aar`)
- Create: `backend/tests/test_aar_narrator.py`

**Interfaces:**
- Consumes: `app.services.aar.AarFacts`, `app.config` LLM settings.
- Produces:
  - `app.services.aar_narrator.AarNarrative` (frozen dataclass `summary: str`, `recommendation: str`)
  - `app.services.aar_narrator.Narrator` (Protocol: `narrate(facts: AarFacts) -> AarNarrative`)
  - `app.services.aar_narrator.TemplateNarrator` (deterministic)
  - `app.services.aar_narrator.LlmNarrator(base_url, model, api_key=None, timeout_s=5.0, post=None, fallback=None)` (falls back on any error)
  - `app.services.aar_narrator.get_narrator() -> Narrator`
  - `app.services.aar.build_aar(session_id: str, scenario: Scenario, events: list[EventCreateRequest], score_result: ScoreResult, narrator: Narrator | None = None) -> AAR`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_aar_narrator.py`

```python
from __future__ import annotations

from app.schemas.aar import TimingMetrics
from app.services import aar_narrator
from app.services.aar import AarFacts
from app.services.aar_narrator import (
    AarNarrative,
    LlmNarrator,
    TemplateNarrator,
    get_narrator,
)


def _facts() -> AarFacts:
    return AarFacts(
        session_id="SES-1", scenario_id="SCN-1", final_score=85.0, detected=1, total=1,
        classified_correct=1, responded_correct=1, false_alarms=0, timing=TimingMetrics(),
        mistakes=(), strengths=(), weaknesses=(), weakest_dimension="response",
    )


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_template_narrator_is_deterministic_and_cites_metrics() -> None:
    narrative = TemplateNarrator().narrate(_facts())
    assert isinstance(narrative, AarNarrative)
    assert "85.0" in narrative.summary
    assert "1/1" in narrative.summary
    assert "response" in narrative.recommendation


def test_llm_narrator_returns_parsed_json() -> None:
    calls: list[dict] = []

    def fake_post(url, json, headers, timeout):
        calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        content = '{"summary": "Nice work.", "recommendation": "Push timing."}'
        return _FakeResponse({"choices": [{"message": {"content": content}}]})

    narrator = LlmNarrator("http://llm.local/v1", "test-model", api_key="secret", post=fake_post)
    narrative = narrator.narrate(_facts())
    assert narrative == AarNarrative(summary="Nice work.", recommendation="Push timing.")
    assert calls[0]["url"] == "http://llm.local/v1/chat/completions"
    assert calls[0]["headers"]["Authorization"] == "Bearer secret"
    assert calls[0]["json"]["model"] == "test-model"


def test_llm_narrator_falls_back_on_error() -> None:
    def boom(url, json, headers, timeout):
        raise RuntimeError("network down")

    narrator = LlmNarrator("http://llm.local/v1", "m", post=boom)
    narrative = narrator.narrate(_facts())
    assert narrative == TemplateNarrator().narrate(_facts())


def test_llm_narrator_falls_back_on_bad_json() -> None:
    def bad(url, json, headers, timeout):
        return _FakeResponse({"choices": [{"message": {"content": "not json"}}]})

    narrator = LlmNarrator("http://llm.local/v1", "m", post=bad)
    assert narrator.narrate(_facts()) == TemplateNarrator().narrate(_facts())


def test_get_narrator_defaults_to_template(monkeypatch) -> None:
    monkeypatch.setattr(aar_narrator.config, "LLM_BASE_URL", None)
    monkeypatch.setattr(aar_narrator.config, "LLM_MODEL", None)
    assert isinstance(get_narrator(), TemplateNarrator)


def test_get_narrator_uses_llm_when_configured(monkeypatch) -> None:
    monkeypatch.setattr(aar_narrator.config, "LLM_BASE_URL", "http://llm.local/v1")
    monkeypatch.setattr(aar_narrator.config, "LLM_MODEL", "m")
    monkeypatch.setattr(aar_narrator.config, "LLM_API_KEY", None)
    assert isinstance(get_narrator(), LlmNarrator)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_aar_narrator.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.aar_narrator'`

- [ ] **Step 3: Implement** — `backend/app/services/aar_narrator.py`

```python
"""AAR narrative text: deterministic template by default, optional LLM.

The LLM path is provider-agnostic (any OpenAI-compatible /chat/completions
endpoint) and OPTIONAL: when unset, or on any error/timeout, the
deterministic TemplateNarrator is used. This keeps the system offline-first
and the tests network-free (the poster is injected).

Source of truth: docs/modules/aar_and_adaptive_training.md §5.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Protocol

import httpx

from app import config

if TYPE_CHECKING:
    from app.services.aar import AarFacts


@dataclass(frozen=True)
class AarNarrative:
    summary: str
    recommendation: str


class Narrator(Protocol):
    def narrate(self, facts: "AarFacts") -> AarNarrative: ...


class TemplateNarrator:
    """Deterministic, offline narrator built from the measured metrics."""

    def narrate(self, facts: "AarFacts") -> AarNarrative:
        summary = (
            f"Final score {facts.final_score:.1f}/100: detected {facts.detected}/{facts.total}, "
            f"classified {facts.classified_correct}/{facts.total}, "
            f"responded {facts.responded_correct}/{facts.total}"
        )
        if facts.false_alarms:
            summary += f"; {facts.false_alarms} false alarm(s)"
        summary += "."
        recommendation = f"Focus on {facts.weakest_dimension} in the next session."
        return AarNarrative(summary=summary, recommendation=recommendation)


_Post = Callable[..., Any]


class LlmNarrator:
    """Optional OpenAI-compatible narrator; always falls back to the template."""

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
        timeout_s: float = 5.0,
        post: _Post | None = None,
        fallback: Narrator | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_key = api_key
        self._timeout_s = timeout_s
        self._post = post or httpx.post
        self._fallback: Narrator = fallback or TemplateNarrator()

    def _prompt(self, facts: "AarFacts") -> str:
        return (
            "You are an airspace-training instructor writing a brief after-action review. "
            "Use ONLY the metrics provided; do not invent facts. Reply with compact JSON "
            'of the form {"summary": string, "recommendation": string}.\n'
            f"final_score={facts.final_score:.1f}/100; detected={facts.detected}/{facts.total}; "
            f"classified={facts.classified_correct}/{facts.total}; "
            f"responded={facts.responded_correct}/{facts.total}; "
            f"false_alarms={facts.false_alarms}; weakest_dimension={facts.weakest_dimension}."
        )

    def narrate(self, facts: "AarFacts") -> AarNarrative:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        try:
            response = self._post(
                f"{self._base_url}/chat/completions",
                json={
                    "model": self._model,
                    "temperature": 0,
                    "messages": [{"role": "user", "content": self._prompt(facts)}],
                },
                headers=headers,
                timeout=self._timeout_s,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            summary = str(data["summary"]).strip()
            recommendation = str(data["recommendation"]).strip()
            if not summary or not recommendation:
                raise ValueError("empty narrative")
        except Exception:  # noqa: BLE001 — intentional resilience boundary: any LLM/transport failure degrades to the template
            return self._fallback.narrate(facts)
        return AarNarrative(summary=summary, recommendation=recommendation)


def get_narrator() -> Narrator:
    if config.LLM_BASE_URL and config.LLM_MODEL:
        return LlmNarrator(
            base_url=config.LLM_BASE_URL,
            model=config.LLM_MODEL,
            api_key=config.LLM_API_KEY,
            timeout_s=config.LLM_TIMEOUT_S,
        )
    return TemplateNarrator()
```

- [ ] **Step 4: Add `build_aar`** — append to `backend/app/services/aar.py`

Add these imports at the top of `aar.py` (merge with existing):

```python
from app.schemas.aar import AAR
from app.services.aar_narrator import Narrator, TemplateNarrator
```

Add the function at the end of `aar.py`:

```python
def build_aar(
    session_id: str,
    scenario: Scenario,
    events: list[EventCreateRequest],
    score_result: ScoreResult,
    narrator: Narrator | None = None,
) -> AAR:
    facts = build_aar_facts(session_id, scenario, events, score_result)
    narrative = (narrator or TemplateNarrator()).narrate(facts)
    timeline = sorted(events, key=lambda event: event.timestamp_ms)
    return AAR(
        session_id=session_id,
        scenario_id=scenario.scenario_id,
        summary=narrative.summary,
        scores=score_result,
        timing=facts.timing,
        mistakes=list(facts.mistakes),
        strengths=list(facts.strengths),
        weaknesses=list(facts.weaknesses),
        recommendation=narrative.recommendation,
        timeline=timeline,
    )
```

- [ ] **Step 5: Add a `build_aar` test** — append to `backend/tests/test_aar_service.py`

```python
def test_build_aar_assembles_narrative_and_ordered_timeline() -> None:
    from app.services.aar import build_aar

    scenario = _scenario(_HOSTILE)
    events = [
        EventCreateRequest(
            type="RESPONSE_SUBMITTED", timestamp_ms=12000, threat_id="T01",
            payload={"response": "hold"},
        ),
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=10500, threat_id="T01"),
        EventCreateRequest(
            type="CLASSIFICATION_SUBMITTED", timestamp_ms=11000, threat_id="T01",
            payload={"label": "hostile"},
        ),
    ]
    aar = build_aar("SES-TEST", scenario, events, _score(scenario, events))
    assert aar.scenario_id == "SCN-000001"
    assert aar.summary.startswith("Final score")
    assert [e.timestamp_ms for e in aar.timeline] == [10500, 11000, 12000]
    assert aar.scores.final_score == 100.0
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests/test_aar_narrator.py tests/test_aar_service.py -v`
Expected: PASS (7 + 5 tests)
Then the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/aar_narrator.py backend/app/services/aar.py backend/tests/test_aar_narrator.py backend/tests/test_aar_service.py
git commit -m "feat(aar): add narrator with deterministic fallback and build_aar"
```

---

### Task 4: AAR endpoint

**Files:**
- Create: `backend/app/api/aar.py`
- Modify: `backend/app/main.py` (mount router)
- Create: `backend/tests/test_aar_api.py`

**Interfaces:**
- Consumes: `app.db.models.{ScenarioRow, SessionRow, ScoreRow, EventRow, event_row_to_request}`, `app.schemas.scoring.ScoreResult`, `app.services.aar.build_aar`, `app.services.aar_narrator.get_narrator`, `app.db.database.get_db`.
- Produces: `GET /api/v1/sessions/{session_id}/aar` → 200 `AAR` | 404 unknown session | 404 not-completed session.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_aar_api.py`

```python
from __future__ import annotations


def _generate(client, seed: int = 12345):
    body = client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 3, "environment": "rural", "time_of_day": "day",
              "threat_count": 1, "seed": seed},
    ).json()
    return body


def _complete(client, scenario_id: str, submit_correct: bool):
    session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()
    sid = session["session_id"]
    threat = client.get(f"/api/v1/scenarios/{scenario_id}").json() if False else None
    return sid


def _scenario_threat(client, scenario_id: str) -> dict:
    # The generate response is not re-fetchable; rebuild deterministically instead.
    return {}


def test_aar_requires_completed_session(client) -> None:
    scenario = _generate(client)
    session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario["scenario_id"]},
    ).json()
    response = client.get(f"/api/v1/sessions/{session['session_id']}/aar")
    assert response.status_code == 404


def test_aar_unknown_session_is_404(client) -> None:
    assert client.get("/api/v1/sessions/SES-NOPE/aar").status_code == 404


def test_aar_reports_missed_threat_after_completion(client) -> None:
    scenario = _generate(client)
    session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario["scenario_id"]},
    ).json()
    sid = session["session_id"]
    # finish with no events -> everything missed
    completed = client.post(f"/api/v1/sessions/{sid}/complete")
    assert completed.status_code == 200

    aar = client.get(f"/api/v1/sessions/{sid}/aar")
    assert aar.status_code == 200
    body = aar.json()
    assert body["session_id"] == sid
    assert body["scenario_id"] == scenario["scenario_id"]
    assert body["scores"]["final_score"] == completed.json()["final_score"]
    assert any(m["kind"] == "missed_threat" for m in body["mistakes"])
    assert body["summary"]  # template narrator produced text
    assert body["recommendation"]
    assert body["timeline"] == []


def test_aar_timeline_is_ordered(client) -> None:
    scenario = _generate(client)
    threat_id = scenario["threats"][0]["id"]
    session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario["scenario_id"]},
    ).json()
    sid = session["session_id"]
    for payload in (
        {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 900, "threat_id": threat_id,
         "payload": {"response": scenario["threats"][0]["expected_response"]}},
        {"type": "THREAT_DETECTED", "timestamp_ms": 300, "threat_id": threat_id},
        {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 600, "threat_id": threat_id,
         "payload": {"label": scenario["threats"][0]["classification_label"]}},
    ):
        assert client.post(f"/api/v1/sessions/{sid}/events", json=payload).status_code == 201
    client.post(f"/api/v1/sessions/{sid}/complete")

    body = client.get(f"/api/v1/sessions/{sid}/aar").json()
    timestamps = [event["timestamp_ms"] for event in body["timeline"]]
    assert timestamps == sorted(timestamps)
```

> Note for the implementer: delete the two unused helpers `_complete` and `_scenario_threat` from the test — they are drafting leftovers and will trip `ruff`/flake8. The final test file should contain only `_generate` and the four tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_aar_api.py -v`
Expected: FAIL — `404` for the completed case (route not implemented) or import error.

- [ ] **Step 3: Implement** — `backend/app/api/aar.py`

```python
"""After Action Review HTTP route (GET /sessions/{session_id}/aar)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    EventRow,
    ScenarioRow,
    ScoreRow,
    SessionRow,
    event_row_to_request,
)
from app.schemas.aar import AAR
from app.schemas.scoring import ScoreResult
from app.services.aar import build_aar
from app.services.aar_narrator import get_narrator

router = APIRouter(tags=["aar"])


@router.get("/sessions/{session_id}/aar", response_model=AAR)
def get_aar(session_id: str, db: Session = Depends(get_db)) -> AAR:
    session = db.get(SessionRow, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"unknown session_id: {session_id}")
    score_row = db.get(ScoreRow, session_id)
    if session.status != "completed" or score_row is None:
        raise HTTPException(status_code=404, detail=f"AAR not available for session: {session_id}")

    scenario_row = db.get(ScenarioRow, session.scenario_id)
    if scenario_row is None:
        raise HTTPException(status_code=404, detail=f"unknown scenario_id: {session.scenario_id}")

    event_rows = (
        db.query(EventRow)
        .filter(EventRow.session_id == session_id)
        .order_by(EventRow.timestamp_ms, EventRow.event_id)
        .all()
    )
    events = [event_row_to_request(row) for row in event_rows]
    score_result = ScoreResult(
        session_id=session_id,
        detection_score=score_row.detection_score,
        classification_score=score_row.classification_score,
        response_score=score_row.response_score,
        timing_score=score_row.timing_score,
        penalty=score_row.penalty,
        final_score=score_row.final_score,
        scoring_version=score_row.scoring_version,
    )
    return build_aar(
        session_id, scenario_row.to_schema(), events, score_result, get_narrator()
    )
```

- [ ] **Step 4: Mount the router** — `backend/app/main.py`

Add the import and registration (merge with existing):

```python
from app.api.aar import router as aar_router
```

```python
app.include_router(aar_router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests/test_aar_api.py -v`
Expected: PASS (4 tests)
Then the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/aar.py backend/app/main.py backend/tests/test_aar_api.py
git commit -m "feat(api): add after action review endpoint"
```

---

### Task 5: Adaptive service — aggregation and recommendation

**Files:**
- Create: `backend/app/services/adaptive.py`
- Create: `backend/tests/test_adaptive.py`

**Interfaces:**
- Consumes: `app.schemas.aar.{PerformanceProfile, RecommendResponse}`, `app.schemas.scenario.{Environment, TimeOfDay}`, `app.services.scoring.{DETECTION_MAX, CLASSIFICATION_MAX, RESPONSE_MAX}`.
- Produces:
  - `app.services.adaptive.SessionSummary` (frozen dataclass: `final_score`, `detection_score`, `classification_score`, `response_score`, `environment: str`, `time_of_day: str`, `visibility: str`, `threat_count: int`, `average_reaction_ms: float | None`)
  - `app.services.adaptive.RecommendInput` (frozen dataclass: `recent_final_scores: list[float]`, `overall_score: float | None`, `night_score: float | None`, `multi_threat_score: float | None`, `last_environment: str`, `last_time_of_day: str`, `last_threat_count: int`, `current_level: int`)
  - `app.services.adaptive.mean(values: list[float]) -> float | None`
  - `app.services.adaptive.decide_difficulty_delta(recent_final_scores: list[float]) -> int`
  - `app.services.adaptive.clamp_level(level: int) -> int`
  - `app.services.adaptive.aggregate_performance(trainee_id: str, sessions: list[SessionSummary], current_level: int = 1) -> PerformanceProfile`
  - `app.services.adaptive.build_recommendation(data: RecommendInput) -> RecommendResponse`
  - constants `IMPROVE_THRESHOLD = 90.0`, `DECLINE_THRESHOLD = 60.0`, `CONDITION_GAP = 15.0`, `LEVEL_MIN = 1`, `LEVEL_MAX = 10`, `MULTI_THREAT_MIN = 2`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_adaptive.py`

```python
from __future__ import annotations

from app.services.adaptive import (
    RecommendInput,
    SessionSummary,
    aggregate_performance,
    build_recommendation,
    clamp_level,
    decide_difficulty_delta,
)


def _summary(final=80.0, detection=24.0, classification=24.0, response=20.0,
             time_of_day="day", visibility="clear", threat_count=1, reaction=2000.0,
             environment="urban") -> SessionSummary:
    return SessionSummary(
        final_score=final, detection_score=detection, classification_score=classification,
        response_score=response, environment=environment, time_of_day=time_of_day,
        visibility=visibility, threat_count=threat_count, average_reaction_ms=reaction,
    )


def test_decide_difficulty_delta_rules() -> None:
    assert decide_difficulty_delta([94, 92, 93]) == 1
    assert decide_difficulty_delta([55, 58]) == -1
    assert decide_difficulty_delta([70, 80, 75]) == 0
    assert decide_difficulty_delta([95, 96]) == 0  # not enough history for +1


def test_clamp_level() -> None:
    assert clamp_level(0) == 1
    assert clamp_level(11) == 10
    assert clamp_level(5) == 5


def test_aggregate_performance() -> None:
    sessions = [
        _summary(final=100.0, detection=30.0, classification=30.0, response=25.0, time_of_day="day"),
        _summary(final=60.0, detection=30.0, classification=0.0, response=0.0,
                 time_of_day="night", visibility="reduced", threat_count=3, reaction=4000.0),
    ]
    profile = aggregate_performance("TRAIN-001", sessions, current_level=4)
    assert profile.session_count == 2
    assert profile.detection_accuracy == 100.0
    assert profile.classification_accuracy == 50.0
    assert profile.response_accuracy == 50.0
    assert profile.day_score == 100.0
    assert profile.night_score == 60.0
    assert profile.multi_threat_score == 60.0
    assert profile.low_visibility_score == 60.0
    assert profile.average_reaction_time_ms == 3000.0
    assert profile.current_level == 4


def test_aggregate_performance_empty() -> None:
    profile = aggregate_performance("TRAIN-X", [], current_level=2)
    assert profile.session_count == 0
    assert profile.detection_accuracy == 0.0
    assert profile.night_score is None


def _input(**overrides) -> RecommendInput:
    base = dict(
        recent_final_scores=[80.0, 80.0, 80.0], overall_score=80.0, night_score=None,
        multi_threat_score=None, last_environment="urban", last_time_of_day="day",
        last_threat_count=2, current_level=3,
    )
    base.update(overrides)
    return RecommendInput(**base)


def test_recommend_increases_after_three_strong_sessions() -> None:
    result = build_recommendation(_input(recent_final_scores=[94, 92, 93], overall_score=93.0))
    assert result.recommended_difficulty == 4
    assert "increasing" in result.reason.lower()
    assert result.time_of_day.value == "day"


def test_recommend_decreases_after_two_weak_sessions() -> None:
    result = build_recommendation(_input(recent_final_scores=[55, 58], overall_score=56.5))
    assert result.recommended_difficulty == 2
    assert "decreasing" in result.reason.lower()


def test_recommend_targets_night_without_raising_difficulty() -> None:
    result = build_recommendation(_input(night_score=60.0, overall_score=85.0, current_level=5))
    assert result.time_of_day.value == "night"
    assert result.recommended_difficulty == 5  # no over-adaptation
    assert "night" in result.reason.lower()


def test_recommend_targets_multi_threat() -> None:
    result = build_recommendation(
        _input(multi_threat_score=60.0, overall_score=85.0, last_threat_count=1, current_level=5)
    )
    assert result.threat_count == 3
    assert result.recommended_difficulty == 5


def test_recommend_empty_history_defaults() -> None:
    result = build_recommendation(
        _input(recent_final_scores=[], overall_score=None, current_level=1)
    )
    assert result.recommended_difficulty == 1
    assert "no completed sessions" in result.reason.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_adaptive.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.adaptive'`

- [ ] **Step 3: Implement** — `backend/app/services/adaptive.py`

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_adaptive.py -v`
Expected: PASS (9 tests)
Then the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/adaptive.py backend/tests/test_adaptive.py
git commit -m "feat(adaptive): add performance aggregation and rule-based recommender"
```

---

### Task 6: Performance and recommendation endpoints

**Files:**
- Create: `backend/app/api/training.py`
- Modify: `backend/app/main.py` (mount router)
- Create: `backend/tests/test_training_api.py`

**Interfaces:**
- Consumes: `app.db.models.{EventRow, PerformanceProfileRow, ScenarioRow, ScoreRow, SessionRow, event_row_to_request}`, `app.schemas.aar.{PerformanceProfile, RecommendRequest, RecommendResponse}`, `app.services.adaptive.{RecommendInput, SessionSummary, aggregate_performance, build_recommendation, mean}`.
- Produces:
  - `GET /api/v1/trainees/{trainee_id}/performance` → 200 `PerformanceProfile` | 404 unknown trainee
  - `POST /api/v1/training/recommend` → 200 `RecommendResponse` | 404 unknown trainee | 422 invalid body

- [ ] **Step 1: Write the failing test** — `backend/tests/test_training_api.py`

```python
from __future__ import annotations


def _scenario(client, seed: int, difficulty: int = 3):
    return client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": difficulty, "environment": "urban", "time_of_day": "night",
              "threat_count": 1, "seed": seed},
    ).json()


def _play(client, scenario, *, correct: bool) -> str:
    threat = scenario["threats"][0]
    session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario["scenario_id"]},
    ).json()
    sid = session["session_id"]
    if correct:
        events = [
            {"type": "THREAT_DETECTED", "timestamp_ms": 500, "threat_id": threat["id"]},
            {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 1500, "threat_id": threat["id"],
             "payload": {"label": threat["classification_label"]}},
            {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 2500, "threat_id": threat["id"],
             "payload": {"response": threat["expected_response"]}},
        ]
        for event in events:
            client.post(f"/api/v1/sessions/{sid}/events", json=event)
    client.post(f"/api/v1/sessions/{sid}/complete")
    return sid


def test_performance_unknown_trainee_is_404(client) -> None:
    assert client.get("/api/v1/trainees/TRAIN-NONE/performance").status_code == 404


def test_performance_aggregates_completed_sessions(client) -> None:
    _play(client, _scenario(client, 1), correct=True)
    _play(client, _scenario(client, 2), correct=True)
    response = client.get("/api/v1/trainees/TRAIN-001/performance")
    assert response.status_code == 200
    body = response.json()
    assert body["trainee_id"] == "TRAIN-001"
    assert body["session_count"] == 2
    assert body["detection_accuracy"] == 100.0
    assert body["night_score"] == 100.0


def test_recommend_unknown_trainee_is_404(client) -> None:
    assert client.post("/api/v1/training/recommend", json={"trainee_id": "TRAIN-NONE"}).status_code == 404


def test_recommend_defaults_for_active_only_trainee(client) -> None:
    scenario = _scenario(client, 3)
    client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-ACT", "scenario_id": scenario["scenario_id"]},
    )
    response = client.post("/api/v1/training/recommend", json={"trainee_id": "TRAIN-ACT"})
    assert response.status_code == 200
    body = response.json()
    assert body["recommended_difficulty"] == 1
    assert "no completed sessions" in body["reason"].lower()


def test_recommend_increases_and_persists_level(client) -> None:
    for seed in (10, 11, 12):
        _play(client, _scenario(client, seed, difficulty=1), correct=True)
    first = client.post("/api/v1/training/recommend", json={"trainee_id": "TRAIN-001"}).json()
    assert first["recommended_difficulty"] == 2
    assert "increasing" in first["reason"].lower()
    # level was persisted
    assert client.get("/api/v1/trainees/TRAIN-001/performance").json()["current_level"] == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_training_api.py -v`
Expected: FAIL — routes not implemented (404/405).

- [ ] **Step 3: Implement** — `backend/app/api/training.py`

```python
"""Performance aggregation and adaptive recommendation routes.

    GET  /trainees/{trainee_id}/performance
    POST /training/recommend

Routes stay thin: they assemble plain SessionSummary values from the DB and
delegate all logic to the pure services.adaptive functions.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    EventRow,
    PerformanceProfileRow,
    ScenarioRow,
    ScoreRow,
    SessionRow,
    event_row_to_request,
)
from app.schemas.aar import PerformanceProfile, RecommendRequest, RecommendResponse
from app.schemas.events import EventType
from app.services.adaptive import (
    RecommendInput,
    SessionSummary,
    aggregate_performance,
    build_recommendation,
    mean,
)

router = APIRouter(tags=["training"])


def _completed_sessions(db: Session, trainee_id: str) -> list[SessionRow]:
    return (
        db.query(SessionRow)
        .filter(SessionRow.trainee_id == trainee_id, SessionRow.status == "completed")
        .order_by(SessionRow.completed_at, SessionRow.session_id)
        .all()
    )


def _average_reaction_ms(db: Session, session_id: str) -> float | None:
    rows = (
        db.query(EventRow)
        .filter(EventRow.session_id == session_id)
        .order_by(EventRow.timestamp_ms, EventRow.event_id)
        .all()
    )
    events = [event_row_to_request(row) for row in rows]
    latencies: list[float] = []
    for event in events:
        if event.type != EventType.THREAT_DETECTED or event.threat_id is None:
            continue
        response = next(
            (
                candidate
                for candidate in events
                if candidate.type == EventType.RESPONSE_SUBMITTED
                and candidate.threat_id == event.threat_id
            ),
            None,
        )
        if response is not None:
            latencies.append(float(max(0, response.timestamp_ms - event.timestamp_ms)))
    return mean(latencies)


def _summary(db: Session, session: SessionRow) -> SessionSummary | None:
    score = db.get(ScoreRow, session.session_id)
    scenario = db.get(ScenarioRow, session.scenario_id)
    if score is None or scenario is None:
        return None
    return SessionSummary(
        final_score=score.final_score,
        detection_score=score.detection_score,
        classification_score=score.classification_score,
        response_score=score.response_score,
        environment=scenario.environment,
        time_of_day=scenario.time_of_day,
        visibility=scenario.visibility,
        threat_count=len(json.loads(scenario.threats_json)),
        average_reaction_ms=_average_reaction_ms(db, session.session_id),
    )


def _summaries(db: Session, trainee_id: str) -> list[SessionSummary]:
    return [
        summary
        for summary in (_summary(db, row) for row in _completed_sessions(db, trainee_id))
        if summary is not None
    ]


def _require_trainee(db: Session, trainee_id: str) -> None:
    exists = db.query(SessionRow).filter(SessionRow.trainee_id == trainee_id).first()
    if exists is None:
        raise HTTPException(status_code=404, detail=f"unknown trainee_id: {trainee_id}")


def _current_level(db: Session, trainee_id: str) -> int:
    profile = db.get(PerformanceProfileRow, trainee_id)
    return profile.current_level if profile is not None else 1


def _upsert_profile(db: Session, profile: PerformanceProfile) -> None:
    row = db.get(PerformanceProfileRow, profile.trainee_id)
    if row is None:
        row = PerformanceProfileRow(trainee_id=profile.trainee_id)
        db.add(row)
    row.session_count = profile.session_count
    row.detection_accuracy = profile.detection_accuracy
    row.classification_accuracy = profile.classification_accuracy
    row.response_accuracy = profile.response_accuracy
    row.average_reaction_time_ms = profile.average_reaction_time_ms
    row.night_score = profile.night_score
    row.day_score = profile.day_score
    row.multi_threat_score = profile.multi_threat_score
    row.low_visibility_score = profile.low_visibility_score
    row.current_level = profile.current_level
    db.commit()


@router.get("/trainees/{trainee_id}/performance", response_model=PerformanceProfile)
def get_performance(trainee_id: str, db: Session = Depends(get_db)) -> PerformanceProfile:
    _require_trainee(db, trainee_id)
    level = _current_level(db, trainee_id)
    profile = aggregate_performance(trainee_id, _summaries(db, trainee_id), level)
    _upsert_profile(db, profile)
    return profile


@router.post("/training/recommend", response_model=RecommendResponse)
def recommend_training(
    body: RecommendRequest, db: Session = Depends(get_db)
) -> RecommendResponse:
    _require_trainee(db, body.trainee_id)
    summaries = _summaries(db, body.trainee_id)
    level = _current_level(db, body.trainee_id)
    profile = aggregate_performance(body.trainee_id, summaries, level)
    last = summaries[-1] if summaries else None
    data = RecommendInput(
        recent_final_scores=[summary.final_score for summary in summaries],
        overall_score=mean([summary.final_score for summary in summaries]),
        night_score=profile.night_score,
        multi_threat_score=profile.multi_threat_score,
        last_environment=last.environment if last else "urban",
        last_time_of_day=last.time_of_day if last else "day",
        last_threat_count=last.threat_count if last else 1,
        current_level=level,
    )
    response = build_recommendation(data)
    profile.current_level = response.recommended_difficulty
    _upsert_profile(db, profile)
    return response
```

- [ ] **Step 4: Mount the router** — `backend/app/main.py`

Add the import and registration (merge with existing):

```python
from app.api.training import router as training_router
```

```python
app.include_router(training_router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests/test_training_api.py -v`
Expected: PASS (5 tests)
Then the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/training.py backend/app/main.py backend/tests/test_training_api.py
git commit -m "feat(api): add performance and adaptive recommendation endpoints"
```

---

### Task 7: Phase 4 validation (the five demo questions)

**Files:**
- Create: `backend/tests/test_phase4_validation.py`

**Interfaces:**
- Consumes: the running app via the `client` fixture; `app.services.scoring.score` for the pure-reproduction check.
- Produces: a single test module that answers all five `docs/project-management/demo_validation.md §Validation questions` with assertions.

- [ ] **Step 1: Write the test** — `backend/tests/test_phase4_validation.py`

```python
"""Phase 4 DoD: the five demo_validation.md questions answer YES via tests."""

from __future__ import annotations

from app.schemas.events import EventCreateRequest
from app.schemas.scenario import Scenario
from app.services.scoring import score


def _generate(client, seed: int):
    return client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 3, "environment": "urban", "time_of_day": "day",
              "threat_count": 1, "seed": seed},
    )


def _scenario_from(body: dict) -> Scenario:
    return Scenario(**body)


def _events_for(body: dict) -> list[EventCreateRequest]:
    threat = body["threats"][0]
    return [
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=500, threat_id=threat["id"]),
        EventCreateRequest(type="CLASSIFICATION_SUBMITTED", timestamp_ms=1500,
                           threat_id=threat["id"], payload={"label": threat["classification_label"]}),
        EventCreateRequest(type="RESPONSE_SUBMITTED", timestamp_ms=2500,
                           threat_id=threat["id"], payload={"response": threat["expected_response"]}),
    ]


def test_q1_same_seed_reproduces_scenario(client) -> None:
    first = _generate(client, 12345).json()
    second = _generate(client, 12345).json()
    assert first == second


def test_q2_same_events_reproduce_score(client) -> None:
    body = _generate(client, 5).json()
    scenario = _scenario_from(body)
    events = _events_for(body)
    assert score("SES-A", scenario, events) == score("SES-B", scenario, events)


def test_q3_missed_threat_appears_in_aar(client) -> None:
    body = _generate(client, 7).json()
    session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-Q3", "scenario_id": body["scenario_id"]},
    ).json()
    client.post(f"/api/v1/sessions/{session['session_id']}/complete")
    aar = client.get(f"/api/v1/sessions/{session['session_id']}/aar").json()
    assert any(m["kind"] == "missed_threat" for m in aar["mistakes"])


def test_q4_performance_compares_across_sessions(client) -> None:
    for seed in (20, 21):
        body = _generate(client, seed).json()
        session = client.post(
            "/api/v1/sessions",
            json={"trainee_id": "TRAIN-Q4", "scenario_id": body["scenario_id"]},
        ).json()
        for event in _events_for(body):
            client.post(f"/api/v1/sessions/{session['session_id']}/events", json=event.model_dump(mode="json"))
        client.post(f"/api/v1/sessions/{session['session_id']}/complete")
    profile = client.get("/api/v1/trainees/TRAIN-Q4/performance").json()
    assert profile["session_count"] == 2
    assert profile["detection_accuracy"] == 100.0


def test_q5_recommendation_explains_itself(client) -> None:
    for seed in (30, 31, 32):
        body = _generate(client, seed).json()
        session = client.post(
            "/api/v1/sessions",
            json={"trainee_id": "TRAIN-Q5", "scenario_id": body["scenario_id"]},
        ).json()
        for event in _events_for(body):
            client.post(f"/api/v1/sessions/{session['session_id']}/events", json=event.model_dump(mode="json"))
        client.post(f"/api/v1/sessions/{session['session_id']}/complete")
    recommendation = client.post(
        "/api/v1/training/recommend", json={"trainee_id": "TRAIN-Q5"}
    ).json()
    assert recommendation["reason"]
    assert any(char.isdigit() for char in recommendation["reason"])
```

- [ ] **Step 2: Run the validation module**

Run: `.venv/Scripts/python -m pytest tests/test_phase4_validation.py -v`
Expected: PASS (5 tests)

- [ ] **Step 3: Run the full suite (phase quality gate)**

Run: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS — 93 existing + Phase 4 tests, pristine, no warnings.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_phase4_validation.py
git commit -m "test(aar): verify the five demo validation questions"
```

---

### Task 8: Checklist, final verification, and push

**Files:**
- Modify: `docs/project-management/development_checklist.md`

**Interfaces:**
- Consumes: completed Tasks 1-7.
- Produces: updated checklist; Phase 4 pushed to `origin/main`.

- [ ] **Step 1: Tick delivered items** — change `[ ]` to `[x]` for

Under **Backend**: `AAR endpoint`, `Performance endpoint`, `Recommendation endpoint`.
Under **AAR**: `Summary`, `Metrics`, `Errors`, `Timeline`, `Weakness detection`, `Recommendation`.
Under **Adaptive training**: `Historical performance`, `Difficulty adjustment`, `Condition-specific weakness`, `Next scenario recommendation`.

Leave **Polish** and **Optional** unchecked.

> Note for the implementer: tick ONLY the 12 items above. Do not tick `Better assets`/`Better lighting`/`Sound`/`UI polish`/`Error handling`/`Demo mode` (those are Phase 7 polish). Do not tick anything under **Unity** (already ticked in Phase 3) or the **Optional** section.

- [ ] **Step 2: Run both suites one final time**

Run (from `backend/`): `.venv/Scripts/python -m pytest tests -q`
Run (from `client/`): `npm test`
Expected: backend green (pristine); client green (14 tests). The client is unchanged, but re-run to prove no regression.

- [ ] **Step 3: Confirm clean tree**

Run from repo root: `git status --short` (only the checklist change).

- [ ] **Step 4: Commit and push**

```bash
git add docs/project-management/development_checklist.md
git commit -m "docs(checklist): mark AAR and adaptive phase complete"
git push origin main
```

---

## Phase DoD (verification before completion)

- `docs/project-management/demo_validation.md` five validation questions answered YES via `tests/test_phase4_validation.py`.
- `GET /sessions/{id}/aar` returns a contract-shaped `AAR` for a completed session and 404 otherwise; `timeline` is chronologically ordered; every mistake is represented; the recommendation is present.
- `GET /trainees/{id}/performance` returns recomputed aggregates; 404 for an unknown trainee.
- `POST /training/recommend` returns a 1–10 `recommended_difficulty`, a metric-cited `reason`, and persists the updated `current_level`; adaptive rules match `testing_validation.md §5`.
- AAR narrative uses the deterministic template by default and never requires a network; the optional LLM narrator falls back on any error (mocked in tests).
- `tests/test_contract.py` stays green (no contract edits).
- Backend suite green; `main` pushed; `git status` clean.

## Self-Review Notes (author)

- **Spec coverage:** `aar_and_adaptive_training.md §2` (header/performance/errors/timeline/recommendation) → Tasks 2/4; §3 weakness detection → Task 2 `_assessment`; §4 adaptive rules → Task 5; §5 recommendation fields → Tasks 5/6; §6 avoid over-adaptation → Task 5 (single-dimension condition bias). `testing_validation.md §4` → Task 4; §5 → Task 5. `demo_validation.md` five questions → Task 7.
- **Type consistency:** `AarFacts`, `AarNarrative`, `SessionSummary`, `RecommendInput`, `build_aar`, `aggregate_performance`, `build_recommendation`, `get_narrator` names are used identically across tasks. `AAR`/`PerformanceProfile`/`RecommendResponse` field names match `openapi.yaml` exactly.
- **Edge cases covered by tests:** empty scenario history, active-only trainee, missed threat, false alarm, wrong classification, wrong response, night/multi-threat weakness, clamping, template fallback, bad LLM JSON.
- **Known limitation:** `/performance` and `/recommend` recompute from all of a trainee's completed sessions (no pagination); acceptable at prototype scale.
