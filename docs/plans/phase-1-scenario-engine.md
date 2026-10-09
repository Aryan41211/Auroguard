# Phase 1 — Scenario Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, contract-conformant `POST /api/v1/scenarios/generate` endpoint that produces reproducible training scenarios from a seed while honouring an exact difficulty target.

**Architecture:** Pure layered backend. Pydantic schemas mirror the frozen v1 contract (`docs/api/openapi.yaml`). A pure `generate_scenario(request, seed)` function computes the scenario; a separate validator re-checks the §8 rules; an anti-repetition wrapper selects seeds without contaminating the deterministic core; a thin FastAPI router wires it all onto the existing `app.main:app`.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pytest, httpx (TestClient).

**Spec:** `docs/modules/scenario_engine.md` (dimensions, difficulty model, §8 validation) and `docs/api/openapi.yaml` (`ScenarioGenerateRequest`, `ThreatProfile`, `Scenario`). Contract is the binding authority where the two disagree.

## Global Constraints

- API base is `/api/v1`, content type `application/json` (`docs/api/api_specification.md §1`).
- Pydantic model names and fields mirror `docs/api/openapi.yaml` exactly: `ScenarioGenerateRequest`, `ThreatProfile`, `Scenario` (`docs/plans/phase-0-environment.md` Task 4).
- Determinism (NFR-01): same `(request, seed)` ⇒ byte-identical `Scenario`, including `scenario_id`.
- Requested `difficulty` is an **exact target**; unreachable combinations return **HTTP 422**.
- `scenario_id` is derived deterministically from the seed: `f"SCN-{seed % 1_000_000:06d}"`.
- `generator_version` is the string `"1.0"`.
- Anti-repetition never changes the pure generator; it only re-rolls the seed when the caller did not pin one.
- Commits go to `main` with Conventional Commits, one logical change each (`docs/project-management/git_workflow.md`).
- Test command (run from `backend/`): `.venv/Scripts/python -m pytest tests -v`.
- No secrets, no `.env`, no `*.db` committed.

## Design Decisions (locked before Task 1)

1. **Difficulty model (additive, exact):**
   `D = 1 + threat_factor + env_factor + time_factor + vis_factor + sensor_factor + timing_factor`
   - `threat_factor`: `{1: 0, 2: 1, 3: 2, 5: 4}`
   - `env_factor`: `urban +1`, `rural 0`
   - `time_factor`: `night +2`, `day 0`
   - `vis_factor`: `clear 0`, `reduced 1`, `poor 2`
   - `sensor_factor`: `q>=0.7 → 0`, `0.4<=q<0.7 → 1`, `q<0.4 → 2`
   - `timing_factor`: `duration>=150 → 0`, `90<=duration<150 → 1`, `60<=duration<90 → 2`
   The generator solves `residual = D - (fixed part)`; if `residual ∉ [0, 6]` the request is infeasible → 422.
   *Deviation from spec §5:* the spec lists `distraction_factor` and says difficulty "can depend on" these factors. This phase intentionally omits distraction (no distraction mechanic exists yet) and uses additive integer factors so the target is exactly solvable; revisit in Phase 5.
2. **Ground-truth label→response mapping (training abstraction):**
   `friendly→monitor`, `civilian→monitor`, `unknown→track`, `suspicious→report`, `hostile→hold`.
   The validator enforces `expected_response == mapping[classification_label]`.
3. **Anti-repetition vs determinism:** the pure generator is untouched; a `RecentConfigTracker` window plus seed re-roll lives in `anti_repetition.py`, and pinned seeds bypass it.

## File Structure

```text
backend/
  app/
    schemas/
      __init__.py                 (new, empty)
      scenario.py                 (new; enums + 3 contract models)
    services/
      __init__.py                 (new, empty)
      scenario_generator.py       (new; pure generator + difficulty model)
      scenario_validator.py       (new; §8 rules + difficulty invariant)
      anti_repetition.py          (new; tracker + seed re-roll wrapper)
    api/
      __init__.py                 (new, empty)
      scenarios.py                (new; POST /scenarios/generate)
    main.py                       (modify; mount router + tracker state)
  tests/
    test_scenario_schemas.py      (new)
    test_scenario_generator.py    (new)
    test_scenario_validator.py    (new)
    test_anti_repetition.py       (new)
    test_scenarios_api.py         (new)
    test_contract_conformance.py  (new)
```

