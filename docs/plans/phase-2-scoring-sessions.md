# Phase 2 — Scoring + Events + SQLite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the deterministic scenario engine into a stateful training backend: record timestamped trainee events, persist sessions/events/scores in SQLite, and score a session server-side from its events.

**Architecture:** A pure, deterministic scoring function (`score`) evaluates client-recorded events against the scenario ground truth — the client never scores. SQLAlchemy 2.x ORM tables (`scenarios`, `sessions`, `events`, `scores`, `performance_profiles`) persist state in SQLite. FastAPI routers expose `POST /sessions`, `POST /sessions/{id}/events`, `POST /sessions/{id}/complete`; scenarios are persisted by the existing generate route so sessions can resolve their `scenario_id`.

**Tech Stack:** Python 3.12 · FastAPI 0.143 · Pydantic 2.14 · SQLAlchemy 2.1 · SQLite · pytest 9

**Spec:** `docs/modules/scoring_engine.md`, `docs/modules/event_and_data_model.md`, `docs/api/api_specification.md`, `docs/api/openapi.yaml` (frozen contract), `docs/guides/testing_validation.md` (§1 integration, §3 scoring branches, §8 scoring_version)

## Global Constraints

- **API base:** `/api/v1`, `application/json`; validate every request; reject unknown enum values; never trust a client-provided score (`docs/api/api_specification.md §9`).
- **Contract is binding:** every implemented route and response shape must exist in `docs/api/openapi.yaml`; the conformance test enforces this.
- **Authority split:** client records observable events only; the server computes `final_score` from events (`docs/modules/scoring_engine.md §11`).
- **Determinism:** `score()` is a pure function — same `scenario` + `events` ⇒ identical `ScoreResult`. No wall-clock, no randomness.
- **Scoring values (verbatim):** weights 30/30/25/15 (detection/classification/response/timing); false-alarm penalty `-5`; `final_score` clamped to `0–100`; `scoring_version = 1` (`docs/api/openapi.yaml`, `docs/modules/scoring_engine.md §2/§3/§7`).
- **Git:** direct commits to `main`, Conventional Commits, commit after every task, push at phase end (`docs/project-management/git_workflow.md`).
- **Quality gate:** `pytest` green (pristine, no warnings) + `git status` clean before any phase-complete claim.
- **Offline-first:** localhost only; SQLite file `./aerovigil.db` (git-ignored).
- **No new dependencies:** SQLAlchemy is already pinned (requirements.txt). Do not add or upgrade packages.

### Locked design decisions (agreed with the user, 2026-10-09)

1. **Multi-threat aggregation = proportional.** Each score component = `(correct threats / total threats) × component_max`. Detection counts a threat as correct if a `THREAT_DETECTED` event exists for its id; classification requires a correct `CLASSIFICATION_SUBMITTED` on a detected threat; response requires a correct `RESPONSE_SUBMITTED` on a correctly-classified threat (the §8 decision tree).
2. **Timing = detection→response latency, fixed thresholds.** Per threat, `latency_ms = RESPONSE_SUBMITTED.timestamp_ms − THREAT_DETECTED.timestamp_ms`, and the timing points follow the §6 curve with `target = 3000 ms` (15), `≤ 6000 ms` (10), `≤ 9000 ms` (5), else 0. Timing contributes only for threats that reached a correct response.
3. **Scenarios persist on generate.** `POST /scenarios/generate` writes the produced `Scenario` to the `scenarios` table (idempotent on `scenario_id`); `POST /sessions` resolves `scenario_id` from that table and returns `404` when absent.

> Signature note: the roadmap sketches `score(scenario, events) -> ScoreResult`, but `ScoreResult` requires `session_id`, so the service is `score(session_id, scenario, events) -> ScoreResult`. This is an intentional extension, not drift.

### Deviation / forward note

- The spec's optional `distraction_factor` (deferred in Phase 1) remains omitted; no distraction mechanic exists yet. Revisit in Phase 5.

---

## File Structure

```text
backend/
  app/config.py                 (new)  env-overridable DATABASE_URL
  app/db/__init__.py            (new)  package marker
  app/db/database.py            (new)  Base, engine, SessionLocal, get_db, init_db
  app/db/models.py              (new)  ScenarioRow, SessionRow, EventRow, ScoreRow, PerformanceProfileRow
  app/schemas/events.py         (new)  EventType, EventCreateRequest, EventCreated
  app/schemas/scoring.py        (new)  ScoreResult
  app/schemas/session.py        (new)  SessionStatus, SessionCreateRequest, SessionCreated, CompleteResponse
  app/services/scoring.py       (new)  score() pure function + timing_points
  app/api/scenarios.py          (mod)  persist generated scenario
  app/api/sessions.py           (new)  create session / submit event / complete
  app/main.py                   (mod)  lifespan init_db + mount sessions router
  tests/conftest.py             (new)  db_engine, db_session, client fixtures
  tests/test_db_models.py       (new)  Task 1
  tests/test_event_schemas.py   (new)  Task 2
  tests/test_scoring.py         (new)  Task 3
  tests/golden/scoring_cases.json (new) Task 4
  tests/test_scoring_golden.py  (new)  Task 4
  tests/test_scenarios_api.py   (mod)  Task 5 (use isolated DB)
  tests/test_scenario_persistence.py (new) Task 5
  tests/test_sessions_api.py    (new)  Tasks 6-7
  tests/test_integration_scoring.py (new) Task 8
```

Each router owns one resource; services hold pure logic; schemas mirror the contract. Run all tests from `backend/`.

---

### Task 1: Config, DB engine, ORM models, and test fixtures

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/database.py`
- Create: `backend/app/db/models.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_db_models.py`

**Interfaces:**
- Consumes: `app.schemas.scenario.Scenario` / `ThreatProfile` (Phase 1).
- Produces:
  - `app.config.DATABASE_URL: str`
  - `app.db.database.Base`, `engine`, `SessionLocal`, `init_db() -> None`, `get_db() -> Iterator[Session]`
  - `app.db.models.ScenarioRow.from_schema(scenario: Scenario) -> ScenarioRow`, `ScenarioRow.to_schema() -> Scenario`
  - `app.db.models.SessionRow`, `EventRow`, `ScoreRow`, `PerformanceProfileRow`
  - test fixtures `db_engine`, `db_session` in `tests/conftest.py`

Note: `EventRow` is created here; its `event_row_to_request()` mapper is added in Task 6 (first place it is consumed).

- [ ] **Step 1: Write the failing test** — `backend/tests/conftest.py`

```python
from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base


