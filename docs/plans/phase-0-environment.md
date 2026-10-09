# Phase 0 — Environment & Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the backend Python environment, a runnable FastAPI app with a tested `/health` endpoint, and freeze the v1 API contract so Phases 1+ build against one source of truth.

**Architecture:** `backend/` is an isolated Python 3.12 venv running FastAPI under pytest via TestClient. The OpenAPI contract lives at `docs/api/openapi.yaml` and is guarded by a contract test in the backend suite, so later phases (scenario engine, scoring, browser client) all consume the same frozen shapes.

**Tech Stack:** Python 3.12, FastAPI, Uvicorn, Pydantic, SQLAlchemy, pytest, httpx, PyYAML

**Specs:** `docs/guides/local_setup.md` (env steps), `docs/api/api_specification.md` (the 7 endpoints), `docs/modules/system_architecture.md` (communication), `docs/project-management/git_workflow.md` (commit style)

## Global Constraints

- Commits go to `main` with Conventional Commits, one logical change each (`docs/project-management/git_workflow.md`)
- API base is `/api/v1`, content type `application/json` (`docs/api/api_specification.md §1`)
- `GET /health` returns exactly `{"status": "ok"}` (`docs/modules/fastapi_backend.md §4`)
- No secrets, no `.env`, no `*.db`, no `node_modules`/`dist` committed (`docs/project-management/git_workflow.md`)
- Every task ends with pytest green before its commit
- venv lives at `backend/.venv` and stays gitignored
- Test command (run from `backend/`): `.venv/Scripts/python -m pytest tests -v`
- Contract schema names defined in Task 4 are load-bearing: Phases 1–6 mirror them exactly

---

### Task 1: Backend venv and pinned dependencies

**Files:**
- Create: `backend/requirements.txt`

**Interfaces:**
- Produces: `backend/.venv` (Python 3.12 venv, gitignored) with packages `fastapi`, `uvicorn`, `pydantic`, `sqlalchemy`, `pytest`, `httpx`, `pyyaml`; `backend/requirements.txt` with exact pinned versions. Task 2 runs pytest from this venv; Task 4 imports `yaml`.

- [ ] **Step 1: Create venv and install dependencies**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install fastapi uvicorn pydantic sqlalchemy pytest httpx pyyaml
```

- [ ] **Step 2: Freeze exact versions**

```powershell
.venv\Scripts\python -m pip freeze > requirements.txt
```

- [ ] **Step 3: Verify every required package imports**

```powershell
.venv\Scripts\python -c "import fastapi, uvicorn, pydantic, sqlalchemy, pytest, httpx, yaml; print('ok')"
```

Expected output: `ok`

- [ ] **Step 4: Verify venv is ignored**

Run `git status --short` — `backend/.venv/` must NOT appear.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(backend): add pinned python dependencies for fastapi stack"
```

---

### Task 2: FastAPI app skeleton with /health (TDD)

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_health.py`
- Create: `backend/pytest.ini`

**Interfaces:**
- Consumes: venv from Task 1
- Produces: `app.main:app` (the FastAPI instance — every later route registers on it); `GET /health` → `200 {"status": "ok"}`; runnable test suite from `backend/`

- [ ] **Step 1: Write the failing test**

`backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_health.py -v`

Expected: FAIL with `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: Write pytest config and minimal implementation**

`backend/pytest.ini`:

```ini
[pytest]
testpaths = tests
pythonpath = .
```

`backend/app/__init__.py` and `backend/tests/__init__.py`: empty files.

`backend/app/main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="AEROVIGIL API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `backend/`: `.venv/Scripts/python -m pytest tests -v`

Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests backend/pytest.ini
git commit -m "feat(api): add fastapi app with health endpoint"
```

---

### Task 3: Extend .gitignore for databases and node artifacts

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: existing `.gitignore` (already covers `.venv/`, `__pycache__/`, `.env`, Unity dirs)
- Produces: root `.gitignore` additionally ignoring `*.db`, `*.sqlite3`, `node_modules/`, `dist/`, `.superpowers/` — required by `docs/project-management/git_workflow.md §.gitignore` and needed before Phases 3/6 create Node projects and Phase 1 creates SQLite files.

