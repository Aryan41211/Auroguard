# Phase 3 — Browser Client Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first playable demo — a browser trainee completes one end-to-end session (scenario → detect/classify/respond → score → AAR) against the live FastAPI backend.

**Architecture:** Add a new `client/` Vite + TypeScript + Three.js single-page app. The backend stays the authority (it generates scenarios and scores). The client is a thin presentation layer: it loads a scenario, renders primitives in a 3D scene, records trainee actions as events, submits them to `/api/v1`, and displays the server-computed scorecard. Screens are toggled by a tiny hand-written state machine (no UI framework). Two small backend changes support the demo: expose the full score breakdown on `POST /complete`, and enable CORS for the browser origin.

**Tech Stack:** TypeScript · Vite · Three.js · Vitest (client) · FastAPI (existing backend) · Python 3.12.

**Spec:** `docs/guides/first_vertical_slice.md` (slice DoD §Definition of done), `docs/api/api_specification.md`, `docs/modules/event_and_data_model.md`, `docs/api/openapi.yaml` (frozen contract), `docs/plans/00-master-roadmap.md` (Phase 3).

## Global Constraints

- **Git:** direct commits to `main`; Conventional Commits; commit after every meaningful change; push at phase end (`docs/project-management/git_workflow.md`).
- **Authority split:** client NEVER scores; server scores from persisted events (`docs/modules/scoring_engine.md §11`).
- **Contract:** `docs/api/openapi.yaml` is the single source of truth; extend it in the same change as any schema change.
- **Determinism:** same seed + generator_version ⇒ identical scenario (client only renders what the server returns).
- **Scope:** visuals are primitives only (ground, fog, one light, box/sphere threats). No models, textures, or assets.
- **Client event payload keys (binding):** `CLASSIFICATION_SUBMITTED` → `payload.label`; `RESPONSE_SUBMITTED` → `payload.response` (the backend reads exactly these — see `backend/app/services/scoring.py:77,83`).
- **First-attempt-wins:** each threat's classification and response may be submitted at most once (server scores the first event; see Phase 2 ruling). The client enforces this with per-threat stage locks.
- **No new backend dependencies.** Client deps limited to `three` (runtime) + `vite`, `typescript`, `vitest`, `@types/three` (dev).
- **Ports:** backend `http://localhost:8000`; Vite dev server `http://localhost:5173` with `/api` proxied to the backend.

---

## File Structure

**Backend (modified):**
- `backend/app/schemas/session.py` — extend `CompleteResponse` with the score breakdown.
- `backend/app/api/sessions.py` — return the breakdown from both `/complete` paths.
- `backend/app/main.py` — add CORS middleware.
- `backend/tests/test_sessions_api.py`, `backend/tests/test_cors.py` (new) — tests.
- `docs/api/openapi.yaml`, `docs/api/api_specification.md` — contract/spec updates.

**Client (new):**
- `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`
- `client/src/main.ts` — orchestrator: screen switching, session lifecycle, event queue.
- `client/src/api/types.ts` — TS mirror of the frozen contract.
- `client/src/api/client.ts` — typed fetch wrappers (injectable `fetch`).
- `client/src/state/events.ts` — event builders + timestamp clock.
- `client/src/state/session.ts` — `SessionController` state machine.
- `client/src/sim/scene.ts` — Three.js scene/renderer/camera.
- `client/src/sim/threats.ts` — deterministic threat mesh + path.
- `client/src/sim/spawner.ts` — schedules spawns at `spawn_time`.
- `client/src/ui/startPanel.ts`, `ui/hud.ts`, `ui/actions.ts`, `ui/aar.ts`
- `client/src/styles.css`
- `client/src/**/*.test.ts` — Vitest unit tests.

---

### Task 1: Backend — expose the full score breakdown on `/complete`

**Files:**
- Modify: `backend/app/schemas/session.py`
- Modify: `backend/app/api/sessions.py:105-158`
- Modify: `backend/tests/test_sessions_api.py`
- Modify: `docs/api/openapi.yaml:291-304`
- Modify: `docs/api/api_specification.md:70-82`

**Interfaces:**
- Produces: `CompleteResponse` gains `detection_score: float`, `classification_score: float`, `response_score: float`, `timing_score: float`, `penalty: float` (all `ge=0`; scores additionally `le=100`). The client (Task 3) types these fields.

- [ ] **Step 1: Write the failing test** — append to `backend/tests/test_sessions_api.py`

```python
def test_complete_returns_score_breakdown(client) -> None:
    scenario_id = _create_scenario(client)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    response = client.post(f"/api/v1/sessions/{session_id}/complete")
    assert response.status_code == 200
    body = response.json()
    for key in (
        "detection_score",
        "classification_score",
        "response_score",
        "timing_score",
        "penalty",
        "final_score",
        "scoring_version",
    ):
        assert key in body, key
    assert body["detection_score"] == 0.0  # no events submitted in this test
    assert body["final_score"] == 0.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_sessions_api.py::test_complete_returns_score_breakdown -v` (from `backend/`)
Expected: FAIL — `KeyError`/assert on missing `detection_score`.

- [ ] **Step 3: Extend the schema** — replace `CompleteResponse` in `backend/app/schemas/session.py`

```python
class CompleteResponse(BaseModel):
    session_id: str
    detection_score: float = Field(ge=0, le=100)
    classification_score: float = Field(ge=0, le=100)
    response_score: float = Field(ge=0, le=100)
    timing_score: float = Field(ge=0, le=100)
    penalty: float = Field(ge=0)
    final_score: float = Field(ge=0, le=100)
    aar_available: bool
    scoring_version: int
```

- [ ] **Step 4: Return the breakdown from both `/complete` paths** — `backend/app/api/sessions.py`

Idempotent early-return:

```python
    existing = db.get(ScoreRow, session_id)
    if existing is not None:
        return CompleteResponse(
            session_id=session_id,
            detection_score=existing.detection_score,
            classification_score=existing.classification_score,
            response_score=existing.response_score,
            timing_score=existing.timing_score,
            penalty=existing.penalty,
            final_score=existing.final_score,
            aar_available=True,
            scoring_version=existing.scoring_version,
        )
```

Fresh-compute return:

```python
    return CompleteResponse(
        session_id=session_id,
        detection_score=result.detection_score,
        classification_score=result.classification_score,
        response_score=result.response_score,
        timing_score=result.timing_score,
        penalty=result.penalty,
        final_score=result.final_score,
        aar_available=True,
        scoring_version=result.scoring_version,
    )
```

