<div align="center">

# Aeroguard

### AI-Enabled Drone & Counter-Drone Threat Simulation Trainer

*Simulate the airspace. Sharpen the judgement. Measure the response.*

A deterministic, offline-first training platform where personnel practise
**detecting, classifying and responding** to simulated aerial threats — then
review objective scores and follow an explainable, personalised training loop.

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.143-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)

![Tests](https://img.shields.io/badge/tests-181%20backend%20%C2%B7%2076%20client%20%C2%B7%2044%20dashboard%20%C2%B7%2018%20Unity-brightgreen)
![Offline first](https://img.shields.io/badge/offline--first-localhost-blueviolet)
![Status](https://img.shields.io/badge/status-Phase%208%20complete-success)

</div>

---

> **In one line:** a virtual training environment, an objective assessment
> engine, and a personalised training loop — the simulator is only one part of
> the system.
>
> ```
> Simulation  +  Interaction  +  Event Logging  +  Scoring  +  AAR  +  Adaptive Training
> ```

## Why it's interesting

- **Deterministic by construction** — the same seed always produces the same
  scenario, and the same event log always produces the same score. Exercises are
  reproducible, debuggable and auditable.
- **Server-authoritative scoring** — clients only report *what happened*; the
  backend derives *how well*. No client can inflate a score.
- **Graphics-independent training logic** — a threat drawn as a sphere and one
  drawn as a hi-fi model are scored identically, so the simulation can evolve
  without touching the assessment.
- **Explainable adaptation** — every recommendation cites the metrics behind it
  ("night score trails overall by 21 points…"), never a black box.
- **Fully offline** — the entire loop runs on `localhost` with SQLite; no cloud,
  no telemetry, no internet dependency for the core experience.

## Table of contents

- [What it does](#what-it-does)
- [A session, end to end](#a-session-end-to-end)
- [Screens & users](#screens--users)
- [Architecture](#architecture)
- [Design principles](#design-principles)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [API](#api)
- [Scoring model](#scoring-model)
- [Testing](#testing)
- [Documentation](#documentation)
- [Scope & safety](#scope--safety)
- [Status](#status)

## What it does

| Step | What happens |
|---|---|
| **Generate** | The seeded generator produces a scenario: difficulty, environment (urban/rural), time of day, visibility tier, sensor quality and a threat count of 1/2/3/5. |
| **Play** | A Three.js browser client renders the scene; the trainee clicks **Detect → Classify → Respond** per threat, can raise a **false alarm**, and finishes. |
| **Score** | The backend replays the event log and computes a deterministic 0–100 score with timing and mistake analysis. |
| **Review** | An After-Action Review surfaces summary, scores, timing, mistakes, strengths, weaknesses and a recommendation. |
| **Replay** | Any session can be watched again with a server-derived timeline scrubber, from the AAR or a `#replay=SES-...` deep link. |
| **Adapt** | Performance is aggregated per condition and a rule-based recommender proposes the next scenario with its reasoning. |
| **Instruct** | A React dashboard offers history, trends, a weakness heatmap, per-trainee performance and an instructor scenario builder. |

## A session, end to end

```text
  seed ──▶ generate ──▶ play ──▶ events ──▶ score ──▶ AAR ──▶ recommend ──▶ next scenario
   │                    │          │                                            ▲
   └──── identical ─────┘          └────────── identical ───────────────────────┘
        scenario                        score
```

The instructor can hand a trainee a **Play link** that opens a scenario
identically to how it was generated — same conditions, same seed — so a planned
exercise and its replay are always the same exercise.

## Screens & users

- **Trainee** — runs scenarios and reviews their After-Action Review.
- **Instructor** — builds and seeds scenarios, inspects trainee performance,
  spots recurring weaknesses, and reviews session history.
- **Unit / admin** — reads aggregate performance without unnecessary personal data.

| Surface | Port | Purpose |
|---|---|---|
| Browser simulator client | `5173` | Play a scenario, detect/classify/respond, view the AAR and replay |
| Instructor dashboard | `5174` | History, trends, weakness heatmap, performance, scenario builder, replay links |
| FastAPI backend | `8000` | Scenario, scoring, storage, AAR, replay and adaptive logic (`/docs` for Swagger) |

## Architecture

```text
        POST /api/v1/... (HTTP + JSON)
┌───────────────────┐        ┌───────────────────────┐        ┌─────────────────┐
│  Browser client   │───────▶│    FastAPI backend    │───────▶│     SQLite      │
│  (Vite + Three.js)│◀───────│  authority: scenario, │◀───────│ scenarios       │
│  play · AAR ·     │        │  scoring, AAR, replay,│        │ sessions/events │
│  replay           │        │  adaptive training    │        │ scores          │
└───────────────────┘        └───────▲───────────────┘        │ perf profiles   │
┌───────────────────┐                │                        │ perf profiles   │
│  React dashboard  │────────────────┘                        └─────────────────┘
│  instructor views │   read-only over /api/v1 JSON
└───────────────────┘
```

**Authority split:** the backend owns scenario generation, event validation,
scoring, AAR and adaptive logic. The clients send events and render results —
they never compute scores.

## Design principles

| Principle | What it means here |
|---|---|
| **Deterministic** | Same seed + generator version ⇒ identical scenario; same events ⇒ identical score. Golden tests enforce it. |
| **Server-authoritative** | The client never scores. The backend derives every number from the recorded event log. |
| **Offline-first** | Everything runs on localhost over SQLite. No cloud, no external calls. |
| **Explainable** | AARs and recommendations cite the exact metrics that produced them. |
| **Graphics-independent** | Training logic never depends on visual appearance or 3D assets. |

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Python 3.12 · FastAPI · Pydantic v2 · SQLAlchemy 2 · SQLite · pytest |
| Simulator client | TypeScript · Vite 5 · Three.js · Vitest |
| Dashboard | React 18 · TypeScript · Vite 5 · Recharts · Vitest + Testing Library |
| Unity spike (optional) | Unity 6000.6.5f1 · built-in modules · UnityWebRequest · IMGUI |
| Runtime | Node 20+ (developed on Node 22); localhost only |

## Repository layout

```text
Aeroguard/
├── backend/                 FastAPI app, services, db, tests, scripts/
│   ├── app/
│   │   ├── api/             scenarios · sessions · aar · replay · training routers
│   │   ├── schemas/         pydantic request/response models
│   │   ├── services/        scenario_generator · scoring · aar · replay · adaptive · demo_seed
│   │   └── db/              SQLAlchemy models + session
│   ├── scripts/             seed_demo.py · validate_demo.py
│   └── tests/               pytest suite (unit · contract · integration)
├── client/                  Vite + TS + Three.js simulator (port 5173)
│   └── src/replay/          timeline · player · scrubber · 3D replay view
├── dashboard/               React + Recharts instructor app (port 5174)
├── unity/Aeroguard-Unity/   Optional Unity 6 client spike (Phase 8)
├── docker-compose.yml       backend + simulator + dashboard (optional)
├── docs/                    engineering truth: background · modules · api · plans · guides
└── report.md                phase verification reports
```

## Getting started

**Prerequisites:** Python 3.11/3.12, Node 20+, Git. Unity **6000.6.5f1** is
optional and only needed for the Phase 8 spike - the browser client covers the
vertical slice.

### 1 · Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate on Unix
pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

- Interactive API docs: <http://127.0.0.1:8000/docs>
- All configuration is optional and env-overridable — see `backend/.env.example`
  (`AEROGUARD_DATABASE_URL`, plus optional LLM narrator settings).

### 2 · Demo data *(recommended for the dashboard)*

```bash
cd backend
.venv/Scripts/python scripts/seed_demo.py --sessions 50
```

Seeds ~50 deterministic sessions across six differentiated trainee profiles so
trends, comparisons and the weakness heatmap are meaningful.

### 3 · Simulator client

```bash
cd client
npm install
npm run dev                        # http://localhost:5173  (proxies /api → :8000)
```

### 4 · Instructor dashboard

```bash
cd dashboard
npm install
npm run dev                        # http://localhost:5174  (proxies /api → :8000)
```

### 5 · Everything with Docker *(optional)*

```bash
docker compose up --build
```

Starts the API on `:8000`, simulator on `:5173`, dashboard on `:5174`, with
healthchecks and a persistent SQLite volume. See `docs/guides/docker.md`.

### 6 · Guided demo

Open <http://localhost:5173/?demo=1> for a scripted auto-pilot that plays the
scenario and deliberately leaves one teachable mistake for the AAR. Press `r` in
the client to open the replay, or use the dashboard's "Watch" link.

### 7 - Optional: Unity spike

The Unity 6 client in `unity/Aeroguard-Unity` plays the same server-authoritative
loop with a procedurally built scene and an IMGUI HUD. With the backend running,
open the project in Unity `6000.6.5f1` and press Play, or run the built player:

```powershell
cd unity/Aeroguard-Unity
.\Builds\Aeroguard.exe -aeroguardApi=http://127.0.0.1:8000
```

See `unity/Aeroguard-Unity/README.md` for controls, flags, test commands and
headless build automation. The browser client remains the supported surface.

## API

Base path `/api/v1`, JSON. The contract lives in `docs/api/openapi.yaml` and is
guarded by `backend/tests/test_contract*.py`; `docs/api/api_specification.md` is
the human-readable companion.

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | Liveness probe |
| `POST` | `/scenarios/generate` | Generate a validated, seeded scenario |
| `POST` | `/sessions` | Create a session for a trainee + scenario |
| `GET`  | `/sessions` | List session history (optional `?trainee_id=`) |
| `POST` | `/sessions/{id}/events` | Submit a trainee event |
| `POST` | `/sessions/{id}/complete` | Complete and score the session |
| `GET`  | `/sessions/{id}/aar` | After-Action Review for a completed session |
| `GET`  | `/sessions/{id}/replay` | Deterministic event log + server-derived replay frames |
| `GET`  | `/trainees/{id}/performance` | Historical per-condition aggregates |
| `POST` | `/training/recommend` | Rule-based next-scenario recommendation + reason |

## Scoring model

A deterministic 100-point score, computed server-side from the recorded events:

| Component | Max | Notes |
|---|---|---|
| Detection | 30 | correct = full, missed = 0, false alarm = penalty |
| Classification | 30 | correct = full, incorrect = 0 |
| Response decision | 25 | abstract categories: monitor / track / report / hold |
| Timing | 15 | response-time curve (target + tolerance) |
| Penalties | — | e.g. false alarms |

It is a *training signal*, not a scientifically validated operational metric.
See `docs/modules/scoring_engine.md`.

## Testing

```bash
# Backend — 181 tests
cd backend && .venv/Scripts/python -m pytest tests -q

# Simulator client — typecheck + 76 unit tests + build
cd client && npm run typecheck && npm test && npm run build

# Dashboard — typecheck + 44 unit tests + build
cd dashboard && npm run typecheck && npm test && npm run build
```

Golden tests enforce scenario determinism; contract tests keep the OpenAPI spec,
the routers and the docs in sync. `backend/scripts/validate_demo.py` runs the
full demo sequence against a live API and asserts the five validation questions
(see `docs/project-management/demo_evidence.md`).

The optional Unity spike adds **17 EditMode tests** (offline) plus one guarded
PlayMode integration test. Set `AEROGUARD_RUN_LIVE_TESTS=1` with the backend
running to execute the live test; commands are in
`unity/Aeroguard-Unity/README.md`.

## Documentation

Start at `docs/guides/start_here.md`, then explore:

| Area | Where |
|---|---|
| Background | `docs/background/problem_and_scope.md`, `safety_scope.md` |
| Modules | `docs/modules/` — architecture, scenario engine, scoring, event model, replay, AAR & adaptive training, FastAPI backend, UI/UX |
| API | `docs/api/api_specification.md`, `docs/api/openapi.yaml` |
| Guides | `docs/guides/` — local setup, testing & validation, project structure, Docker deployment |
| Plans | `docs/plans/00-master-roadmap.md` and per-phase plans |
| Project management | `docs/project-management/` — requirements, decisions, checklist, git workflow, demo validation, troubleshooting |

## Scope & safety

Aeroguard is explicitly **not** a physical anti-drone system, a
command-and-control platform, a weapon-targeting system, an interception system,
or a replacement for live operational training. Responses are **abstract
categories only** — no targeting, engagement or real-drone logic. See
`docs/background/safety_scope.md`.

## Status

**Phases 0-7 complete (plus the optional Phase 8 Unity spike):** environment · scenario engine · scoring & sessions ·
browser client · AAR & adaptive training · content expansion · dashboard &
instructor mode · **deterministic replay, demo polish and Docker deployment**.

**Phase 7 delivered:** server-authoritative replay with a timeline scrubber and
AAR/dashboard deep links, synthesized sound cues, improved lighting, keyboard
shortcuts, recoverable error panels, a guided `?demo=1` auto-pilot, Docker
Compose, and a full demo-validation run with captured evidence
(`docs/project-management/demo_evidence.md`).

**Phase 8 delivered (optional Unity spike):** a Unity `6000.6.5f1` client in
`unity/Aeroguard-Unity` with a runtime-built scene, the frozen v1 API contract,
the full detect/classify/respond loop, AAR and visual conditions. Verified with
17 EditMode tests, a live PlayMode integration test (final score 100, no
mistakes) and a headless Windows player build. See
`docs/plans/phase-8-unity-spike.md`. The browser client remains the supported
training surface.

---

<div align="center">
<sub>No license file is present yet — treat the code as all-rights-reserved until one is added.</sub>
</div>