- [ ] **Step 1: Verify current ignore behavior of a database file**

```powershell
New-Item -ItemType File -Path test.db -Force | Out-Null
git status --short
```

Expected: `test.db` IS listed (untracked) — proving `*.db` is not yet ignored.

- [ ] **Step 2: Append the missing entries**

Append to `.gitignore` (before the `# Logs` section or at end):

```gitignore
# Databases
*.db
*.sqlite3

# Node
node_modules/
dist/

# SDD workspace
.superpowers/
```

- [ ] **Step 3: Verify the ignore now works**

```powershell
git status --short
```

Expected: `test.db` is NOT listed. Then remove it:

```powershell
Remove-Item test.db
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(repo): ignore database, node and workspace artifacts"
```

---

### Task 4: Freeze the v1 OpenAPI contract

**Files:**
- Create: `docs/api/openapi.yaml`
- Create: `backend/tests/test_contract.py`

**Interfaces:**
- Consumes: PyYAML from Task 1, test suite from Task 2
- Produces: `docs/api/openapi.yaml` — frozen shapes for `ScenarioGenerateRequest`, `Scenario`, `ThreatProfile`, `SessionCreateRequest`, `SessionCreated`, `EventCreateRequest`, `EventCreated`, `CompleteResponse`, `ScoreResult`, `TimingMetrics`, `Mistake`, `AAR`, `PerformanceProfile`, `RecommendRequest`, `RecommendResponse`. Phases 1–6 must mirror these names and fields exactly. Endpoints: all 7 from `docs/api/api_specification.md` under `/api/v1`.

- [ ] **Step 1: Write the failing contract test**

`backend/tests/test_contract.py`:

```python
from pathlib import Path

import yaml

CONTRACT = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.yaml"

EXPECTED_PATHS = {
    "/api/v1/scenarios/generate",
    "/api/v1/sessions",
    "/api/v1/sessions/{session_id}/events",
    "/api/v1/sessions/{session_id}/complete",
    "/api/v1/sessions/{session_id}/aar",
    "/api/v1/trainees/{trainee_id}/performance",
    "/api/v1/training/recommend",
}

EXPECTED_SCHEMAS = {
    "ScenarioGenerateRequest",
    "Scenario",
    "ThreatProfile",
    "SessionCreateRequest",
    "SessionCreated",
    "EventCreateRequest",
    "EventCreated",
    "CompleteResponse",
    "ScoreResult",
    "TimingMetrics",
    "Mistake",
    "AAR",
    "PerformanceProfile",
    "RecommendRequest",
    "RecommendResponse",
}


def _spec() -> dict:
    assert CONTRACT.exists(), f"contract missing: {CONTRACT}"
    return yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))


def test_contract_is_openapi_3() -> None:
    spec = _spec()
    assert spec["openapi"].startswith("3.")
    assert spec["info"]["title"] == "AEROVIGIL API"


def test_contract_lists_all_v1_endpoints() -> None:
    spec = _spec()
    assert EXPECTED_PATHS <= set(spec["paths"])


def test_contract_defines_core_schemas() -> None:
    spec = _spec()
    assert EXPECTED_SCHEMAS <= set(spec["components"]["schemas"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `backend/`: `.venv/Scripts/python -m pytest tests/test_contract.py -v`

Expected: 3 FAIL with `contract missing` assertion

- [ ] **Step 3: Write the contract**

Create `docs/api/openapi.yaml` with exactly this content:

```yaml
openapi: 3.0.3
info:
  title: AEROVIGIL API
  version: "1.0.0"
  description: Training simulator backend - scenario, sessions, scoring, AAR, adaptive recommendation.
servers:
  - url: http://127.0.0.1:8000