- [ ] **Step 5: Update the frozen contract and spec**

In `docs/api/openapi.yaml`, replace the `CompleteResponse` component body (lines ~291-304) so it reads:

```yaml
    CompleteResponse:
      type: object
      required: [session_id, detection_score, classification_score, response_score, timing_score, penalty, final_score, aar_available, scoring_version]
      properties:
        session_id:
          type: string
        detection_score:
          type: number
          minimum: 0
          maximum: 100
        classification_score:
          type: number
          minimum: 0
          maximum: 100
        response_score:
          type: number
          minimum: 0
          maximum: 100
        timing_score:
          type: number
          minimum: 0
          maximum: 100
        penalty:
          type: number
          minimum: 0
        final_score:
          type: number
          minimum: 0
          maximum: 100
        aar_available:
          type: boolean
        scoring_version:
          type: integer
```

In `docs/api/api_specification.md §5`, replace the response JSON example with:

```json
{
  "session_id": "SES-1001",
  "detection_score": 30.0,
  "classification_score": 30.0,
  "response_score": 25.0,
  "timing_score": 15.0,
  "penalty": 0.0,
  "final_score": 100.0,
  "aar_available": true,
  "scoring_version": 1
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests -q` (from `backend/`)
Expected: all pass (the new test + existing suite; contract conformance test still green).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/session.py backend/app/api/sessions.py backend/tests/test_sessions_api.py docs/api/openapi.yaml docs/api/api_specification.md
git commit -m "feat(api): expose score breakdown on session complete"
```

---

### Task 2: Backend — CORS for the browser origin

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_cors.py`

**Interfaces:**
- Produces: the API answers cross-origin requests from the Vite dev origins, so the client can call it directly (in addition to the dev proxy).

- [ ] **Step 1: Write the failing test** — `backend/tests/test_cors.py`

```python
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_preflight_allows_vite_origin() -> None:
    response = client.options(
        "/api/v1/scenarios/generate",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_simple_request_gets_allow_origin_header() -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_cors.py -v` (from `backend/`)
Expected: FAIL — no `access-control-allow-origin` header.

- [ ] **Step 3: Add the middleware** — `backend/app/main.py`

Add the import near the other FastAPI imports:

```python
from fastapi.middleware.cors import CORSMiddleware
```

Immediately after `app = FastAPI(...)` (line ~19):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/Scripts/python -m pytest tests -q` (from `backend/`)
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_cors.py
git commit -m "feat(api): allow CORS from the Vite dev origin"
```

---