@pytest.fixture
def db_engine(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    factory = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 2: Write the failing test** — `backend/tests/test_db_models.py`

```python
from __future__ import annotations

from sqlalchemy import inspect

from app.db.models import (
    EventRow,
    PerformanceProfileRow,
    ScenarioRow,
    ScoreRow,
    SessionRow,
)
from app.schemas.scenario import Scenario


def _scenario() -> Scenario:
    return Scenario(
        scenario_id="SCN-000001",
        seed=1,
        generator_version="1.0",
        difficulty=3,
        environment="rural",
        time_of_day="day",
        visibility="clear",
        sensor_quality=0.9,
        duration_seconds=120.0,
        threats=[
            {
                "id": "T01",
                "classification_label": "hostile",
                "expected_response": "hold",
                "spawn_time": 10.0,
                "speed_class": "fast",
            }
        ],
    )


def test_all_expected_tables_exist(db_engine) -> None:
    names = set(inspect(db_engine).get_table_names())
    assert {"scenarios", "sessions", "events", "scores", "performance_profiles"} <= names


def test_scenario_row_round_trips(db_session) -> None:
    scenario = _scenario()
    db_session.add(ScenarioRow.from_schema(scenario))
    db_session.commit()
    row = db_session.get(ScenarioRow, scenario.scenario_id)
    assert row is not None
    assert row.to_schema() == scenario


def test_session_event_score_and_profile_rows(db_session) -> None:
    scenario = _scenario()
    db_session.add(ScenarioRow.from_schema(scenario))
    db_session.add(
        SessionRow(
            session_id="SES-TEST0001",
            trainee_id="TRAIN-001",
            scenario_id=scenario.scenario_id,
            status="active",
        )
    )
    db_session.add(
        EventRow(
            event_id="EVT-001",
            session_id="SES-TEST0001",
            timestamp_ms=1000,
            type="THREAT_DETECTED",
            threat_id="T01",
            payload_json="{}",
        )
    )
    db_session.add(
        ScoreRow(
            session_id="SES-TEST0001",
            detection_score=30.0,
            classification_score=30.0,
            response_score=25.0,
            timing_score=15.0,
            penalty=0.0,
            final_score=100.0,
            scoring_version=1,
        )
    )
    db_session.add(PerformanceProfileRow(trainee_id="TRAIN-001", session_count=1))
    db_session.commit()

    assert db_session.get(SessionRow, "SES-TEST0001").status == "active"
    assert db_session.get(EventRow, "EVT-001").type == "THREAT_DETECTED"
    assert db_session.get(ScoreRow, "SES-TEST0001").final_score == 100.0
    assert db_session.get(PerformanceProfileRow, "TRAIN-001").session_count == 1
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `backend/`): `.venv/Scripts/python -m pytest tests/test_db_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.db'`

- [ ] **Step 4: Implement** — `backend/app/config.py`

```python
"""Runtime configuration (offline-first, env-overridable)."""

from __future__ import annotations

import os

DATABASE_URL: str = os.environ.get(
    "AEROVIGIL_DATABASE_URL", "sqlite:///./aerovigil.db"
)
```

- [ ] **Step 5: Implement** — `backend/app/db/__init__.py`

```python
"""Database package (engine, session, ORM models)."""
```

- [ ] **Step 6: Implement** — `backend/app/db/database.py`

```python
"""SQLAlchemy engine, session factory, base metadata and lifecycle hooks."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


def _connect_args(url: str) -> dict[str, object]:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


engine = create_engine(DATABASE_URL, connect_args=_connect_args(DATABASE_URL))

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    from app.db import models  # noqa: F401  (register table metadata)

    Base.metadata.create_all(bind=engine)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 7: Implement** — `backend/app/db/models.py`

```python
"""ORM models: scenarios, sessions, events, scores, performance_profiles."""

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.schemas.scenario import Scenario, ThreatProfile


class ScenarioRow(Base):
    __tablename__ = "scenarios"

    scenario_id: Mapped[str] = mapped_column(String, primary_key=True)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    generator_version: Mapped[str] = mapped_column(String, nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    environment: Mapped[str] = mapped_column(String, nullable=False)
    time_of_day: Mapped[str] = mapped_column(String, nullable=False)
    visibility: Mapped[str] = mapped_column(String, nullable=False)
    sensor_quality: Mapped[float] = mapped_column(Float, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    threats_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    @classmethod
    def from_schema(cls, scenario: Scenario) -> "ScenarioRow":
        return cls(
            scenario_id=scenario.scenario_id,
            seed=scenario.seed,
            generator_version=scenario.generator_version,
            difficulty=scenario.difficulty,
            environment=scenario.environment.value,
            time_of_day=scenario.time_of_day.value,
            visibility=scenario.visibility.value,
            sensor_quality=scenario.sensor_quality,
            duration_seconds=scenario.duration_seconds,
            threats_json=json.dumps(
                [threat.model_dump(mode="json") for threat in scenario.threats]
            ),
        )

    def to_schema(self) -> Scenario:
        return Scenario(
            scenario_id=self.scenario_id,
            seed=self.seed,
            generator_version=self.generator_version,
            difficulty=self.difficulty,
            environment=self.environment,
            time_of_day=self.time_of_day,
            visibility=self.visibility,
            sensor_quality=self.sensor_quality,
            duration_seconds=self.duration_seconds,
            threats=[ThreatProfile(**d) for d in json.loads(self.threats_json)],
        )


class SessionRow(Base):
    __tablename__ = "sessions"

    session_id: Mapped[str] = mapped_column(String, primary_key=True)
    trainee_id: Mapped[str] = mapped_column(String, nullable=False)
    scenario_id: Mapped[str] = mapped_column(
        ForeignKey("scenarios.scenario_id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    final_score: Mapped[float | None] = mapped_column(Float, nullable=True)


class EventRow(Base):
    __tablename__ = "events"

    event_id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.session_id"), nullable=False
    )
    timestamp_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    threat_id: Mapped[str | None] = mapped_column(String, nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")


class ScoreRow(Base):
    __tablename__ = "scores"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.session_id"), primary_key=True
    )
    detection_score: Mapped[float] = mapped_column(Float, nullable=False)
    classification_score: Mapped[float] = mapped_column(Float, nullable=False)
    response_score: Mapped[float] = mapped_column(Float, nullable=False)
    timing_score: Mapped[float] = mapped_column(Float, nullable=False)
    penalty: Mapped[float] = mapped_column(Float, nullable=False)
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    scoring_version: Mapped[int] = mapped_column(Integer, nullable=False)


class PerformanceProfileRow(Base):
    __tablename__ = "performance_profiles"

    trainee_id: Mapped[str] = mapped_column(String, primary_key=True)
    session_count: Mapped[int] = mapped_column(Integer, default=0)
    detection_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    classification_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    response_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    average_reaction_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    night_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    day_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    multi_threat_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    low_visibility_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_level: Mapped[int] = mapped_column(Integer, default=1)
```

- [ ] **Step 8: Implement lifespan init** — `backend/app/main.py` (final content for this task)

```python
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.scenarios import router as scenarios_router
from app.db.database import init_db
from app.services.anti_repetition import RecentConfigTracker


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AEROVIGIL API", version="1.0.0", lifespan=lifespan)
app.state.recent_configs = RecentConfigTracker()

app.include_router(scenarios_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

Note: tests use isolated engines via the `get_db` override (Task 5) and never run lifespan, so no `aerovigil.db` file is created during tests.

- [ ] **Step 9: Run tests to verify they pass**

Run (from `backend/`): `.venv/Scripts/python -m pytest tests/test_db_models.py -v`
Expected: PASS (3 tests)
Then run the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS (existing 44 + 3 = 47), pristine.

- [ ] **Step 10: Commit**

```bash
git add backend/app/config.py backend/app/db/__init__.py backend/app/db/database.py backend/app/db/models.py backend/app/main.py backend/tests/conftest.py backend/tests/test_db_models.py
git commit -m "feat(db): add SQLAlchemy models and SQLite foundation"
```

---

### Task 2: Event schema

**Files:**
- Create: `backend/app/schemas/events.py`
- Create: `backend/tests/test_event_schemas.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `EventType` (str Enum, 12 members, values = the contract strings)
  - `EventCreateRequest(BaseModel)`: `type: EventType`, `timestamp_ms: int ≥ 0`, `threat_id: str | None = None`, `payload: dict` (default `{}`)
  - `EventCreated(BaseModel)`: `event_id: str`, `accepted: bool`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_event_schemas.py`

```python
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.events import EventCreateRequest, EventCreated, EventType

CONTRACT_TYPES = {
    "SESSION_STARTED",
    "SCENARIO_LOADED",
    "THREAT_SPAWNED",
    "THREAT_DETECTED",
    "CLASSIFICATION_SUBMITTED",
    "RESPONSE_SUBMITTED",
    "FALSE_ALARM",
    "THREAT_MISSED",
    "THREAT_RESOLVED",
    "SESSION_PAUSED",
    "SESSION_RESUMED",
    "SESSION_COMPLETED",
}


def test_event_type_has_all_contract_values() -> None:
    assert {member.value for member in EventType} == CONTRACT_TYPES


def test_event_create_accepts_valid_payload() -> None:
    event = EventCreateRequest(
        type="CLASSIFICATION_SUBMITTED",
        timestamp_ms=2000,
        threat_id="T01",
        payload={"label": "hostile"},
    )
    assert event.type is EventType.CLASSIFICATION_SUBMITTED
    assert event.payload == {"label": "hostile"}


def test_event_create_defaults_payload_and_threat_id() -> None:
    event = EventCreateRequest(type="SESSION_STARTED", timestamp_ms=0)
    assert event.threat_id is None
    assert event.payload == {}


def test_event_create_rejects_unknown_type() -> None:
    with pytest.raises(ValidationError):
        EventCreateRequest(type="NOT_A_TYPE", timestamp_ms=0)


def test_event_create_rejects_negative_timestamp() -> None:
    with pytest.raises(ValidationError):
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=-1)


def test_event_created_shape() -> None:
    created = EventCreated(event_id="EVT-001", accepted=True)
    assert created.event_id == "EVT-001"
    assert created.accepted is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_event_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.events'`

- [ ] **Step 3: Implement** — `backend/app/schemas/events.py`

```python
"""Pydantic models mirroring the frozen v1 event contract.

Source of truth: docs/api/openapi.yaml (EventCreateRequest, EventCreated).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class EventType(str, Enum):
    SESSION_STARTED = "SESSION_STARTED"
    SCENARIO_LOADED = "SCENARIO_LOADED"
    THREAT_SPAWNED = "THREAT_SPAWNED"
    THREAT_DETECTED = "THREAT_DETECTED"
    CLASSIFICATION_SUBMITTED = "CLASSIFICATION_SUBMITTED"
    RESPONSE_SUBMITTED = "RESPONSE_SUBMITTED"
    FALSE_ALARM = "FALSE_ALARM"
    THREAT_MISSED = "THREAT_MISSED"
    THREAT_RESOLVED = "THREAT_RESOLVED"
    SESSION_PAUSED = "SESSION_PAUSED"
    SESSION_RESUMED = "SESSION_RESUMED"
    SESSION_COMPLETED = "SESSION_COMPLETED"


class EventCreateRequest(BaseModel):
    type: EventType
    timestamp_ms: int = Field(ge=0)
    threat_id: str | None = None
    payload: dict = Field(default_factory=dict)


class EventCreated(BaseModel):
    event_id: str
    accepted: bool
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_event_schemas.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/events.py backend/tests/test_event_schemas.py
git commit -m "feat(schemas): add event type enum and event models"
```

---

### Task 3: Scoring service (pure function)

**Files:**
- Create: `backend/app/schemas/scoring.py`
- Create: `backend/app/services/scoring.py`
- Create: `backend/tests/test_scoring.py`

**Interfaces:**
- Consumes: `app.schemas.events.EventCreateRequest` / `EventType`, `app.schemas.scenario.Scenario` / `ThreatProfile`.
- Produces:
  - `app.schemas.scoring.ScoreResult(BaseModel)`: `session_id: str`, `detection_score`, `classification_score`, `response_score`, `timing_score`, `penalty`, `final_score` (all float, final `0–100`), `scoring_version: int`
  - `app.services.scoring.SCORING_VERSION = 1`
  - `timing_points(latency_ms: float) -> int`
  - `score(session_id: str, scenario: Scenario, events: list[EventCreateRequest]) -> ScoreResult`

- [ ] **Step 1: Write the failing test** — `backend/tests/test_scoring.py`

```python
from __future__ import annotations

from app.schemas.events import EventCreateRequest
from app.schemas.scenario import Scenario
from app.services.scoring import SCORING_VERSION, score, timing_points


def _scenario() -> Scenario:
    return Scenario(
        scenario_id="SCN-000001",
        seed=1,
        generator_version="1.0",
        difficulty=3,
        environment="rural",
        time_of_day="day",
        visibility="clear",
        sensor_quality=0.9,
        duration_seconds=120.0,
        threats=[
            {
                "id": "T01",
                "classification_label": "hostile",
                "expected_response": "hold",
                "spawn_time": 10.0,
            }
        ],
    )


def test_timing_points_curve() -> None:
    assert timing_points(0) == 15
    assert timing_points(3000) == 15
    assert timing_points(3001) == 10
    assert timing_points(6000) == 10
    assert timing_points(6001) == 5
    assert timing_points(9000) == 5
    assert timing_points(9001) == 0


def test_perfect_session_scores_100() -> None:
    events = [
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=1000, threat_id="T01"),
        EventCreateRequest(
            type="CLASSIFICATION_SUBMITTED",
            timestamp_ms=2000,
            threat_id="T01",
            payload={"label": "hostile"},
        ),
        EventCreateRequest(
            type="RESPONSE_SUBMITTED",
            timestamp_ms=3000,
            threat_id="T01",
            payload={"response": "hold"},
        ),
    ]
    result = score("SES-TEST", _scenario(), events)
    assert result.final_score == 100.0
    assert result.scoring_version == SCORING_VERSION == 1


def test_score_is_pure_and_clamped_at_zero() -> None:
    events = [EventCreateRequest(type="FALSE_ALARM", timestamp_ms=100, payload={})]
    first = score("SES-TEST", _scenario(), events)
    second = score("SES-TEST", _scenario(), events)
    assert first == second
    assert first.detection_score == 0.0
    assert first.penalty == 5.0
    assert first.final_score == 0.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.scoring'`

- [ ] **Step 3: Implement** — `backend/app/schemas/scoring.py`

```python
"""Pydantic model mirroring the frozen v1 ScoreResult contract."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScoreResult(BaseModel):
    session_id: str
    detection_score: float
    classification_score: float
    response_score: float
    timing_score: float
    penalty: float
    final_score: float = Field(ge=0, le=100)
    scoring_version: int
```

- [ ] **Step 4: Implement** — `backend/app/services/scoring.py`

```python
"""Deterministic, explainable scoring engine.

A pure function of (scenario ground truth, recorded events). The client
never scores; the server evaluates observable events against the scenario
(docs/modules/scoring_engine.md §11).

Multi-threat aggregation is proportional: each component earns
(correct threats / total threats) × component_max. Timing follows the §6
curve on the detection→response latency of correctly-responded threats.

Source of truth: docs/modules/scoring_engine.md, docs/api/openapi.yaml.
"""

from __future__ import annotations

from app.schemas.events import EventCreateRequest, EventType
from app.schemas.scenario import Scenario
from app.schemas.scoring import ScoreResult

SCORING_VERSION = 1

DETECTION_MAX = 30
CLASSIFICATION_MAX = 30
RESPONSE_MAX = 25
TIMING_MAX = 15
FALSE_ALARM_PENALTY = 5

TARGET_MS = 3000
TOLERANCE_MS = 3000
MAX_MS = 9000

_TIMING_TIERS: tuple[tuple[float, int], ...] = (
    (TARGET_MS, 15),
    (TARGET_MS + TOLERANCE_MS, 10),
    (MAX_MS, 5),
)


def timing_points(latency_ms: float) -> int:
    for limit, points in _TIMING_TIERS:
        if latency_ms <= limit:
            return points
    return 0


def _first_event(
    events: list[EventCreateRequest], event_type: EventType, threat_id: str
) -> EventCreateRequest | None:
    for event in events:
        if event.type is event_type and event.threat_id == threat_id:
            return event
    return None


def _round2(value: float) -> float:
    return round(value, 2)


def score(
    session_id: str, scenario: Scenario, events: list[EventCreateRequest]
) -> ScoreResult:
    total = len(scenario.threats)
    detected_count = 0
    classification_count = 0
    response_count = 0
    timing_total = 0.0

    if total > 0:
        for threat in scenario.threats:
            detection = _first_event(events, EventType.THREAT_DETECTED, threat.id)
            if detection is None:
                continue
            detected_count += 1

            classification = _first_event(
                events, EventType.CLASSIFICATION_SUBMITTED, threat.id
            )
            label = classification.payload.get("label") if classification else None
            if label != threat.classification_label.value:
                continue
            classification_count += 1

            response = _first_event(events, EventType.RESPONSE_SUBMITTED, threat.id)
            response_value = response.payload.get("response") if response else None
            if response_value != threat.expected_response.value:
                continue
            response_count += 1

            latency_ms = response.timestamp_ms - detection.timestamp_ms
            timing_total += timing_points(max(latency_ms, 0))

    false_alarms = sum(1 for e in events if e.type is EventType.FALSE_ALARM)

    detection_score = _round2(DETECTION_MAX * detected_count / total) if total else 0.0
    classification_score = (
        _round2(CLASSIFICATION_MAX * classification_count / total) if total else 0.0
    )
    response_score = _round2(RESPONSE_MAX * response_count / total) if total else 0.0
    timing_score = _round2(timing_total / total) if total else 0.0
    penalty = _round2(FALSE_ALARM_PENALTY * false_alarms)
    final = _round2(
        detection_score + classification_score + response_score + timing_score - penalty
    )
    final = max(0.0, min(100.0, final))

    return ScoreResult(
        session_id=session_id,
        detection_score=detection_score,
        classification_score=classification_score,
        response_score=response_score,
        timing_score=timing_score,
        penalty=penalty,
        final_score=final,
        scoring_version=SCORING_VERSION,
    )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_scoring.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/scoring.py backend/app/services/scoring.py backend/tests/test_scoring.py
git commit -m "feat(scoring): add pure proportional scoring engine"
```

---

### Task 4: Golden-file scoring conformance suite

**Files:**
- Create: `backend/tests/golden/scoring_cases.json`
- Create: `backend/tests/test_scoring_golden.py`

**Interfaces:**
- Consumes: `app.services.scoring.score`, `app.schemas.scenario.Scenario`, `app.schemas.events.EventCreateRequest`.
- Produces: a data-driven suite covering every §8 decision-tree branch and every `testing_validation.md §3` scoring branch.

- [ ] **Step 1: Write the failing test** — `backend/tests/test_scoring_golden.py`

```python
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.schemas.events import EventCreateRequest
from app.schemas.scenario import Scenario
from app.services.scoring import score

GOLDEN = Path(__file__).parent / "golden" / "scoring_cases.json"
CASES = json.loads(GOLDEN.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_golden_scoring_case(case: dict) -> None:
    scenario = Scenario(**case["scenario"])
    events = [EventCreateRequest(**event) for event in case["events"]]
    result = score("SES-TEST", scenario, events)
    assert result.model_dump(exclude={"session_id"}) == case["expected"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_scoring_golden.py -v`
Expected: FAIL — `FileNotFoundError` at import (`CASES = json.loads(GOLDEN.read_text(...))`) because `golden/scoring_cases.json` does not exist yet.

- [ ] **Step 3: Write the golden fixture** — `backend/tests/golden/scoring_cases.json`

Single-threat base (`difficulty 3`, rural/day/clear) unless the case overrides `threats`.

```json
[
  {
    "name": "correct_detection_fast",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 3000, "threat_id": "T01", "payload": {"response": "hold"}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 30.0, "response_score": 25.0, "timing_score": 15.0, "penalty": 0.0, "final_score": 100.0, "scoring_version": 1}
  },
  {
    "name": "missed_threat",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [],
    "expected": {"detection_score": 0.0, "classification_score": 0.0, "response_score": 0.0, "timing_score": 0.0, "penalty": 0.0, "final_score": 0.0, "scoring_version": 1}
  },
  {
    "name": "false_alarm_penalty",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 3000, "threat_id": "T01", "payload": {"response": "hold"}},
      {"type": "FALSE_ALARM", "timestamp_ms": 5000, "threat_id": null, "payload": {}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 30.0, "response_score": 25.0, "timing_score": 15.0, "penalty": 5.0, "final_score": 95.0, "scoring_version": 1}
  },
  {
    "name": "wrong_classification",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "unknown"}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 0.0, "response_score": 0.0, "timing_score": 0.0, "penalty": 0.0, "final_score": 30.0, "scoring_version": 1}
  },
  {
    "name": "correct_classification_wrong_response",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 3000, "threat_id": "T01", "payload": {"response": "monitor"}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 30.0, "response_score": 0.0, "timing_score": 0.0, "penalty": 0.0, "final_score": 60.0, "scoring_version": 1}
  },
  {
    "name": "mid_response",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 5000, "threat_id": "T01", "payload": {"response": "hold"}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 30.0, "response_score": 25.0, "timing_score": 10.0, "penalty": 0.0, "final_score": 95.0, "scoring_version": 1}
  },
  {
    "name": "slow_response_boundary",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 10000, "threat_id": "T01", "payload": {"response": "hold"}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 30.0, "response_score": 25.0, "timing_score": 5.0, "penalty": 0.0, "final_score": 90.0, "scoring_version": 1}
  },
  {
    "name": "over_max_response",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 11000, "threat_id": "T01", "payload": {"response": "hold"}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 30.0, "response_score": 25.0, "timing_score": 0.0, "penalty": 0.0, "final_score": 85.0, "scoring_version": 1}
  },
  {
    "name": "classification_without_detection",
    "scenario": {
      "scenario_id": "SCN-000001", "seed": 1, "generator_version": "1.0",
      "difficulty": 3, "environment": "rural", "time_of_day": "day",
      "visibility": "clear", "sensor_quality": 0.9, "duration_seconds": 120.0,
      "threats": [{"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"}]
    },
    "events": [
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}}
    ],
    "expected": {"detection_score": 0.0, "classification_score": 0.0, "response_score": 0.0, "timing_score": 0.0, "penalty": 0.0, "final_score": 0.0, "scoring_version": 1}
  },
  {
    "name": "proportional_partial",
    "scenario": {
      "scenario_id": "SCN-000002", "seed": 2, "generator_version": "1.0",
      "difficulty": 5, "environment": "urban", "time_of_day": "night",
      "visibility": "reduced", "sensor_quality": 0.5, "duration_seconds": 120.0,
      "threats": [
        {"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"},
        {"id": "T02", "classification_label": "friendly", "expected_response": "monitor", "spawn_time": 40.0, "speed_class": "medium"}
      ]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 3000, "threat_id": "T01", "payload": {"response": "hold"}},
      {"type": "THREAT_DETECTED", "timestamp_ms": 1500, "threat_id": "T02", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2500, "threat_id": "T02", "payload": {"label": "unknown"}}
    ],
    "expected": {"detection_score": 30.0, "classification_score": 15.0, "response_score": 12.5, "timing_score": 7.5, "penalty": 0.0, "final_score": 65.0, "scoring_version": 1}
  },
  {
    "name": "proportional_missed_and_perfect",
    "scenario": {
      "scenario_id": "SCN-000003", "seed": 3, "generator_version": "1.0",
      "difficulty": 5, "environment": "urban", "time_of_day": "night",
      "visibility": "reduced", "sensor_quality": 0.5, "duration_seconds": 120.0,
      "threats": [
        {"id": "T01", "classification_label": "hostile", "expected_response": "hold", "spawn_time": 10.0, "speed_class": "fast"},
        {"id": "T02", "classification_label": "suspicious", "expected_response": "report", "spawn_time": 40.0, "speed_class": "medium"}
      ]
    },
    "events": [
      {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01", "payload": {}},
      {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
      {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 3000, "threat_id": "T01", "payload": {"response": "hold"}}
    ],
    "expected": {"detection_score": 15.0, "classification_score": 15.0, "response_score": 12.5, "timing_score": 7.5, "penalty": 0.0, "final_score": 50.0, "scoring_version": 1}
  }
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_scoring_golden.py -v`
Expected: PASS (11 cases).

- [ ] **Step 5: Run the full suite**

Run: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/golden/scoring_cases.json backend/tests/test_scoring_golden.py
git commit -m "test(scoring): add golden-file branch coverage suite"
```

---

### Task 5: Persist scenarios on generate (isolated DB in tests)

**Files:**
- Modify: `backend/app/api/scenarios.py`
- Modify: `backend/tests/conftest.py` (add `client` fixture)
- Modify: `backend/tests/test_scenarios_api.py` (use fixture; drop module-level client)
- Create: `backend/tests/test_scenario_persistence.py`

**Interfaces:**
- Consumes: `app.db.database.get_db`, `app.db.models.ScenarioRow`, existing generator/anti-repetition/validator.
- Produces: `client` pytest fixture (TestClient with `get_db` overridden to the isolated `db_session`); `POST /scenarios/generate` now persists the scenario (idempotent on `scenario_id`).

- [ ] **Step 1: Extend the failing test** — append the `client` fixture to `backend/tests/conftest.py`

```python
from fastapi.testclient import TestClient

from app.db.database import get_db
from app.main import app
from app.services.anti_repetition import RecentConfigTracker


@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    app.state.recent_configs = RecentConfigTracker()
    yield TestClient(app)
    app.dependency_overrides.clear()
    app.state.recent_configs = RecentConfigTracker()
```

(Merge the imports at the top of the file with the existing ones.)

- [ ] **Step 2: Write the failing test** — `backend/tests/test_scenario_persistence.py`

```python
from __future__ import annotations

from app.db.models import ScenarioRow


def test_generate_persists_scenario(client, db_session) -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 6,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 2,
            "seed": 12345,
        },
    )
    assert response.status_code == 200
    scenario_id = response.json()["scenario_id"]
    row = db_session.get(ScenarioRow, scenario_id)
    assert row is not None
    assert row.to_schema().model_dump(mode="json") == response.json()


def test_regenerate_same_seed_is_idempotent(client, db_session) -> None:
    payload = {
        "difficulty": 6,
        "environment": "urban",
        "time_of_day": "night",
        "threat_count": 2,
        "seed": 999,
    }
    client.post("/api/v1/scenarios/generate", json=payload)
    client.post("/api/v1/scenarios/generate", json=payload)
    count = db_session.query(ScenarioRow).filter(ScenarioRow.seed == 999).count()
    assert count == 1
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_scenario_persistence.py -v`
Expected: FAIL — persistence not implemented, `row is None`.

- [ ] **Step 4: Implement** — `backend/app/api/scenarios.py`

```python
"""Scenario generation HTTP route (POST /scenarios/generate)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ScenarioRow
from app.schemas.scenario import Scenario, ScenarioGenerateRequest
from app.services.anti_repetition import (
    RecentConfigTracker,
    generate_with_anti_repetition,
)
from app.services.scenario_generator import InfeasibleScenarioError
from app.services.scenario_validator import ScenarioValidationError, validate_scenario

router = APIRouter(tags=["scenarios"])


@router.post("/scenarios/generate", response_model=Scenario)
def generate_scenario_route(
    body: ScenarioGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> Scenario:
    tracker: RecentConfigTracker = request.app.state.recent_configs
    try:
        scenario = generate_with_anti_repetition(body, tracker)
        validate_scenario(scenario)
    except (InfeasibleScenarioError, ScenarioValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if db.get(ScenarioRow, scenario.scenario_id) is None:
        db.add(ScenarioRow.from_schema(scenario))
        db.commit()
    return scenario
```

- [ ] **Step 5: Migrate the existing API tests to the fixture** — `backend/tests/test_scenarios_api.py`

Remove `client = TestClient(app)` and the module-level import of `app`/`TestClient`; drive every test off the `client` fixture parameter. Also remove the now-redundant `_reset_recent_configs` autouse fixture (the `client` fixture resets the tracker). Final content:

```python
def test_generate_returns_contract_shaped_scenario(client) -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 6,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 2,
            "seed": 12345,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["seed"] == 12345
    assert body["scenario_id"] == "SCN-012345"
    assert body["generator_version"] == "1.0"
    assert body["difficulty"] == 6
    assert len(body["threats"]) == 2


def test_generate_is_deterministic_for_same_seed(client) -> None:
    payload = {
        "difficulty": 6,
        "environment": "urban",
        "time_of_day": "night",
        "threat_count": 2,
        "seed": 12345,
    }
    first = client.post("/api/v1/scenarios/generate", json=payload).json()
    second = client.post("/api/v1/scenarios/generate", json=payload).json()
    assert first == second


def test_generate_without_seed_returns_scenario(client) -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 6, "environment": "rural", "time_of_day": "day", "threat_count": 1},
    )
    assert response.status_code == 200
    assert response.json()["seed"] is not None


def test_generate_rejects_infeasible_configuration(client) -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 1,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 5,
        },
    )
    assert response.status_code == 422


def test_generate_rejects_invalid_threat_count(client) -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 5, "environment": "urban", "time_of_day": "day", "threat_count": 4},
    )
    assert response.status_code == 422
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests/test_scenarios_api.py tests/test_scenario_persistence.py -v`
Expected: PASS
Then the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine; no `aerovigil.db` created in `backend/`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/scenarios.py backend/tests/conftest.py backend/tests/test_scenarios_api.py backend/tests/test_scenario_persistence.py
git commit -m "feat(api): persist generated scenarios to SQLite"
```

---

### Task 6: Session and event endpoints

**Files:**
- Create: `backend/app/schemas/session.py`
- Create: `backend/app/api/sessions.py`
- Modify: `backend/app/db/models.py` (add module-level `event_row_to_request(row) -> EventCreateRequest`)
- Modify: `backend/app/main.py` (mount sessions router)
- Create: `backend/tests/test_sessions_api.py`

**Interfaces:**
- Consumes: `app.db.models.{ScenarioRow, SessionRow, EventRow}`, `app.schemas.events.{EventCreateRequest, EventCreated, EventType}`, `app.db.database.get_db`.
- Produces:
  - `app.schemas.session`: `SessionCreateRequest`, `SessionCreated` (`status: Literal["active"]`), `CompleteResponse`
  - `app.db.models.event_row_to_request(row: EventRow) -> EventCreateRequest`
  - `POST /api/v1/sessions` → 201 `SessionCreated` | 404 unknown scenario | 422 invalid body
  - `POST /api/v1/sessions/{session_id}/events` → 201 `EventCreated` | 404 unknown session | 422 invalid body / unknown threat_id / completed session

- [ ] **Step 1: Write the failing test** — `backend/tests/test_sessions_api.py`

```python
from __future__ import annotations


def _create_scenario(client, seed: int = 12345) -> str:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 6,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 2,
            "seed": seed,
        },
    )
    assert response.status_code == 200
    return response.json()["scenario_id"]


def test_create_session_returns_active_session(client) -> None:
    scenario_id = _create_scenario(client)
    response = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["session_id"].startswith("SES-")
    assert body["status"] == "active"


def test_create_session_unknown_scenario_returns_404(client) -> None:
    response = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": "SCN-DOESNOTEXIST"},
    )
    assert response.status_code == 404


def test_create_session_invalid_body_returns_422(client) -> None:
    response = client.post("/api/v1/sessions", json={"trainee_id": "TRAIN-001"})
    assert response.status_code == 422


def test_submit_event_returns_event_id(client) -> None:
    scenario_id = _create_scenario(client)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01"},
    )
    assert response.status_code == 201
    assert response.json() == {"event_id": "EVT-001", "accepted": True}


def test_submit_event_unknown_session_returns_404(client) -> None:
    response = client.post(
        "/api/v1/sessions/SES-NOPE/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "unknown session_id: SES-NOPE"


def test_submit_event_unknown_threat_returns_422(client) -> None:
    scenario_id = _create_scenario(client)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T99"},
    )
    assert response.status_code == 422


def test_submit_event_invalid_type_returns_422(client) -> None:
    scenario_id = _create_scenario(client)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "NOT_A_TYPE", "timestamp_ms": 1000},
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_sessions_api.py -v`
Expected: FAIL — 404 for all (routes not mounted) / `ModuleNotFoundError`.

- [ ] **Step 3: Implement** — `backend/app/schemas/session.py`

```python
"""Pydantic models mirroring the frozen v1 session contract.

Source of truth: docs/api/openapi.yaml (SessionCreateRequest, SessionCreated,
CompleteResponse).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    trainee_id: str
    scenario_id: str


class SessionCreated(BaseModel):
    session_id: str
    status: Literal["active"] = "active"


class CompleteResponse(BaseModel):
    session_id: str
    final_score: float = Field(ge=0, le=100)
    aar_available: bool
    scoring_version: int
```

- [ ] **Step 4: Add the event mapper** — append to `backend/app/db/models.py`

```python
from app.schemas.events import EventCreateRequest, EventType  # add to imports


def event_row_to_request(row: EventRow) -> EventCreateRequest:
    return EventCreateRequest(
        type=EventType(row.type),
        timestamp_ms=row.timestamp_ms,
        threat_id=row.threat_id,
        payload=json.loads(row.payload_json),
    )
```

- [ ] **Step 5: Implement** — `backend/app/api/sessions.py`

```python
"""Session lifecycle HTTP routes: create, record events, complete."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import EventRow, ScenarioRow, SessionRow
from app.schemas.events import EventCreateRequest, EventCreated
from app.schemas.session import SessionCreateRequest, SessionCreated

router = APIRouter(tags=["sessions"])


def _new_session_id() -> str:
    return f"SES-{uuid.uuid4().hex[:8].upper()}"


def _threat_ids(scenario: ScenarioRow) -> set[str]:
    return {threat["id"] for threat in json.loads(scenario.threats_json)}


@router.post("/sessions", response_model=SessionCreated, status_code=201)
def create_session(
    body: SessionCreateRequest, db: Session = Depends(get_db)
) -> SessionCreated:
    scenario = db.get(ScenarioRow, body.scenario_id)
    if scenario is None:
        raise HTTPException(
            status_code=404, detail=f"unknown scenario_id: {body.scenario_id}"
        )
    session = SessionRow(
        session_id=_new_session_id(),
        trainee_id=body.trainee_id,
        scenario_id=body.scenario_id,
        status="active",
    )
    db.add(session)
    db.commit()
    return SessionCreated(session_id=session.session_id, status="active")


@router.post(
    "/sessions/{session_id}/events", response_model=EventCreated, status_code=201
)
def submit_event(
    session_id: str, body: EventCreateRequest, db: Session = Depends(get_db)
) -> EventCreated:
    session = db.get(SessionRow, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"unknown session_id: {session_id}")
    if session.status == "completed":
        raise HTTPException(status_code=422, detail="session already completed")

    if body.threat_id is not None:
        scenario = db.get(ScenarioRow, session.scenario_id)
        if scenario is None or body.threat_id not in _threat_ids(scenario):
            raise HTTPException(
                status_code=422, detail=f"unknown threat_id: {body.threat_id}"
            )

    count = (
        db.query(EventRow).filter(EventRow.session_id == session_id).count()
    )
    event = EventRow(
        event_id=f"EVT-{count + 1:03d}",
        session_id=session_id,
        timestamp_ms=body.timestamp_ms,
        type=body.type.value,
        threat_id=body.threat_id,
        payload_json=json.dumps(body.payload),
    )
    db.add(event)
    db.commit()
    return EventCreated(event_id=event.event_id, accepted=True)
```

- [ ] **Step 6: Mount the router** — modify `backend/app/main.py`

Add the import and include line:

```python
from app.api.sessions import router as sessions_router
...
app.include_router(sessions_router, prefix="/api/v1")
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests/test_sessions_api.py -v`
Expected: PASS (7 tests)
Then the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/session.py backend/app/api/sessions.py backend/app/db/models.py backend/app/main.py backend/tests/test_sessions_api.py
git commit -m "feat(api): add session create and event submission endpoints"
```

---

### Task 7: Complete-session endpoint (server-side scoring)

**Files:**
- Modify: `backend/app/api/sessions.py`
- Modify: `backend/tests/test_sessions_api.py`

**Interfaces:**
- Consumes: `app.services.scoring.score`, `app.db.models.{ScoreRow, EventRow}`, `event_row_to_request`.
- Produces: `POST /api/v1/sessions/{session_id}/complete` → 200 `CompleteResponse` | 404 unknown session. Idempotent: a second call returns the stored score without recomputing.

- [ ] **Step 1: Write the failing test** — append to `backend/tests/test_sessions_api.py`

```python
def _complete_flow(client, seed: int = 12345) -> str:
    scenario_id = _create_scenario(client, seed)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    events = [
        {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01"},
        {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
        {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 3000, "threat_id": "T01", "payload": {"response": "hold"}},
    ]
    for event in events:
        assert client.post(f"/api/v1/sessions/{session_id}/events", json=event).status_code == 201
    return session_id


def test_complete_returns_server_side_score(client, db_session) -> None:
    from app.db.models import ScoreRow, SessionRow

    session_id = _complete_flow(client)
    response = client.post(f"/api/v1/sessions/{session_id}/complete")
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_id
    assert body["aar_available"] is True
    assert body["scoring_version"] == 1
    assert 0 <= body["final_score"] <= 100

    row = db_session.get(ScoreRow, session_id)
    assert row is not None
    assert row.final_score == body["final_score"]
    assert db_session.get(SessionRow, session_id).status == "completed"


def test_complete_is_idempotent(client, db_session) -> None:
    from app.db.models import ScoreRow

    session_id = _complete_flow(client, seed=777)
    first = client.post(f"/api/v1/sessions/{session_id}/complete").json()
    second = client.post(f"/api/v1/sessions/{session_id}/complete").json()
    assert first == second
    assert db_session.query(ScoreRow).filter(ScoreRow.session_id == session_id).count() == 1


def test_complete_unknown_session_returns_404(client) -> None:
    response = client.post("/api/v1/sessions/SES-NOPE/complete")
    assert response.status_code == 404
    assert response.json()["detail"] == "unknown session_id: SES-NOPE"


def test_events_rejected_after_completion(client) -> None:
    session_id = _complete_flow(client, seed=888)
    client.post(f"/api/v1/sessions/{session_id}/complete")
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 5000, "threat_id": "T01"},
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python -m pytest tests/test_sessions_api.py -v -k complete`
Expected: FAIL — 404 (complete route not implemented).

- [ ] **Step 3: Implement** — append to `backend/app/api/sessions.py`

Replace the existing `app.db.models` and `app.schemas.session` import lines so the full import block becomes:

```python
from datetime import datetime

from app.db.models import (
    EventRow,
    ScenarioRow,
    ScoreRow,
    SessionRow,
    event_row_to_request,
)
from app.schemas.session import (
    CompleteResponse,
    SessionCreateRequest,
    SessionCreated,
)
from app.services.scoring import score
```

Add the route:

```python
@router.post("/sessions/{session_id}/complete", response_model=CompleteResponse)
def complete_session(
    session_id: str, db: Session = Depends(get_db)
) -> CompleteResponse:
    session = db.get(SessionRow, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"unknown session_id: {session_id}")

    existing = db.get(ScoreRow, session_id)
    if existing is not None:
        return CompleteResponse(
            session_id=session_id,
            final_score=existing.final_score,
            aar_available=True,
            scoring_version=existing.scoring_version,
        )

    scenario_row = db.get(ScenarioRow, session.scenario_id)
    if scenario_row is None:
        raise HTTPException(
            status_code=404, detail=f"unknown scenario_id: {session.scenario_id}"
        )
    event_rows = (
        db.query(EventRow)
        .filter(EventRow.session_id == session_id)
        .order_by(EventRow.timestamp_ms, EventRow.event_id)
        .all()
    )
    events = [event_row_to_request(row) for row in event_rows]
    result = score(session_id, scenario_row.to_schema(), events)

    db.add(
        ScoreRow(
            session_id=session_id,
            detection_score=result.detection_score,
            classification_score=result.classification_score,
            response_score=result.response_score,
            timing_score=result.timing_score,
            penalty=result.penalty,
            final_score=result.final_score,
            scoring_version=result.scoring_version,
        )
    )
    session.status = "completed"
    session.completed_at = datetime.now()
    session.final_score = result.final_score
    db.commit()

    return CompleteResponse(
        session_id=session_id,
        final_score=result.final_score,
        aar_available=True,
        scoring_version=result.scoring_version,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests/test_sessions_api.py -v`
Expected: PASS (11 tests)
Then the full suite: `.venv/Scripts/python -m pytest tests -q`
Expected: PASS, pristine.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/sessions.py backend/tests/test_sessions_api.py
git commit -m "feat(api): score and complete sessions server-side"
```

---

### Task 8: End-to-end integration test (API → DB → scoring)

**Files:**
- Create: `backend/tests/test_integration_scoring.py`

**Interfaces:**
- Consumes: the full stack via the `client` + `db_session` fixtures.
- Produces: a closed-loop proof that `docs/guides/testing_validation.md §1` (API→DB→scoring) holds and that the score is reproducible from persisted events, not trusted from the client.

- [ ] **Step 1: Write the integration/regression test** — `backend/tests/test_integration_scoring.py` (guard test: no RED expected, it exercises the whole stack)

```python
from __future__ import annotations

from app.db.models import EventRow, ScenarioRow, ScoreRow, event_row_to_request
from app.services.scoring import score


def _generate(client, seed: int) -> dict:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 6,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 2,
            "seed": seed,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_full_session_lifecycle_is_deterministic(client, db_session) -> None:
    scenario = _generate(client, seed=4242)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-042", "scenario_id": scenario["scenario_id"]},
    ).json()["session_id"]

    threat = scenario["threats"][0]
    events = [
        {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": threat["id"]},
        {
            "type": "CLASSIFICATION_SUBMITTED",
            "timestamp_ms": 2000,
            "threat_id": threat["id"],
            "payload": {"label": threat["classification_label"]},
        },
        {
            "type": "RESPONSE_SUBMITTED",
            "timestamp_ms": 3000,
            "threat_id": threat["id"],
            "payload": {"response": threat["expected_response"]},
        },
    ]
    for event in events:
        assert (
            client.post(
                f"/api/v1/sessions/{session_id}/events", json=event
            ).status_code
            == 201
        )

    completed = client.post(f"/api/v1/sessions/{session_id}/complete")
    assert completed.status_code == 200

    score_row = db_session.get(ScoreRow, session_id)
    assert score_row is not None
    assert score_row.final_score == completed.json()["final_score"]

    # Recompute independently from the persisted scenario + events.
    scenario_row = db_session.get(ScenarioRow, scenario["scenario_id"])
    event_rows = (
        db_session.query(EventRow)
        .filter(EventRow.session_id == session_id)
        .order_by(EventRow.timestamp_ms, EventRow.event_id)
        .all()
    )
    recomputed = score(
        session_id,
        scenario_row.to_schema(),
        [event_row_to_request(row) for row in event_rows],
    )
    assert recomputed.final_score == score_row.final_score
```

- [ ] **Step 2: Run the test**

Run: `.venv/Scripts/python -m pytest tests/test_integration_scoring.py -v`
Expected: PASS (guard/integration test; it localizes any integration break in the API→DB→scoring path).
Then the full suite: `.venv/Scripts/python -m pytest tests -q` (all green, pristine).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_integration_scoring.py
git commit -m "test(integration): cover API->DB->scoring session lifecycle"
```

---

### Task 9: Checklist, docs, and push

**Files:**
- Modify: `docs/project-management/development_checklist.md`

**Interfaces:**
- Consumes: completed Tasks 1-8.
- Produces: updated checklist; phase pushed to `origin/main`.

- [ ] **Step 1: Tick delivered items** in `docs/project-management/development_checklist.md` — change `[ ]` to `[x]` for:

- Under **Data model**: `Session model`, `Event model`, `Score model`, `Performance profile`
- Under **Backend**: `Session endpoint`, `Event endpoint`, `Complete-session endpoint`
- Under **Scoring**: `Detection score`, `Classification score`, `Response score`, `Timing score`, `Penalties`, `Final score`, `Unit tests`

- [ ] **Step 2: Run the full suite one final time**

Run (from `backend/`): `.venv/Scripts/python -m pytest tests -v` — Expected: all pass.

- [ ] **Step 3: Confirm clean tree and review log**

Run from repo root: `git status --short` (only the checklist change) and `git log --oneline -12`.

- [ ] **Step 4: Commit and push**

```bash
git add docs/project-management/development_checklist.md
git commit -m "docs(checklist): mark scoring and sessions phase complete"
git push origin main
```

---

## Phase DoD (verification before completion)

- `.venv/Scripts/python -m pytest tests -v` green (Phase 0 + 1 + 2), pristine (no warnings).
- Every §8 decision-tree branch and every `testing_validation.md §3` branch covered by `tests/golden/scoring_cases.json` (11 cases).
- `POST /sessions` 404s on unknown `scenario_id`; 201 otherwise.
- `POST /sessions/{id}/events` 201s with `EVT-nnn`; 404 unknown session; 422 invalid type / unknown threat / completed session.
- `POST /sessions/{id}/complete` computes and persists the score server-side, is idempotent, and 404s on unknown session.
- API→DB→scoring integration test recomputes the score directly from persisted rows and matches.
- Contract conformance test passes (all new routes already in `docs/api/openapi.yaml`).
- Checklist updated; `main` pushed; `git status` clean.