---

### Task 1: Contract-shaped scenario schemas

**Files:**
- Create: `backend/app/schemas/__init__.py` (empty)
- Create: `backend/app/schemas/scenario.py`
- Test: `backend/tests/test_scenario_schemas.py`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: enums `Environment`, `TimeOfDay`, `Visibility`, `ClassificationLabel`, `ExpectedResponse`, `SpeedClass`; type alias `ThreatCount = Literal[1, 2, 3, 5]`; models `ScenarioGenerateRequest`, `ThreatProfile`, `Scenario`. Every later task imports from here.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_scenario_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas.scenario import (
    Scenario,
    ScenarioGenerateRequest,
    ThreatProfile,
)


def test_request_accepts_valid_configuration() -> None:
    req = ScenarioGenerateRequest(
        difficulty=5, environment="urban", time_of_day="night", threat_count=2
    )
    assert req.threat_count == 2
    assert req.seed is None


def test_request_rejects_difficulty_out_of_range() -> None:
    with pytest.raises(ValidationError):
        ScenarioGenerateRequest(
            difficulty=11, environment="urban", time_of_day="day", threat_count=1
        )


def test_request_rejects_unknown_threat_count() -> None:
    with pytest.raises(ValidationError):
        ScenarioGenerateRequest(
            difficulty=5, environment="urban", time_of_day="day", threat_count=4
        )


def test_request_rejects_unknown_environment() -> None:
    with pytest.raises(ValidationError):
        ScenarioGenerateRequest(
            difficulty=5, environment="space", time_of_day="day", threat_count=1
        )


def test_scenario_round_trips_through_model_dump() -> None:
    threat = ThreatProfile(
        id="T01",
        classification_label="hostile",
        expected_response="hold",
        spawn_time=12.5,
    )
    scenario = Scenario(
        scenario_id="SCN-000123",
        seed=123,
        generator_version="1.0",
        difficulty=6,
        environment="urban",
        time_of_day="night",
        visibility="reduced",
        sensor_quality=0.65,
        duration_seconds=120,
        threats=[threat],
    )
    assert Scenario(**scenario.model_dump()) == scenario


def test_scenario_rejects_sensor_quality_above_one() -> None:
    with pytest.raises(ValidationError):
        Scenario(
            scenario_id="SCN-000123",
            seed=123,
            generator_version="1.0",
            difficulty=6,
            environment="urban",
            time_of_day="night",
            visibility="reduced",
            sensor_quality=1.5,
            duration_seconds=120,
            threats=[],
        )