### Task 3: Client scaffold, contract types, and typed API client

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/vite.config.ts`, `client/index.html`, `client/src/styles.css`
- Create: `client/src/api/types.ts`, `client/src/api/client.ts`
- Create: `client/src/api/client.test.ts`
- Modify: `.gitignore` (add `client/node_modules/`, `client/dist/`)

**Interfaces:**
- Produces:
  - `api/types.ts` — `Environment`, `TimeOfDay`, `Visibility`, `ClassificationLabel`, `ExpectedResponse`, `SpeedClass`, `EventType`, `ScenarioGenerateRequest`, `ThreatProfile`, `Scenario`, `SessionCreateRequest`, `SessionCreated`, `EventCreateRequest`, `EventCreated`, `CompleteResponse` (matches Task 1 output).
  - `api/client.ts` — `interface ApiClient { generateScenario(req): Promise<Scenario>; createSession(req): Promise<SessionCreated>; submitEvent(sessionId, event): Promise<EventCreated>; completeSession(sessionId): Promise<CompleteResponse>; }` and `createApiClient(base?: string, fetchFn?: typeof fetch): ApiClient`.

- [ ] **Step 1: Scaffold the package files**

`client/package.json`:

```json
{
  "name": "aeroguard-client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "three": "^0.169.0"
  },
  "devDependencies": {
    "@types/three": "^0.169.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

`client/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "types": ["vite/client"],
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`client/vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

`client/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aeroguard</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`client/src/styles.css`:

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #0b0f14; color: #e6edf3; }
#app { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
#scene { position: absolute; inset: 0; }
.panel { position: absolute; background: rgba(10, 20, 30, 0.85); border: 1px solid #2a3b4d; border-radius: 8px; padding: 12px; }
#start-panel, #aar-panel { inset: 0; display: flex; align-items: center; justify-content: center; }
#hud { top: 12px; left: 12px; min-width: 220px; font-size: 13px; }
#actions { bottom: 12px; left: 12px; display: flex; gap: 8px; flex-wrap: wrap; max-width: 70vw; }
button { background: #1f6feb; color: #fff; border: 0; border-radius: 6px; padding: 8px 12px; cursor: pointer; }
button:disabled { background: #30363d; cursor: default; }
label { display: block; margin: 6px 0; font-size: 13px; }
input, select { width: 100%; padding: 6px; background: #0d1117; color: #e6edf3; border: 1px solid #2a3b4d; border-radius: 6px; }
table { border-collapse: collapse; width: 100%; }
td, th { border-bottom: 1px solid #2a3b4d; padding: 6px 10px; text-align: left; }
```

- [ ] **Step 2: Write the contract types** — `client/src/api/types.ts`

```ts
export type Environment = "urban" | "rural";
export type TimeOfDay = "day" | "night";
export type Visibility = "clear" | "reduced" | "poor";
export type ClassificationLabel =
  | "friendly" | "civilian" | "unknown" | "suspicious" | "hostile";
export type ExpectedResponse = "monitor" | "track" | "report" | "hold";
export type SpeedClass = "slow" | "medium" | "fast";
export type ThreatCount = 1 | 2 | 3 | 5;

export interface ScenarioGenerateRequest {
  difficulty: number;
  environment: Environment;
  time_of_day: TimeOfDay;
  threat_count: ThreatCount;
  seed?: number | null;
}

export interface ThreatProfile {
  id: string;
  category: string;
  classification_label: ClassificationLabel;
  expected_response: ExpectedResponse;
  spawn_time: number;
  speed_class: SpeedClass | null;
  visibility_class: Visibility | null;
}

export interface Scenario {
  scenario_id: string;
  seed: number;
  generator_version: string;
  difficulty: number;
  environment: Environment;
  time_of_day: TimeOfDay;
  visibility: Visibility;
  sensor_quality: number;
  duration_seconds: number;
  threats: ThreatProfile[];
}

export interface SessionCreateRequest { trainee_id: string; scenario_id: string; }
export interface SessionCreated { session_id: string; status: "active"; }

export type EventType =
  | "SESSION_STARTED" | "SCENARIO_LOADED" | "THREAT_SPAWNED"
  | "THREAT_DETECTED" | "CLASSIFICATION_SUBMITTED" | "RESPONSE_SUBMITTED"
  | "FALSE_ALARM" | "THREAT_MISSED" | "THREAT_RESOLVED"
  | "SESSION_PAUSED" | "SESSION_RESUMED" | "SESSION_COMPLETED";

export interface EventCreateRequest {
  type: EventType;
  timestamp_ms: number;
  threat_id?: string | null;
  payload?: Record<string, unknown>;
}
export interface EventCreated { event_id: string; accepted: boolean; }

export interface CompleteResponse {
  session_id: string;
  detection_score: number;
  classification_score: number;
  response_score: number;
  timing_score: number;
  penalty: number;
  final_score: number;
  aar_available: boolean;
  scoring_version: number;
}
```

- [ ] **Step 3: Write the failing test** — `client/src/api/client.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import type { CompleteResponse, Scenario, SessionCreated } from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createApiClient", () => {
  it("POSTs a scenario request to /api/v1/scenarios/generate and returns the body", async () => {
    const scenario = { scenario_id: "SCN-000001" } as Scenario;
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(scenario));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    const result = await api.generateScenario({
      difficulty: 3, environment: "urban", time_of_day: "day", threat_count: 1,
    });

    expect(result).toEqual(scenario);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/v1/scenarios/generate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ difficulty: 3, environment: "urban" });
  });

  it("creates a session and submits an event", async () => {
    const session = { session_id: "SES-1", status: "active" } as SessionCreated;
    const created = { event_id: "EVT-001", accepted: true };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse(created));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    await api.createSession({ trainee_id: "TRAIN-001", scenario_id: "SCN-000001" });
    const emitted = await api.submitEvent("SES-1", {
      type: "THREAT_DETECTED", timestamp_ms: 1000, threat_id: "T01",
    });

    expect(emitted).toEqual(created);
    expect(fetchFn.mock.calls[1][0]).toBe("/api/v1/sessions/SES-1/events");
  });

  it("throws with status and detail on a non-2xx response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ detail: "unknown session_id: SES-X" }, 404),
    );
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);
    await expect(api.completeSession("SES-X")).rejects.toThrow(/404.*unknown session_id/);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm install` then `npm test` in `client/`
Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 5: Implement the client** — `client/src/api/client.ts`

```ts
import type {
  CompleteResponse, EventCreateRequest, EventCreated,
  Scenario, ScenarioGenerateRequest, SessionCreateRequest, SessionCreated,
} from "./types";

export interface ApiClient {
  generateScenario(request: ScenarioGenerateRequest): Promise<Scenario>;
  createSession(request: SessionCreateRequest): Promise<SessionCreated>;
  submitEvent(sessionId: string, event: EventCreateRequest): Promise<EventCreated>;
  completeSession(sessionId: string): Promise<CompleteResponse>;
}

export function createApiClient(
  base = "/api/v1",
  fetchFn: typeof fetch = fetch,
): ApiClient {
  async function post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetchFn(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const parsed = (await response.json()) as { detail?: unknown };
        if (parsed.detail !== undefined) detail = String(parsed.detail);
      } catch {
        // keep statusText
      }
      throw new Error(`${response.status} ${detail}`);
    }
    return (await response.json()) as T;
  }

  return {
    generateScenario: (request) => post<Scenario>("/scenarios/generate", request),
    createSession: (request) => post<SessionCreated>("/sessions", request),
    submitEvent: (sessionId, event) =>
      post<EventCreated>(`/sessions/${sessionId}/events`, event),
    completeSession: (sessionId) =>
      post<CompleteResponse>(`/sessions/${sessionId}/complete`),
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test` in `client/`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add client .gitignore
git commit -m "feat(client): scaffold vite+ts app with contract types and typed api client"
```

---

### Task 4: Client — event builders and the session state machine

**Files:**
- Create: `client/src/state/events.ts`, `client/src/state/session.ts`
- Create: `client/src/state/events.test.ts`, `client/src/state/session.test.ts`

**Interfaces:**
- Consumes: types from `api/types.ts` (Task 3).
- Produces:
  - `events.ts`: `buildEvent(type, timestamp_ms, opts?)`; `events` object with `sessionStarted(ts)`, `scenarioLoaded(ts)`, `threatSpawned(id, ts)`, `threatDetected(id, ts)`, `classification(id, label, ts)`, `response(id, response, ts)`, `threatResolved(id, ts)`, `falseAlarm(ts)`, `sessionCompleted(ts)`.
  - `session.ts`: `type ThreatStage = "pending" | "spawned" | "detected" | "classified" | "responded"`; `class SessionController` with `constructor(scenario, sessionId, traineeId, opts: { emit: (e: EventCreateRequest) => void; now: () => number })`, methods `start()`, `spawnThreat(id)`, `detect(id): boolean`, `classify(id, label): boolean`, `respond(id, response): boolean`, `falseAlarm()`, `complete()`, and readonly fields `events`, `threats`, `status`.

- [ ] **Step 1: Write the failing tests** — `client/src/state/events.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { buildEvent, events } from "./events";

describe("event builders", () => {
  it("defaults threat_id to null and payload to {}", () => {
    expect(buildEvent("SESSION_STARTED", 0)).toEqual({
      type: "SESSION_STARTED", timestamp_ms: 0, threat_id: null, payload: {},
    });
  });

  it("puts label under payload.label and response under payload.response", () => {
    expect(events.classification("T01", "hostile", 1500).payload).toEqual({ label: "hostile" });
    expect(events.response("T01", "hold", 2000).payload).toEqual({ response: "hold" });
  });

  it("carries the threat id on threat-scoped events", () => {
    expect(events.threatDetected("T02", 900).threat_id).toBe("T02");
    expect(events.falseAlarm(3000).threat_id).toBeNull();
  });
});
```

`client/src/state/session.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { EventCreateRequest, Scenario, ThreatProfile } from "../api/types";
import { SessionController } from "./session";

function threat(id: string): ThreatProfile {
  return {
    id, category: "unknown_aerial_object", classification_label: "hostile",
    expected_response: "hold", spawn_time: 1, speed_class: "medium", visibility_class: "clear",
  };
}

function scenario(): Scenario {
  return {
    scenario_id: "SCN-000001", seed: 1, generator_version: "1.0", difficulty: 3,
    environment: "urban", time_of_day: "day", visibility: "clear",
    sensor_quality: 1, duration_seconds: 120, threats: [threat("T01"), threat("T02")],
  };
}

function setup() {
  const emitted: EventCreateRequest[] = [];
  let clock = 0;
  const controller = new SessionController(scenario(), "SES-1", "TRAIN-001", {
    emit: (e) => emitted.push(e),
    now: () => clock,
  });
  return { controller, emitted, setClock: (v: number) => { clock = v; } };
}

describe("SessionController", () => {
  it("emits SESSION_STARTED and SCENARIO_LOADED on start", () => {
    const { controller, emitted } = setup();
    controller.start();
    expect(emitted.map((e) => e.type)).toEqual(["SESSION_STARTED", "SCENARIO_LOADED"]);
  });

  it("enforces first-attempt-wins per threat", () => {
    const { controller, emitted, setClock } = setup();
    controller.start();
    controller.spawnThreat("T01");
    setClock(1000);
    expect(controller.detect("T01")).toBe(true);
    expect(controller.detect("T01")).toBe(false); // second detect ignored
    expect(controller.classify("T01", "hostile")).toBe(true);
    expect(controller.classify("T01", "friendly")).toBe(false); // second classify ignored
    expect(controller.respond("T01", "hold")).toBe(true);
    expect(controller.respond("T01", "monitor")).toBe(false);
    const types = emitted.map((e) => e.type);
    expect(types.filter((t) => t === "THREAT_DETECTED")).toHaveLength(1);
    expect(types.filter((t) => t === "CLASSIFICATION_SUBMITTED")).toHaveLength(1);
    expect(types.filter((t) => t === "RESPONSE_SUBMITTED")).toHaveLength(1);
  });

  it("rejects classify before detect and respond before classify", () => {
    const { controller } = setup();
    controller.spawnThreat("T01");
    expect(controller.classify("T01", "hostile")).toBe(false);
    expect(controller.detect("T01")).toBe(true);
    expect(controller.respond("T01", "hold")).toBe(false);
  });

  it("uses the injected clock for event timestamps", () => {
    const { controller, emitted, setClock } = setup();
    setClock(2500);
    controller.spawnThreat("T01");
    controller.detect("T01");
    expect(emitted.find((e) => e.type === "THREAT_DETECTED")?.timestamp_ms).toBe(2500);
  });

  it("completes once and emits SESSION_COMPLETED", () => {
    const { controller, emitted } = setup();
    controller.start();
    controller.complete();
    controller.complete();
    expect(controller.status).toBe("completing");
    expect(emitted.filter((e) => e.type === "SESSION_COMPLETED")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` in `client/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `client/src/state/events.ts`**

```ts
import type {
  ClassificationLabel, EventCreateRequest, EventType, ExpectedResponse,
} from "../api/types";

export interface EventOptions {
  threat_id?: string | null;
  payload?: Record<string, unknown>;
}

export function buildEvent(
  type: EventType,
  timestamp_ms: number,
  opts: EventOptions = {},
): EventCreateRequest {
  return {
    type,
    timestamp_ms,
    threat_id: opts.threat_id ?? null,
    payload: opts.payload ?? {},
  };
}

export const events = {
  sessionStarted: (ts: number) => buildEvent("SESSION_STARTED", ts),
  scenarioLoaded: (ts: number) => buildEvent("SCENARIO_LOADED", ts),
  threatSpawned: (id: string, ts: number) =>
    buildEvent("THREAT_SPAWNED", ts, { threat_id: id }),
  threatDetected: (id: string, ts: number) =>
    buildEvent("THREAT_DETECTED", ts, { threat_id: id }),
  classification: (id: string, label: ClassificationLabel, ts: number) =>
    buildEvent("CLASSIFICATION_SUBMITTED", ts, { threat_id: id, payload: { label } }),
  response: (id: string, response: ExpectedResponse, ts: number) =>
    buildEvent("RESPONSE_SUBMITTED", ts, { threat_id: id, payload: { response } }),
  threatResolved: (id: string, ts: number) =>
    buildEvent("THREAT_RESOLVED", ts, { threat_id: id }),
  falseAlarm: (ts: number) => buildEvent("FALSE_ALARM", ts),
  sessionCompleted: (ts: number) => buildEvent("SESSION_COMPLETED", ts),
};
```

- [ ] **Step 4: Implement `client/src/state/session.ts`**

```ts
import type {
  ClassificationLabel, EventCreateRequest, ExpectedResponse, Scenario, ThreatProfile,
} from "../api/types";
import { events } from "./events";

export type ThreatStage = "pending" | "spawned" | "detected" | "classified" | "responded";
export type SessionStatus = "idle" | "active" | "completing" | "complete";

export interface ThreatState {
  profile: ThreatProfile;
  stage: ThreatStage;
}

export interface SessionControllerOptions {
  emit: (event: EventCreateRequest) => void;
  now: () => number;
}

export class SessionController {
  readonly scenario: Scenario;
  readonly sessionId: string;
  readonly traineeId: string;
  readonly events: EventCreateRequest[] = [];
  readonly threats: ThreatState[];
  status: SessionStatus = "active";

  private readonly emit: (event: EventCreateRequest) => void;
  private readonly now: () => number;

  constructor(
    scenario: Scenario,
    sessionId: string,
    traineeId: string,
    options: SessionControllerOptions,
  ) {
    this.scenario = scenario;
    this.sessionId = sessionId;
    this.traineeId = traineeId;
    this.emit = options.emit;
    this.now = options.now;
    this.threats = scenario.threats.map((profile) => ({ profile, stage: "pending" }));
  }

  private threat(id: string): ThreatState | undefined {
    return this.threats.find((t) => t.profile.id === id);
  }

  private record(event: EventCreateRequest): void {
    this.events.push(event);
    this.emit(event);
  }

  start(): void {
    this.record(events.sessionStarted(this.now()));
    this.record(events.scenarioLoaded(this.now()));
  }

  spawnThreat(id: string): void {
    const threat = this.threat(id);
    if (threat === undefined || threat.stage !== "pending") return;
    threat.stage = "spawned";
    this.record(events.threatSpawned(id, this.now()));
  }

  detect(id: string): boolean {
    const threat = this.threat(id);
    if (threat === undefined || threat.stage !== "spawned") return false;
    threat.stage = "detected";
    this.record(events.threatDetected(id, this.now()));
    return true;
  }

  classify(id: string, label: ClassificationLabel): boolean {
    const threat = this.threat(id);
    if (threat === undefined || threat.stage !== "detected") return false;
    threat.stage = "classified";
    this.record(events.classification(id, label, this.now()));
    return true;
  }

  respond(id: string, response: ExpectedResponse): boolean {
    const threat = this.threat(id);
    if (threat === undefined || threat.stage !== "classified") return false;
    threat.stage = "responded";
    this.record(events.response(id, response, this.now()));
    this.record(events.threatResolved(id, this.now()));
    return true;
  }

  falseAlarm(): void {
    this.record(events.falseAlarm(this.now()));
  }

  complete(): void {
    if (this.status !== "active") return;
    this.status = "completing";
    this.record(events.sessionCompleted(this.now()));
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` in `client/`
Expected: PASS (api + events + session suites).

- [ ] **Step 6: Commit**

```bash
git add client/src/state
git commit -m "feat(client): add event builders and first-attempt-wins session state machine"
```

---

### Task 5: Client — Three.js scene, threat meshes, and spawner

**Files:**
- Create: `client/src/sim/scene.ts`, `client/src/sim/threats.ts`, `client/src/sim/spawner.ts`
- Create: `client/src/sim/spawner.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `ThreatProfile` (Task 3).
- Produces:
  - `scene.ts`: `interface SimScene { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; render(): void; dispose(): void }` and `createSimScene(container: HTMLElement, scenario: Scenario): SimScene`.
  - `threats.ts`: `interface ThreatView { profile: ThreatProfile; mesh: THREE.Object3D }`; `createThreatView(profile: ThreatProfile): ThreatView`; `updateThreatView(view: ThreatView, elapsedSec: number): void`.
  - `spawner.ts`: `class Spawner { constructor(scenario: Scenario, onSpawn: (id: string) => void); update(elapsedSec: number): void; }` — calls `onSpawn` exactly once per threat when `elapsedSec >= spawn_time`.

- [ ] **Step 1: Write the failing test** — `client/src/sim/spawner.test.ts` (pure scheduling logic; no WebGL)

```ts
import { describe, expect, it } from "vitest";
import type { Scenario, ThreatProfile } from "../api/types";
import { Spawner } from "./spawner";

function threat(id: string, spawn_time: number): ThreatProfile {
  return {
    id, category: "unknown_aerial_object", classification_label: "unknown",
    expected_response: "track", spawn_time, speed_class: "medium", visibility_class: "clear",
  };
}
function scenario(): Scenario {
  return {
    scenario_id: "SCN-000001", seed: 1, generator_version: "1.0", difficulty: 3,
    environment: "urban", time_of_day: "day", visibility: "clear", sensor_quality: 1,
    duration_seconds: 120, threats: [threat("T01", 1), threat("T02", 3)],
  };
}

describe("Spawner", () => {
  it("spawns each threat exactly once at or after its spawn_time", () => {
    const spawned: string[] = [];
    const spawner = new Spawner(scenario(), (id) => spawned.push(id));
    spawner.update(0);
    expect(spawned).toEqual([]);
    spawner.update(1);
    expect(spawned).toEqual(["T01"]);
    spawner.update(2.9);
    expect(spawned).toEqual(["T01"]);
    spawner.update(3.0);
    spawner.update(4.0);
    expect(spawned).toEqual(["T01", "T02"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` in `client/`
Expected: FAIL — `Cannot find module './spawner'`.

- [ ] **Step 3: Implement `client/src/sim/spawner.ts`**

```ts
import type { Scenario } from "../api/types";

export class Spawner {
  private readonly pending: { id: string; spawn_time: number }[];
  private readonly onSpawn: (id: string) => void;

  constructor(scenario: Scenario, onSpawn: (id: string) => void) {
    this.onSpawn = onSpawn;
    this.pending = scenario.threats.map((t) => ({ id: t.id, spawn_time: t.spawn_time }));
  }

  update(elapsedSec: number): void {
    for (let i = this.pending.length - 1; i >= 0; i -= 1) {
      if (elapsedSec >= this.pending[i].spawn_time) {
        const [ready] = this.pending.splice(i, 1);
        this.onSpawn(ready.id);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` in `client/`
Expected: PASS.

- [ ] **Step 5: Implement `client/src/sim/threats.ts`** (deterministic path from the threat id — no randomness)

```ts
import * as THREE from "three";
import type { SpeedClass, ThreatProfile } from "../api/types";

const SPEED_UNITS: Record<SpeedClass, number> = { slow: 3, medium: 6, fast: 10 };

export interface ThreatView {
  profile: ThreatProfile;
  mesh: THREE.Object3D;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

export function createThreatView(profile: ThreatProfile): ThreatView {
  const hash = hashString(profile.id);
  const geometry = new THREE.BoxGeometry(2, 1, 2);
  const color = profile.classification_label === "hostile" ? 0xff5555 : 0x8899aa;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  mesh.visible = false;
  mesh.userData.startX = ((hash % 200) / 200) * 80 - 40;
  mesh.userData.row = ((hash >> 3) % 3) - 1;
  return { profile, mesh };
}

export function updateThreatView(view: ThreatView, elapsedSec: number): void {
  const speed = SPEED_UNITS[view.profile.speed_class ?? "medium"];
  const travel = Math.max(0, elapsedSec - view.profile.spawn_time);
  const startX = view.mesh.userData.startX as number;
  const row = view.mesh.userData.row as number;
  view.mesh.position.set(startX + speed * travel - 30, 8 + Math.sin(travel) * 0.5, row * 20);
  view.mesh.visible = elapsedSec >= view.profile.spawn_time;
}
```

- [ ] **Step 6: Implement `client/src/sim/scene.ts`**

```ts
import * as THREE from "three";
import type { Scenario } from "../api/types";

export interface SimScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render(): void;
  dispose(): void;
}

export function createSimScene(container: HTMLElement, scenario: Scenario): SimScene {
  const scene = new THREE.Scene();
  const night = scenario.time_of_day === "night";
  scene.background = new THREE.Color(night ? 0x05070c : 0x9fb4c7);
  scene.fog = new THREE.Fog(night ? 0x05070c : 0x9fb4c7, 40, 160);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 30, 60);
  camera.lookAt(0, 0, 0);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: scenario.environment === "urban" ? 0x33403a : 0x3d5a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const light = new THREE.DirectionalLight(0xffffff, night ? 0.6 : 1.1);
  light.position.set(30, 60, 20);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, night ? 0.3 : 0.6));

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  return {
    scene,
    camera,
    renderer,
    render: () => renderer.render(scene, camera),
    dispose: () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
```

- [ ] **Step 7: Run typecheck and tests**

Run: `npm run typecheck && npm test` in `client/`
Expected: typecheck clean; tests pass.

- [ ] **Step 8: Commit**

```bash
git add client/src/sim
git commit -m "feat(client): add three.js scene, deterministic threats, and spawner"
```

---

### Task 6: Client — start panel, HUD, actions, and wiring

**Files:**
- Create: `client/src/ui/startPanel.ts`, `client/src/ui/hud.ts`, `client/src/ui/actions.ts`
- Modify: `client/src/main.ts` (replace the placeholder created here — write the full orchestrator now)

**Interfaces:**
- Consumes: `createApiClient` (Task 3), `SessionController` + `events` (Task 4), `createSimScene`/`createThreatView`/`updateThreatView`/`Spawner` (Task 5).
- Produces: a running app where Start → scenario loads → threats spawn → the trainee can DETECT a threat, pick a classification, pick a response (or signal a false alarm) → the session auto-completes at `duration_seconds`.

- [ ] **Step 1: Write `client/src/ui/startPanel.ts`**

```ts
import type { Environment, ScenarioGenerateRequest, ThreatCount, TimeOfDay } from "../api/types";

const ENVIRONMENTS: Environment[] = ["urban", "rural"];
const TIMES: TimeOfDay[] = ["day", "night"];
const THREAT_COUNTS: ThreatCount[] = [1, 2, 3, 5];

function options(values: (string | number)[]): string {
  return values.map((v) => `<option value="${v}">${v}</option>`).join("");
}

export function mountStartPanel(root: HTMLElement, onStart: (req: ScenarioGenerateRequest, traineeId: string) => void): void {
  root.innerHTML = `
    <div id="start-panel" class="panel">
      <form id="start-form" style="min-width:320px">
        <h2>Aeroguard</h2>
        <label>Trainee ID <input id="trainee_id" value="TRAIN-001" /></label>
        <label>Difficulty <input id="difficulty" type="number" min="1" max="10" value="3" /></label>
        <label>Environment <select id="environment">${options(ENVIRONMENTS)}</select></label>
        <label>Time of day <select id="time_of_day">${options(TIMES)}</select></label>
        <label>Threat count <select id="threat_count">${options(THREAT_COUNTS)}</select></label>
        <label>Seed (blank = random) <input id="seed" type="number" /></label>
        <button type="submit">Start scenario</button>
      </form>
    </div>`;

  const form = root.querySelector<HTMLFormElement>("#start-form")!;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = <T extends string>(id: string): T =>
      (root.querySelector<HTMLInputElement>(`#${id}`)!).value as T;
    const seedRaw = value("seed");
    onStart(
      {
        difficulty: Number(value("difficulty")),
        environment: value("environment") as Environment,
        time_of_day: value("time_of_day") as TimeOfDay,
        threat_count: Number(value("threat_count")) as ThreatCount,
        seed: seedRaw === "" ? null : Number(seedRaw),
      },
      value("trainee_id"),
    );
  });
}
```

- [ ] **Step 2: Write `client/src/ui/hud.ts`**

```ts
import type { Scenario } from "../api/types";

export interface Hud {
  root: HTMLElement;
  setRemaining(seconds: number): void;
  setSelected(id: string | null): void;
}

export function mountHud(root: HTMLElement, scenario: Scenario): Hud {
  const element = document.createElement("div");
  element.id = "hud";
  element.className = "panel";
  root.appendChild(element);
  let selected: string | null = null;

  function render(remaining: number): void {
    const threats = scenario.threats
      .map((t) => `<li>${t.id}${t.id === selected ? " \u2190 selected" : ""}</li>`)
      .join("");
    element.innerHTML = `
      <div><strong>${scenario.environment} / ${scenario.time_of_day}</strong></div>
      <div>difficulty ${scenario.difficulty} &middot; sensor ${scenario.sensor_quality.toFixed(2)}</div>
      <div>time left: ${Math.max(0, Math.ceil(remaining))}s</div>
      <ul style="padding-left:16px;margin:6px 0">${threats}</ul>`;
  }
  render(scenario.duration_seconds);

  return {
    root: element,
    setRemaining: (seconds) => render(seconds),
    setSelected: (id) => {
      selected = id;
      render(scenario.duration_seconds);
    },
  };
}
```

- [ ] **Step 3: Write `client/src/ui/actions.ts`**

```ts
import type { ClassificationLabel, ExpectedResponse } from "../api/types";

const LABELS: ClassificationLabel[] = ["friendly", "civilian", "unknown", "suspicious", "hostile"];
const RESPONSES: ExpectedResponse[] = ["monitor", "track", "report", "hold"];

export interface ActionHooks {
  onDetect(): void;
  onClassify(label: ClassificationLabel): void;
  onRespond(response: ExpectedResponse): void;
  onFalseAlarm(): void;
  onFinish(): void;
}

export interface Actions {
  root: HTMLElement;
  setEnabled(enabled: boolean): void;
}

export function mountActions(root: HTMLElement, hooks: ActionHooks): Actions {
  const element = document.createElement("div");
  element.id = "actions";
  element.className = "panel";
  element.innerHTML = `
    <button data-action="detect">DETECT</button>
    ${LABELS.map((l) => `<button data-classify="${l}">${l}</button>`).join("")}
    ${RESPONSES.map((r) => `<button data-respond="${r}">${r}</button>`).join("")}
    <button data-action="false-alarm">FALSE ALARM</button>
    <button data-action="finish">FINISH</button>`;
  root.appendChild(element);

  element.addEventListener("click", (event) => {
    const target = event.target as HTMLButtonElement;
    if (target.dataset.action === "detect") hooks.onDetect();
    if (target.dataset.action === "false-alarm") hooks.onFalseAlarm();
    if (target.dataset.action === "finish") hooks.onFinish();
    const classify = target.dataset.classify as ClassificationLabel | undefined;
    if (classify) hooks.onClassify(classify);
    const respond = target.dataset.respond as ExpectedResponse | undefined;
    if (respond) hooks.onRespond(respond);
  });

  return {
    root: element,
    setEnabled: (enabled) => {
      element.querySelectorAll("button").forEach((b) => {
        (b as HTMLButtonElement).disabled = !enabled;
      });
    },
  };
}
```

- [ ] **Step 4: Write the orchestrator** — `client/src/main.ts`

```ts
import * as THREE from "three";
import { createApiClient } from "./api/client";
import type { ClassificationLabel, ExpectedResponse, Scenario } from "./api/types";
import { createSimScene } from "./sim/scene";
import { Spawner } from "./sim/spawner";
import { createThreatView, updateThreatView, type ThreatView } from "./sim/threats";
import { SessionController } from "./state/session";
import { mountActions } from "./ui/actions";
import { mountHud } from "./ui/hud";
import { mountStartPanel } from "./ui/startPanel";

const api = createApiClient();
const app = document.getElementById("app")!;

function clear(): void {
  app.innerHTML = "";
}

mountStartPanel(app, (request, traineeId) => {
  void runSession(request, traineeId);
});

async function runSession(
  request: Parameters<typeof api.generateScenario>[0],
  traineeId: string,
): Promise<void> {
  const scenario = await api.generateScenario(request);
  const session = await api.createSession({ trainee_id: traineeId, scenario_id: scenario.scenario_id });
  clear();
  startPlay(scenario, session.session_id, traineeId);
}

function startPlay(scenario: Scenario, sessionId: string, traineeId: string): void {
  const sceneContainer = document.createElement("div");
  sceneContainer.id = "scene";
  app.appendChild(sceneContainer);
  const sim = createSimScene(sceneContainer, scenario);

  const startedAt = performance.now();
  const now = () => Math.round(performance.now() - startedAt);

  // Serialize event submission so SESSION_COMPLETED lands before /complete.
  let chain: Promise<unknown> = Promise.resolve();
  const emit = (event: Parameters<typeof api.submitEvent>[1]) => {
    chain = chain.then(() => api.submitEvent(sessionId, event)).catch((error) => {
      console.error("event submission failed", error);
    });
  };
  const controller = new SessionController(scenario, sessionId, traineeId, { emit, now });

  const views = new Map<string, ThreatView>();
  for (const profile of scenario.threats) {
    const view = createThreatView(profile);
    sim.scene.add(view.mesh);
    views.set(profile.id, view);
  }

  let selected: string | null = scenario.threats[0]?.id ?? null;
  const hud = mountHud(app, scenario);

  const spawner = new Spawner(scenario, (id) => {
    controller.spawnThreat(id);
    selected = id;
    hud.setSelected(id);
  });
  controller.start();

  const actions = mountActions(app, {
    onDetect: () => { if (selected) controller.detect(selected); },
    onClassify: (label: ClassificationLabel) => { if (selected) controller.classify(selected, label); },
    onRespond: (response: ExpectedResponse) => { if (selected) controller.respond(selected, response); },
    onFalseAlarm: () => controller.falseAlarm(),
    onFinish: () => finish(),
  });

  // Click a threat in the scene to select it.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  sim.renderer.domElement.addEventListener("click", (event) => {
    const rect = sim.renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, sim.camera);
    const meshes = [...views.values()].map((v) => v.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit) {
      const view = [...views.values()].find((v) => v.mesh === hit.object);
      if (view) { selected = view.profile.id; hud.setSelected(selected); }
    }
  });

  let finishing = false;
  async function finish(): Promise<void> {
    if (finishing) return;
    finishing = true;
    actions.setEnabled(false);
    controller.complete();
    await chain;
    const result = await api.completeSession(sessionId);
    sim.dispose();
    const decisions = new Map(
      [...views.values()].map((v) => [v.profile.id, v.profile] as const),
    );
    const { showAar } = await import("./ui/aar");
    showAar(app, scenario, result, decisions, () => {
      clear();
      mountStartPanel(app, (nextRequest, nextTrainee) => { void runSession(nextRequest, nextTrainee); });
    });
  }

  function frame(): void {
    const elapsedSec = (performance.now() - startedAt) / 1000;
    spawner.update(elapsedSec);
    for (const view of views.values()) updateThreatView(view, elapsedSec);
    hud.setRemaining(scenario.duration_seconds - elapsedSec);
    sim.render();
    if (!finishing && elapsedSec >= scenario.duration_seconds) {
      void finish();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

- [ ] **Step 5: Create a temporary AAR stub so the app compiles** — `client/src/ui/aar.ts` (fully implemented in Task 7)

```ts
import type { CompleteResponse, Scenario, ThreatProfile } from "../api/types";

export function showAar(
  _root: HTMLElement,
  _scenario: Scenario,
  _result: CompleteResponse,
  _threats: Map<string, ThreatProfile>,
  _onAgain: () => void,
): void {
  throw new Error("AAR not implemented yet");
}
```

- [ ] **Step 6: Typecheck and run the dev build**

Run: `npm run typecheck` in `client/`
Expected: clean. (Manual visual check happens in Task 8.)

- [ ] **Step 7: Commit**

```bash
git add client/src/ui client/src/main.ts
git commit -m "feat(client): add start panel, hud, actions, and session orchestration"
```

---

### Task 7: Client — AAR scorecard screen and replay

**Files:**
- Modify: `client/src/ui/aar.ts` (replace the stub from Task 6)

**Interfaces:**
- Consumes: `CompleteResponse` (Task 1/Task 3), `Scenario`/`ThreatProfile` (Task 3).
- Produces: `showAar(root, scenario, result, threats, onAgain)` — renders final score, the four component scores, penalty, the scoring version, a per-threat result table, and a "Play again" button.

- [ ] **Step 1: Implement `client/src/ui/aar.ts`**

```ts
import type { CompleteResponse, Scenario, ThreatProfile } from "../api/types";

function rows(scenario: Scenario, result: CompleteResponse): string {
  return [
    ["Detection", result.detection_score, 30],
    ["Classification", result.classification_score, 30],
    ["Response", result.response_score, 25],
    ["Timing", result.timing_score, 15],
  ]
    .map(([label, value, max]) => `<tr><td>${label}</td><td>${value} / ${max}</td></tr>`)
    .join("");
}

function threatRows(threats: ThreatProfile[]): string {
  return threats
    .map(
      (t) =>
        `<tr><td>${t.id}</td><td>${t.classification_label}</td><td>${t.expected_response}</td></tr>`,
    )
    .join("");
}

export function showAar(
  root: HTMLElement,
  scenario: Scenario,
  result: CompleteResponse,
  threats: Map<string, ThreatProfile>,
  onAgain: () => void,
): void {
  const panel = document.createElement("div");
  panel.id = "aar-panel";
  panel.className = "panel";
  panel.innerHTML = `
    <div style="min-width:360px">
      <h2>After Action Review</h2>
      <table>
        ${rows(scenario, result)}
        <tr><td>Penalty</td><td>-${result.penalty}</td></tr>
        <tr><th>Final score</th><th>${result.final_score} / 100</th></tr>
      </table>
      <p>scoring_version ${result.scoring_version} &middot; scenario ${scenario.scenario_id} (seed ${scenario.seed})</p>
      <h3>Threats</h3>
      <table><tr><th>id</th><th>expected label</th><th>expected response</th></tr>${threatRows([...threats.values()])}</table>
      <p><button id="again">Play again</button></p>
    </div>`;
  root.appendChild(panel);
  panel.querySelector<HTMLButtonElement>("#again")!.addEventListener("click", () => {
    panel.remove();
    onAgain();
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` in `client/`
Expected: clean.

- [ ] **Step 3: Build**

Run: `npm run build` in `client/`
Expected: production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/ui/aar.ts
git commit -m "feat(client): add after action review scorecard and replay"
```

---

### Task 8: Run instructions and end-to-end manual verification

**Files:**
- Create: `client/README.md`
- Modify: `README.md` (root — add a "Running the Phase 3 demo" section)

**Interfaces:**
- Produces: a person unfamiliar with the code can start both servers and complete a session.

- [ ] **Step 1: Write `client/README.md`**

```markdown
# Aeroguard client (Phase 3 vertical slice)

## Prerequisites
- Node 20+ (developed on Node 22)
- The backend running (see the root README)

## Install
    npm install

## Run (dev)
1. Start the backend (from `backend/`):
       .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
2. Start the client (from `client/`):
       npm run dev
3. Open http://localhost:5173

The Vite dev server proxies `/api` to `http://localhost:8000`, and the
backend also sends CORS headers for `http://localhost:5173`.

## Test / typecheck / build
    npm test
    npm run typecheck
    npm run build
```

- [ ] **Step 2: Add the root README section** — append to `README.md`

```markdown
## Running the Phase 3 demo (browser client)

1. Backend: `cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000`
2. Client: `cd client && npm install && npm run dev`
3. Open http://localhost:5173, start a scenario, detect/classify/respond, finish, and review the AAR.

Client unit tests: `cd client && npm test`
Backend tests: `cd backend && .venv/Scripts/python -m pytest tests -q`
```

- [ ] **Step 3: Run the end-to-end manual check** (record the result in the task report)

Start both servers, then verify the 8-point slice DoD (`docs/guides/first_vertical_slice.md`):
1. app starts, 2. scenario starts, 3. respond to a threat, 4. finish, 5. see a score,
6. see an AAR breakdown, 7. start another scenario, 8. observe randomized differences (different seed ⇒ at least one scenario variable changes).
Note: the reviewer/controller runs this manually; capture the exact commands and observed results in the task report.

- [ ] **Step 4: Commit**

```bash
git add client/README.md README.md
git commit -m "docs: add phase 3 client run instructions and demo steps"
```

---

### Task 9: Checklist and push

**Files:**
- Modify: `docs/project-management/development_checklist.md`

**Interfaces:**
- Consumes: completed Tasks 1-8.
- Produces: updated checklist; phase pushed to `origin/main`.

- [ ] **Step 1: Tick delivered items** — change `[ ]` to `[x]` for:
  - Under **Unity**: `Main scene` (browser Three.js slice; note it supersedes the Unity main scene for now)
  - Under **Backend**: `AAR endpoint` → **leave unchecked** (Phase 4); check nothing else here.
  - Add a new line under a relevant section is NOT required — only tick what shipped.

> Note for the implementer: this phase ships the browser client, not the Unity items. Tick only `Main scene` and `Scenario loader` and `Detection UI`, `Classification UI`, `Response UI`, `Timer`, `Session completion` under **Unity** (the browser slice delivers these equivalents). Do NOT tick `Threat prefab`, `Threat movement` unless the browser equivalent exists (it does — so tick them too). Leave `Camera`/`Environment` ticked too (scene provides them).

- [ ] **Step 2: Run both suites one final time**

Run (from `backend/`): `.venv/Scripts/python -m pytest tests -q`
Run (from `client/`): `npm test`
Expected: both green.

- [ ] **Step 3: Confirm clean tree**

Run from repo root: `git status --short` (only the checklist change).

- [ ] **Step 4: Commit and push**

```bash
git add docs/project-management/development_checklist.md
git commit -m "docs(checklist): mark browser client phase complete"
git push origin main
```

---

## Phase DoD (verification before completion)

- `docs/guides/first_vertical_slice.md` 8-point definition of done passes (manual, recorded).
- Backend suite green; `POST /complete` returns the full breakdown; CORS preflight for the Vite origin succeeds.
- Client suite green (`npm test`); `npm run typecheck` clean; `npm run build` succeeds.
- Client never scores; all scores come from `POST /complete`.
- Contract (`docs/api/openapi.yaml`) updated in the same change as the schema.
- Checklist updated; `main` pushed; `git status` clean.

## Self-Review Notes (author)

- **Spec coverage:** slice Steps 1-10 map to Tasks 1-7 (Step 1 backend = Phase 1/2 + T1; Steps 2-4 scene/spawn = T5; Step 5-7 detect/classify/respond = T4+T6; Step 8 scoring = T1; Step 9 AAR = T7; Step 10 repeat = T6 replay + start panel seed).
- **Type consistency:** `SessionController`, `events.*`, `Spawner`, `createThreatView`/`updateThreatView`, `mountStartPanel`/`mountHud`/`mountActions`/`showAar` names are used identically across tasks.
- **Known risk:** the Three.js/DOM code is verified by `typecheck`/`build` + manual DoD, not unit tests (per the chosen test strategy); the pure logic (api client, state machine, spawner) is unit-tested.