paths:
  /api/v1/scenarios/generate:
    post:
      summary: Generate a deterministic training scenario
      operationId: generateScenario
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ScenarioGenerateRequest"
      responses:
        "200":
          description: Generated scenario
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Scenario"
        "422":
          description: Invalid scenario configuration
  /api/v1/sessions:
    post:
      summary: Create a training session for a trainee
      operationId: createSession
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SessionCreateRequest"
      responses:
        "201":
          description: Session created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SessionCreated"
  /api/v1/sessions/{session_id}/events:
    post:
      summary: Record a timestamped trainee event
      operationId: createEvent
      parameters:
        - name: session_id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/EventCreateRequest"
      responses:
        "201":
          description: Event recorded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/EventCreated"
        "404":
          description: Session not found
  /api/v1/sessions/{session_id}/complete:
    post:
      summary: End the session and score it server-side
      operationId: completeSession
      parameters:
        - name: session_id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Session scored
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CompleteResponse"
        "404":
          description: Session not found
  /api/v1/sessions/{session_id}/aar:
    get:
      summary: Retrieve the After Action Review for a session
      operationId: getAar
      parameters:
        - name: session_id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: AAR document
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AAR"
        "404":
          description: Session or AAR not found
  /api/v1/trainees/{trainee_id}/performance:
    get:
      summary: Historical aggregate performance for a trainee
      operationId: getPerformance
      parameters:
        - name: trainee_id
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Performance profile
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PerformanceProfile"
  /api/v1/training/recommend:
    post:
      summary: Recommend the next training configuration from recent performance
      operationId: recommendTraining
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RecommendRequest"
      responses:
        "200":
          description: Recommendation with evidence-based reason
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/RecommendResponse"
components:
  schemas:
    ScenarioGenerateRequest:
      type: object
      required: [difficulty, environment, time_of_day, threat_count]
      properties:
        difficulty:
          type: integer
          minimum: 1
          maximum: 10
        environment:
          type: string
          enum: [urban, rural]
        time_of_day:
          type: string
          enum: [day, night]
        threat_count:
          type: integer
          enum: [1, 2, 3, 5]
        seed:
          type: integer
          description: Optional; server generates one when omitted.
    Scenario:
      type: object
      required: [scenario_id, seed, generator_version, difficulty, environment, time_of_day, visibility, sensor_quality, duration_seconds, threats]
      properties:
        scenario_id:
          type: string
          example: SCN-100
        seed:
          type: integer
        generator_version:
          type: string
          example: "1.0"
        difficulty:
          type: integer
          minimum: 1
          maximum: 10
        environment:
          type: string
          enum: [urban, rural]
        time_of_day:
          type: string
          enum: [day, night]
        visibility:
          type: string
          enum: [clear, reduced, poor]
        sensor_quality:
          type: number
          minimum: 0
          maximum: 1
        duration_seconds:
          type: number
          exclusiveMinimum: 0
        threats:
          type: array
          items:
            $ref: "#/components/schemas/ThreatProfile"
    ThreatProfile:
      type: object
      required: [id, classification_label, expected_response, spawn_time]
      properties:
        id:
          type: string
          example: T01
        category:
          type: string
          default: unknown_aerial_object
        classification_label:
          type: string
          enum: [friendly, civilian, unknown, suspicious, hostile]
        expected_response:
          type: string
          enum: [monitor, track, report, hold]
        spawn_time:
          type: number
          minimum: 0
        speed_class:
          type: string
          enum: [slow, medium, fast]
        visibility_class:
          type: string
          enum: [clear, reduced, poor]
    SessionCreateRequest:
      type: object
      required: [trainee_id, scenario_id]
      properties:
        trainee_id:
          type: string
          example: TRAIN-001
        scenario_id:
          type: string
    SessionCreated:
      type: object
      required: [session_id, status]
      properties:
        session_id:
          type: string
        status:
          type: string
          enum: [active]
    EventCreateRequest:
      type: object
      required: [type, timestamp_ms]
      properties:
        type:
          type: string
          enum:
            - SESSION_STARTED
            - SCENARIO_LOADED
            - THREAT_SPAWNED
            - THREAT_DETECTED
            - CLASSIFICATION_SUBMITTED
            - RESPONSE_SUBMITTED
            - FALSE_ALARM
            - THREAT_MISSED
            - THREAT_RESOLVED
            - SESSION_PAUSED
            - SESSION_RESUMED
            - SESSION_COMPLETED
        timestamp_ms:
          type: integer
          minimum: 0
        threat_id:
          type: string
        payload:
          type: object
          additionalProperties: true
    EventCreated:
      type: object
      required: [event_id, accepted]
      properties:
        event_id:
          type: string
        accepted:
          type: boolean
    CompleteResponse:
      type: object
      required: [session_id, final_score, aar_available, scoring_version]
      properties:
        session_id:
          type: string
        final_score:
          type: integer
          minimum: 0
          maximum: 100
        aar_available:
          type: boolean
        scoring_version:
          type: integer
    ScoreResult:
      type: object
      required: [session_id, detection_score, classification_score, response_score, timing_score, penalty, final_score, scoring_version]
      properties:
        session_id:
          type: string
        detection_score:
          type: number
        classification_score:
          type: number
        response_score:
          type: number
        timing_score:
          type: number
        penalty:
          type: number
        final_score:
          type: number
          minimum: 0
          maximum: 100
        scoring_version:
          type: integer
    TimingMetrics:
      type: object
      properties:
        mean_time_to_detection_ms:
          type: number
        mean_detection_to_classification_ms:
          type: number
        mean_classification_to_response_ms:
          type: number
        mean_total_decision_ms:
          type: number
    Mistake:
      type: object
      required: [kind, timestamp_ms]
      properties:
        kind:
          type: string
          enum: [missed_threat, false_alarm, classification_error, response_error]
        threat_id:
          type: string
        timestamp_ms:
          type: integer
        detail:
          type: string
    AAR:
      type: object
      required: [session_id, scenario_id, summary, scores, timing, mistakes, strengths, weaknesses, recommendation, timeline]
      properties:
        session_id:
          type: string
        scenario_id:
          type: string
        summary:
          type: string
        scores:
          $ref: "#/components/schemas/ScoreResult"
        timing:
          $ref: "#/components/schemas/TimingMetrics"
        mistakes:
          type: array
          items:
            $ref: "#/components/schemas/Mistake"
        strengths:
          type: array
          items:
            type: string
        weaknesses:
          type: array
          items:
            type: string
        recommendation:
          type: string
        timeline:
          type: array
          items:
            $ref: "#/components/schemas/EventCreateRequest"
    PerformanceProfile:
      type: object
      required: [trainee_id, session_count, detection_accuracy, classification_accuracy, response_accuracy]
      properties:
        trainee_id:
          type: string
        session_count:
          type: integer
        detection_accuracy:
          type: number
          minimum: 0
          maximum: 100
        classification_accuracy:
          type: number
          minimum: 0
          maximum: 100
        response_accuracy:
          type: number
          minimum: 0
          maximum: 100
        average_reaction_time_ms:
          type: number
        night_score:
          type: number
        day_score:
          type: number
        multi_threat_score:
          type: number
        low_visibility_score:
          type: number
        current_level:
          type: integer
          minimum: 1
          maximum: 10
    RecommendRequest:
      type: object
      required: [trainee_id]
      properties:
        trainee_id:
          type: string
    RecommendResponse:
      type: object
      required: [recommended_difficulty, environment, time_of_day, threat_count, reason]
      properties:
        recommended_difficulty:
          type: integer
          minimum: 1
          maximum: 10
        environment:
          type: string
          enum: [urban, rural]
        time_of_day:
          type: string
          enum: [day, night]
        threat_count:
          type: integer
          enum: [1, 2, 3, 5]
        reason:
          type: string
          description: Human-readable evidence drawn from measured session metrics.
```

- [ ] **Step 4: Run the full suite to verify pass**

Run from `backend/`: `.venv/Scripts/python -m pytest tests -v`

Expected: 4 passed (1 health + 3 contract)

- [ ] **Step 5: Commit**

```bash
git add docs/api/openapi.yaml backend/tests/test_contract.py
git commit -m "docs(api): freeze v1 openapi contract with guarded schema names"
```