def test_scenario_requires_positive_duration() -> None:
    with pytest.raises(ValidationError):
        Scenario(
            scenario_id="SCN-000123",
            seed=123,
            generator_version="1.0",
            difficulty=6,
            environment="urban",
            time_of_day="night",
            visibility="reduced",
            sensor_quality=0.5,
            duration_seconds=0,
            threats=[],
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_scenario_schemas.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.schemas'`

- [ ] **Step 3: Write the schemas**

Create empty files `backend/app/schemas/__init__.py`.

`backend/app/schemas/scenario.py`:

```python
"""Pydantic models mirroring the frozen v1 scenario contract.

Source of truth: docs/api/openapi.yaml
(ScenarioGenerateRequest, ThreatProfile, Scenario).
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

ThreatCount = Literal[1, 2, 3, 5]


class Environment(str, Enum):
    urban = "urban"
    rural = "rural"


class TimeOfDay(str, Enum):
    day = "day"
    night = "night"


class Visibility(str, Enum):
    clear = "clear"
    reduced = "reduced"
    poor = "poor"


class ClassificationLabel(str, Enum):
    friendly = "friendly"
    civilian = "civilian"
    unknown = "unknown"
    suspicious = "suspicious"
    hostile = "hostile"


class ExpectedResponse(str, Enum):
    monitor = "monitor"
    track = "track"
    report = "report"
    hold = "hold"


class SpeedClass(str, Enum):
    slow = "slow"
    medium = "medium"
    fast = "fast"


class ScenarioGenerateRequest(BaseModel):
    difficulty: int = Field(ge=1, le=10)
    environment: Environment
    time_of_day: TimeOfDay
    threat_count: ThreatCount
    seed: int | None = None


class ThreatProfile(BaseModel):
    id: str
    category: str = "unknown_aerial_object"
    classification_label: ClassificationLabel
    expected_response: ExpectedResponse
    spawn_time: float = Field(ge=0)
    speed_class: SpeedClass | None = None
    visibility_class: Visibility | None = None


class Scenario(BaseModel):
    scenario_id: str
    seed: int
    generator_version: str
    difficulty: int = Field(ge=1, le=10)
    environment: Environment
    time_of_day: TimeOfDay
    visibility: Visibility
    sensor_quality: float = Field(ge=0, le=1)
    duration_seconds: float = Field(gt=0)
    threats: list[ThreatProfile]
```

- [ ] **Step 4: Run test to verify it passes**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_scenario_schemas.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas backend/tests/test_scenario_schemas.py
git commit -m "feat(schemas): add contract-shaped scenario models and enums"
```

---

### Task 2: Deterministic scenario generator

**Files:**
- Create: `backend/app/services/__init__.py` (empty)
- Create: `backend/app/services/scenario_generator.py`
- Test: `backend/tests/test_scenario_generator.py`

**Interfaces:**
- Consumes: Task 1 schemas.
- Produces:
  - constants `GENERATOR_VERSION`, `LABEL_TO_RESPONSE`
  - `compute_difficulty(*, environment, time_of_day, threat_count, visibility, sensor_quality, duration_seconds) -> int`
  - `sensor_factor(sensor_quality: float) -> int`, `timing_factor(duration_seconds: float) -> int`
  - `class InfeasibleScenarioError(ValueError)`
  - `generate_scenario(request: ScenarioGenerateRequest, seed: int) -> Scenario`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_scenario_generator.py`:

```python
import pytest

from app.schemas.scenario import ScenarioGenerateRequest
from app.services.scenario_generator import (
    LABEL_TO_RESPONSE,
    InfeasibleScenarioError,
    compute_difficulty,
    generate_scenario,
)


def _request(**overrides) -> ScenarioGenerateRequest:
    base = dict(difficulty=6, environment="urban", time_of_day="night", threat_count=2)
    base.update(overrides)
    return ScenarioGenerateRequest(**base)


def test_same_seed_produces_identical_scenario() -> None:
    assert generate_scenario(_request(), 12345) == generate_scenario(_request(), 12345)


def test_different_seed_changes_scenario() -> None:
    assert generate_scenario(_request(), 1) != generate_scenario(_request(), 2)


def test_threat_count_matches_request() -> None:
    assert len(generate_scenario(_request(threat_count=3), 999).threats) == 3


def test_threat_ids_are_ordered_and_unique() -> None:
    scenario = generate_scenario(_request(threat_count=3), 999)
    assert [t.id for t in scenario.threats] == ["T01", "T02", "T03"]


def test_spawn_times_within_duration() -> None:
    scenario = generate_scenario(_request(difficulty=8, threat_count=5), 777)
    for threat in scenario.threats:
        assert 0 <= threat.spawn_time < scenario.duration_seconds


def test_expected_response_matches_ground_truth_mapping() -> None:
    scenario = generate_scenario(_request(difficulty=8, threat_count=5), 42)
    for threat in scenario.threats:
        assert threat.expected_response == LABEL_TO_RESPONSE[threat.classification_label]


def test_difficulty_equals_requested_and_model() -> None:
    scenario = generate_scenario(_request(difficulty=8, threat_count=2), 7)
    assert scenario.difficulty == 8
    assert (
        compute_difficulty(
            environment=scenario.environment,
            time_of_day=scenario.time_of_day,
            threat_count=len(scenario.threats),
            visibility=scenario.visibility,
            sensor_quality=scenario.sensor_quality,
            duration_seconds=scenario.duration_seconds,
        )
        == 8
    )


def test_scenario_id_is_deterministic_and_formatted() -> None:
    assert generate_scenario(_request(), 123).scenario_id == "SCN-000123"


def test_generator_version_is_string_one_zero() -> None:
    assert generate_scenario(_request(), 5).generator_version == "1.0"


def test_infeasible_low_difficulty_raises() -> None:
    with pytest.raises(InfeasibleScenarioError):
        generate_scenario(
            _request(difficulty=1, environment="urban", time_of_day="night", threat_count=5),
            1,
        )


def test_infeasible_high_difficulty_raises() -> None:
    with pytest.raises(InfeasibleScenarioError):
        generate_scenario(
            _request(difficulty=10, environment="rural", time_of_day="day", threat_count=1),
            1,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_scenario_generator.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services'`

- [ ] **Step 3: Write the generator**

Create empty file `backend/app/services/__init__.py`.

`backend/app/services/scenario_generator.py`:

```python
"""Deterministic scenario generator.

Same (request, seed) always produces an identical Scenario (NFR-01).
Difficulty is an exact target: the generator solves for visibility,
sensor quality and duration such that the additive difficulty model
equals the requested value, and rejects unreachable combinations.

Source of truth: docs/modules/scenario_engine.md and docs/api/openapi.yaml.
"""

from __future__ import annotations

import random

from app.schemas.scenario import (
    ClassificationLabel,
    Environment,
    ExpectedResponse,
    Scenario,
    ScenarioGenerateRequest,
    SpeedClass,
    ThreatProfile,
    TimeOfDay,
    Visibility,
)

GENERATOR_VERSION = "1.0"

BASE_DIFFICULTY = 1
THREAT_COUNT_FACTOR: dict[int, int] = {1: 0, 2: 1, 3: 2, 5: 4}
ENVIRONMENT_FACTOR: dict[Environment, int] = {Environment.urban: 1, Environment.rural: 0}
TIME_FACTOR: dict[TimeOfDay, int] = {TimeOfDay.day: 0, TimeOfDay.night: 2}

VISIBILITY_TIERS: tuple[Visibility, ...] = (
    Visibility.clear,
    Visibility.reduced,
    Visibility.poor,
)

SENSOR_CHOICES: dict[int, tuple[float, ...]] = {
    0: (0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00),
    1: (0.40, 0.45, 0.50, 0.55, 0.60, 0.65),
    2: (0.10, 0.15, 0.20, 0.25, 0.30, 0.35),
}

DURATION_CHOICES: dict[int, tuple[float, ...]] = {
    0: (150.0, 160.0, 170.0, 180.0),
    1: (90.0, 105.0, 120.0, 135.0),
    2: (60.0, 70.0, 80.0),
}

LABEL_TO_RESPONSE: dict[ClassificationLabel, ExpectedResponse] = {
    ClassificationLabel.friendly: ExpectedResponse.monitor,
    ClassificationLabel.civilian: ExpectedResponse.monitor,
    ClassificationLabel.unknown: ExpectedResponse.track,
    ClassificationLabel.suspicious: ExpectedResponse.report,
    ClassificationLabel.hostile: ExpectedResponse.hold,
}

_THREAT_LABELS: tuple[ClassificationLabel, ...] = tuple(ClassificationLabel)
_SPEED_CLASSES: tuple[SpeedClass, ...] = tuple(SpeedClass)


class InfeasibleScenarioError(ValueError):
    """Raised when no configuration can reach the requested difficulty."""


def sensor_factor(sensor_quality: float) -> int:
    if sensor_quality >= 0.7:
        return 0
    if sensor_quality >= 0.4:
        return 1
    return 2


def timing_factor(duration_seconds: float) -> int:
    if duration_seconds >= 150:
        return 0
    if duration_seconds >= 90:
        return 1
    return 2


def compute_difficulty(
    *,
    environment: Environment,
    time_of_day: TimeOfDay,
    threat_count: int,
    visibility: Visibility,
    sensor_quality: float,
    duration_seconds: float,
) -> int:
    return (
        BASE_DIFFICULTY
        + THREAT_COUNT_FACTOR[threat_count]
        + ENVIRONMENT_FACTOR[environment]
        + TIME_FACTOR[time_of_day]
        + VISIBILITY_TIERS.index(visibility)
        + sensor_factor(sensor_quality)
        + timing_factor(duration_seconds)
    )


def _allocate_residual(rng: random.Random, residual: int) -> tuple[int, int, int]:
    combos = [
        (vis, sensor, timing)
        for vis in range(3)
        for sensor in range(3)
        for timing in range(3)
        if vis + sensor + timing == residual
    ]
    return rng.choice(combos)


def _build_threats(
    rng: random.Random,
    count: int,
    duration_seconds: float,
    visibility: Visibility,
) -> list[ThreatProfile]:
    threats: list[ThreatProfile] = []
    for index in range(count):
        label = rng.choice(_THREAT_LABELS)
        spawn_time = round(rng.uniform(0.0, duration_seconds * 0.95), 1)
        threats.append(
            ThreatProfile(
                id=f"T{index + 1:02d}",
                classification_label=label,
                expected_response=LABEL_TO_RESPONSE[label],
                spawn_time=spawn_time,
                speed_class=rng.choice(_SPEED_CLASSES),
                visibility_class=visibility,
            )
        )
    return threats


def generate_scenario(request: ScenarioGenerateRequest, seed: int) -> Scenario:
    rng = random.Random(seed)

    fixed = (
        BASE_DIFFICULTY
        + THREAT_COUNT_FACTOR[request.threat_count]
        + ENVIRONMENT_FACTOR[request.environment]
        + TIME_FACTOR[request.time_of_day]
    )
    residual = request.difficulty - fixed
    if residual < 0 or residual > 6:
        raise InfeasibleScenarioError(
            f"difficulty {request.difficulty} is unreachable for "
            f"environment={request.environment.value}, "
            f"time_of_day={request.time_of_day.value}, "
            f"threat_count={request.threat_count}"
        )

    vis_factor, sensor_index, timing_index = _allocate_residual(rng, residual)
    visibility = VISIBILITY_TIERS[vis_factor]
    sensor_quality = rng.choice(SENSOR_CHOICES[sensor_index])
    duration_seconds = rng.choice(DURATION_CHOICES[timing_index])

    return Scenario(
        scenario_id=f"SCN-{seed % 1_000_000:06d}",
        seed=seed,
        generator_version=GENERATOR_VERSION,
        difficulty=request.difficulty,
        environment=request.environment,
        time_of_day=request.time_of_day,
        visibility=visibility,
        sensor_quality=sensor_quality,
        duration_seconds=duration_seconds,
        threats=_build_threats(rng, request.threat_count, duration_seconds, visibility),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_scenario_generator.py -v`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services backend/tests/test_scenario_generator.py
git commit -m "feat(scenarios): add deterministic scenario generator with exact difficulty"
```

---

### Task 3: Scenario validator

**Files:**
- Create: `backend/app/services/scenario_validator.py`
- Test: `backend/tests/test_scenario_validator.py`

**Interfaces:**
- Consumes: Task 1 `Scenario`; Task 2 `LABEL_TO_RESPONSE`, `compute_difficulty`.
- Produces: `class ScenarioValidationError(ValueError)`; `validate_scenario(scenario: Scenario) -> None` (raises on violation).

- [ ] **Step 1: Write the failing test**

`backend/tests/test_scenario_validator.py`:

```python
import pytest

from app.schemas.scenario import ExpectedResponse, ScenarioGenerateRequest
from app.services.scenario_generator import generate_scenario
from app.services.scenario_validator import ScenarioValidationError, validate_scenario


def _valid_scenario():
    request = ScenarioGenerateRequest(
        difficulty=6, environment="urban", time_of_day="night", threat_count=2
    )
    return generate_scenario(request, 12345)


def test_valid_generated_scenario_passes() -> None:
    validate_scenario(_valid_scenario())


def test_duplicate_threat_ids_rejected() -> None:
    scenario = _valid_scenario()
    scenario.threats[1].id = scenario.threats[0].id
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_empty_threats_rejected() -> None:
    scenario = _valid_scenario()
    scenario.threats = []
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_spawn_time_outside_duration_rejected() -> None:
    scenario = _valid_scenario()
    scenario.threats[0].spawn_time = scenario.duration_seconds + 1
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_response_mismatch_rejected() -> None:
    scenario = _valid_scenario()
    current = scenario.threats[0].expected_response
    scenario.threats[0].expected_response = next(
        response for response in ExpectedResponse if response != current
    )
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_declared_difficulty_mismatch_rejected() -> None:
    scenario = _valid_scenario()
    scenario.difficulty = scenario.difficulty + 1
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_sensor_quality_out_of_range_rejected() -> None:
    scenario = _valid_scenario()
    scenario.sensor_quality = 1.5
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_difficulty_out_of_range_rejected() -> None:
    scenario = _valid_scenario()
    scenario.difficulty = 0
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_non_positive_duration_rejected() -> None:
    scenario = _valid_scenario()
    scenario.duration_seconds = 0
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_scenario_validator.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.scenario_validator'`

- [ ] **Step 3: Write the validator**

`backend/app/services/scenario_validator.py`:

```python
"""Scenario validation rules (docs/modules/scenario_engine.md section 8).

The Scenario model already constrains field ranges (difficulty 1-10,
sensor_quality 0-1, duration > 0). This validator re-checks those ranges
so it stays a complete guard even for scenarios built without Pydantic
validation, and adds the relational rules the schema cannot express.
"""

from __future__ import annotations

from app.schemas.scenario import Scenario
from app.services.scenario_generator import LABEL_TO_RESPONSE, compute_difficulty


class ScenarioValidationError(ValueError):
    """Raised when a scenario violates a validation rule."""


def validate_scenario(scenario: Scenario) -> None:
    if scenario.duration_seconds <= 0:
        raise ScenarioValidationError("duration_seconds must be > 0")

    if not 1 <= scenario.difficulty <= 10:
        raise ScenarioValidationError("difficulty must be inside 1-10")

    if not 0 <= scenario.sensor_quality <= 1:
        raise ScenarioValidationError("sensor_quality must be inside 0-1")

    if not scenario.threats:
        raise ScenarioValidationError("at least one threat is required")

    ids = [threat.id for threat in scenario.threats]
    if len(ids) != len(set(ids)):
        raise ScenarioValidationError("threat ids must be unique")

    for threat in scenario.threats:
        if not 0 <= threat.spawn_time < scenario.duration_seconds:
            raise ScenarioValidationError(
                f"spawn_time {threat.spawn_time} out of range for threat {threat.id}"
            )
        expected = LABEL_TO_RESPONSE[threat.classification_label]
        if threat.expected_response != expected:
            raise ScenarioValidationError(
                f"threat {threat.id} response {threat.expected_response.value} "
                f"does not match ground truth for "
                f"{threat.classification_label.value}"
            )

    computed = compute_difficulty(
        environment=scenario.environment,
        time_of_day=scenario.time_of_day,
        threat_count=len(scenario.threats),
        visibility=scenario.visibility,
        sensor_quality=scenario.sensor_quality,
        duration_seconds=scenario.duration_seconds,
    )
    if computed != scenario.difficulty:
        raise ScenarioValidationError(
            f"declared difficulty {scenario.difficulty} does not match computed {computed}"
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_scenario_validator.py -v`
Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scenario_validator.py backend/tests/test_scenario_validator.py
git commit -m "feat(scenarios): add scenario validator for section 8 rules"
```

---

### Task 4: Anti-repetition seed wrapper

**Files:**
- Create: `backend/app/services/anti_repetition.py`
- Test: `backend/tests/test_anti_repetition.py`

**Interfaces:**
- Consumes: Task 1 `Scenario`, `ScenarioGenerateRequest`; Task 2 `generate_scenario`.
- Produces: `class RecentConfigTracker` (methods `signature` (staticmethod), `is_recent`, `record`, `clear`); `generate_with_anti_repetition(request, tracker, *, max_attempts=25, seed_source=None) -> Scenario`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_anti_repetition.py`:

```python
import random

from app.schemas.scenario import ScenarioGenerateRequest
from app.services.anti_repetition import (
    RecentConfigTracker,
    generate_with_anti_repetition,
)


def _request(**overrides) -> ScenarioGenerateRequest:
    base = dict(difficulty=6, environment="urban", time_of_day="night", threat_count=2)
    base.update(overrides)
    return ScenarioGenerateRequest(**base)


def test_pinned_seed_is_deterministic_and_recorded() -> None:
    tracker = RecentConfigTracker()
    first = generate_with_anti_repetition(_request(seed=12345), tracker)
    second = generate_with_anti_repetition(_request(seed=12345), tracker)
    assert first == second
    assert tracker.is_recent(first)


def test_unpinned_generation_returns_scenario_and_records_it() -> None:
    tracker = RecentConfigTracker()
    scenario = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(0)
    )
    assert len(scenario.threats) == 2
    assert tracker.is_recent(scenario)


def test_recent_configuration_is_avoided() -> None:
    tracker = RecentConfigTracker()
    first = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(1)
    )
    second = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(1)
    )
    assert second != first


def test_fallback_when_window_exhausted_still_returns_scenario() -> None:
    tracker = RecentConfigTracker(capacity=100)
    rng = random.Random(5)
    for _ in range(50):
        generate_with_anti_repetition(_request(), tracker, seed_source=rng)
    scenario = generate_with_anti_repetition(
        _request(), tracker, seed_source=rng, max_attempts=1
    )
    assert len(scenario.threats) == 2


def test_tracker_clear_empties_window() -> None:
    tracker = RecentConfigTracker()
    scenario = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(2)
    )
    assert tracker.is_recent(scenario)
    tracker.clear()
    assert not tracker.is_recent(scenario)
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_anti_repetition.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.anti_repetition'`

- [ ] **Step 3: Write the anti-repetition module**

`backend/app/services/anti_repetition.py`:

```python
"""Anti-repetition wrapper around the deterministic generator.

The generator stays a pure function of (request, seed) (NFR-01).
Anti-repetition lives here: when the caller pins a seed it is honoured
exactly; otherwise fresh seeds are re-rolled until the produced
configuration is outside the recent window.
"""

from __future__ import annotations

import random
from collections import deque

from app.schemas.scenario import Scenario, ScenarioGenerateRequest
from app.services.scenario_generator import generate_scenario

DEFAULT_CAPACITY = 10
DEFAULT_MAX_ATTEMPTS = 25
_SEED_UPPER_BOUND = 1_000_000


class RecentConfigTracker:
    """Bounded memory of recently generated configuration signatures."""

    def __init__(self, capacity: int = DEFAULT_CAPACITY) -> None:
        self._recent: deque[tuple] = deque(maxlen=capacity)

    @staticmethod
    def signature(scenario: Scenario) -> tuple:
        return (
            scenario.environment.value,
            scenario.time_of_day.value,
            len(scenario.threats),
            scenario.visibility.value,
            scenario.sensor_quality,
            scenario.duration_seconds,
            tuple(t.classification_label.value for t in scenario.threats),
        )

    def is_recent(self, scenario: Scenario) -> bool:
        return self.signature(scenario) in self._recent

    def record(self, scenario: Scenario) -> None:
        self._recent.append(self.signature(scenario))

    def clear(self) -> None:
        self._recent.clear()


def _fresh_seed(rng: random.Random) -> int:
    return rng.randrange(_SEED_UPPER_BOUND)


def generate_with_anti_repetition(
    request: ScenarioGenerateRequest,
    tracker: RecentConfigTracker,
    *,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    seed_source: random.Random | None = None,
) -> Scenario:
    if request.seed is not None:
        scenario = generate_scenario(request, request.seed)
        tracker.record(scenario)
        return scenario

    rng = seed_source or random.Random()
    last: Scenario | None = None
    for _ in range(max(1, max_attempts)):
        last = generate_scenario(request, _fresh_seed(rng))
        if not tracker.is_recent(last):
            tracker.record(last)
            return last

    assert last is not None  # the loop runs at least once
    tracker.record(last)
    return last
```

- [ ] **Step 4: Run test to verify it passes**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_anti_repetition.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/anti_repetition.py backend/tests/test_anti_repetition.py
git commit -m "feat(scenarios): add anti-repetition seed selection wrapper"
```

---

### Task 5: Scenario generation API route

**Files:**
- Create: `backend/app/api/__init__.py` (empty)
- Create: `backend/app/api/scenarios.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_scenarios_api.py`

**Interfaces:**
- Consumes: Task 1 `ScenarioGenerateRequest`; Task 2 `InfeasibleScenarioError`; Task 3 `validate_scenario`, `ScenarioValidationError`; Task 4 `RecentConfigTracker`, `generate_with_anti_repetition`.
- Produces: `router` (APIRouter) exposing `POST /scenarios/generate`; `app.state.recent_configs` holds a `RecentConfigTracker`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_scenarios_api.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_generate_returns_contract_shaped_scenario() -> None:
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


def test_generate_is_deterministic_for_same_seed() -> None:
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


def test_generate_without_seed_returns_scenario() -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 6, "environment": "rural", "time_of_day": "day", "threat_count": 1},
    )
    assert response.status_code == 200
    assert response.json()["seed"] is not None


def test_generate_rejects_infeasible_configuration() -> None:
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


def test_generate_rejects_invalid_threat_count() -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 5, "environment": "urban", "time_of_day": "day", "threat_count": 4},
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_scenarios_api.py -v`
Expected: FAIL (404 for `/api/v1/scenarios/generate`)

- [ ] **Step 3: Write the route and wire it up**

Create empty file `backend/app/api/__init__.py`.

`backend/app/api/scenarios.py`:

```python
"""Scenario generation HTTP route (POST /scenarios/generate)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

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
    body: ScenarioGenerateRequest, request: Request
) -> Scenario:
    tracker: RecentConfigTracker = request.app.state.recent_configs
    try:
        scenario = generate_with_anti_repetition(body, tracker)
        validate_scenario(scenario)
    except (InfeasibleScenarioError, ScenarioValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return scenario
```

Modify `backend/app/main.py` to:

```python
from fastapi import FastAPI

from app.api.scenarios import router as scenarios_router
from app.services.anti_repetition import RecentConfigTracker

app = FastAPI(title="Aeroguard API", version="1.0.0")
app.state.recent_configs = RecentConfigTracker()

app.include_router(scenarios_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Run the full suite to verify pass**

Run from `backend/`: `.venv/Scripts/python -m pytest tests -v`
Expected: all pass (5 pre-existing + new)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api backend/app/main.py backend/tests/test_scenarios_api.py
git commit -m "feat(api): add POST /api/v1/scenarios/generate endpoint"
```

---

### Task 6: Contract conformance test

**Files:**
- Test: `backend/tests/test_contract_conformance.py`

**Interfaces:**
- Consumes: `app.main:app`; `docs/api/openapi.yaml`.
- Produces: a guard asserting every implemented app route (except `/health`) exists in the contract.

- [ ] **Step 1: Write the guard test**

`backend/tests/test_contract_conformance.py`:

```python
from pathlib import Path

import yaml
from fastapi.routing import APIRoute

from app.main import app

CONTRACT = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.yaml"
NON_CONTRACT_ROUTES = {"/health"}


def _contract_paths() -> set[str]:
    spec = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return set(spec["paths"])


def _app_paths() -> set[str]:
    return {route.path for route in app.routes if isinstance(route, APIRoute)}


def test_every_implemented_route_is_in_the_contract() -> None:
    undocumented = (_app_paths() - NON_CONTRACT_ROUTES) - _contract_paths()
    assert undocumented == set(), f"routes missing from contract: {sorted(undocumented)}"


def test_health_is_the_only_non_v1_route() -> None:
    non_v1 = {path for path in _app_paths() if not path.startswith("/api/v1")}
    assert non_v1 == NON_CONTRACT_ROUTES
```

- [ ] **Step 2: Run test to verify it fails then passes**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_contract_conformance.py -v`
Expected: PASS (the route from Task 5 is already in the contract). If it FAILS, the message names the offending path.

- [ ] **Step 3: Run the full suite**

Run from `backend/`: `.venv/Scripts/python -m pytest tests -v`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_contract_conformance.py
git commit -m "test(api): guard implemented routes against the frozen contract"
```

---

### Task 7: Update engineering checklist and push

**Files:**
- Modify: `docs/project-management/development_checklist.md`

**Interfaces:**
- Consumes: completed Tasks 1-6.
- Produces: updated checklist; phase pushed to `origin/main`.

- [ ] **Step 1: Tick the items delivered by this phase**

In `docs/project-management/development_checklist.md`, change `[ ]` to `[x]` for:

- Under **Data model**: `Scenario model`, `Threat model`
- Under **Scenario engine**: `Seed support`, `Scenario validation`, `Environment`, `Day/night`, `Visibility`, `Sensor quality`, `Threat count`, `Difficulty`, `Spawn timing`, `Anti-repetition logic`
- Under **Backend**: `Scenario endpoint`

- [ ] **Step 2: Run the full suite one final time**

Run from `backend/`: `.venv/Scripts/python -m pytest tests -v`
Expected: all pass

- [ ] **Step 3: Confirm a clean tree and review the log**

Run: `git status --short` (expect only the checklist change staged/untracked) and `git log --oneline -12`.

- [ ] **Step 4: Commit and push**

```bash
git add docs/project-management/development_checklist.md
git commit -m "docs(checklist): mark scenario engine phase complete"
git push origin main
```

---

## Phase DoD

- `.venv/Scripts/python -m pytest tests -v` green (Phase 0 tests + 6 new test modules).
- `POST /api/v1/scenarios/generate` returns contract-shaped JSON; same seed reproduces identically via curl.
- Infeasible difficulty returns 422; invalid bodies return 422.
- Contract conformance test guards implemented routes.
- Checklist updated; `main` pushed.
