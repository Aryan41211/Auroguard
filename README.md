# Aeroguard

**AI-Enabled Drone & Counter-Drone Threat Simulation Trainer** — a software
training platform where personnel repeatedly practice *detecting*, *classifying*
and *choosing an abstract response* for simulated aerial threats under varied
environmental and sensor conditions, then review objective scores and follow a
personalised, explainable training loop.

Aeroguard is a **training and assessment prototype**, not an operational
counter-drone system. The simulator is only one part of the product; the full
system is:

```
Simulation  +  Interaction  +  Event Logging  +  Scoring  +  AAR  +  Adaptive Training
```

---

## Table of contents

- [What it does](#what-it-does)
- [Screens & users](#screens--users)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [API](#api)
- [Scoring model](#scoring-model)
- [Testing](#testing)
- [Documentation](#documentation)
- [Scope & safety](#scope--safety)
- [Status](#status)

---

## What it does

1. **Generate a scenario** — procedural, seeded generator produces a
   reproducible scenario with difficulty, environment (urban/rural),
   time of day (day/night), visibility tier, sensor quality and a threat count
   of 1/2/3/5. The same seed always yields the same scenario.
2. **Play it** — a browser client (Three.js) renders the scene and threat
   movement; the trainee clicks **Detect → Classify → Respond** per threat, can
   raise a **false alarm**, and finishes the session.
3. **Score it** — the backend replays the recorded event log and computes a
   deterministic 0–100 score plus timing and mistake analysis. The client never
   scores; the server is the single authority.
4. **Review it (AAR)** — an After-Action Review with summary, scores, timing
   metrics, mistakes, strengths, weaknesses and a recommendation. A
   deterministic template narrator is used offline; an optional
   OpenAI-compatible LLM narrator can be enabled.
5. **Adapt** — performance is aggregated per trainee across conditions
   (day/night, environment, visibility, sensor bins, multi-threat) and a
   rule-based recommender proposes the next scenario with a metric-cited reason.
6. **Instruct & analyse** — a React dashboard provides session history, score
   trends, a weakness heatmap, a trainee-performance view and an instructor
   scenario builder whose **Play** link opens a ready-to-start scenario.

Deterministic, offline-first and explainable by design: no cloud, no
nondeterministic scoring, and the training logic is independent of the graphics
(a sphere and a hi-fi model score identically).

## Screens & users

- **Trainee** — runs scenarios and reviews their AAR.
- **Instructor** — builds/seeds scenarios, inspects trainee performance, spots
  recurring weaknesses, and reviews session history.
- **Unit/admin** — aggregate performance without unnecessary personal data.

| Surface | Port | Purpose |
|---|---|---|
| Browser simulator client | 5173 | Play a scenario, detect/classify/respond, view the AAR |
| Instructor dashboard | 5174 | History, trends, weakness heatmap, performance, scenario builder |
| FastAPI backend | 8000 | Scenario, scoring, storage, AAR, adaptive logic (`/docs` for Swagger) |

## Architecture

```text
        POST /api/v1/... (HTTP + JSON)
┌───────────────────┐        ┌───────────────────────┐        ┌─────────────────┐
│  Browser client   │───────▶│    FastAPI backend    │───────▶│     SQLite      │
│  (Vite + Three.js)│◀───────│  (authority: scoring, │◀───────│ scenarios       │
│  play + AAR       │        │   AAR, adaptive)      │        │ sessions/events │
└───────────────────┘        └───────▲───────────────┘        │ scores          │
┌───────────────────┐                │                        │ perf profiles   │
│  React dashboard  │────────────────┘                        └─────────────────┘
│  instructor views │   read-only over /api/v1 JSON
└───────────────────┘
```

**Authority split:** the backend owns scenario generation, event validation,
scoring, AAR and adaptive logic. The clients send events and render results —
they never compute scores.

## Tech stack

- **Backend** — Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, SQLite, pytest.
- **Simulator client** — TypeScript, Vite 5, Three.js, Vitest.
- **Dashboard** — React 18, TypeScript, Vite 5, Recharts, Vitest + Testing Library.
- **Runtime** — Node 20+ (developed on Node 22); everything runs on localhost,
  no internet required for the core loop.

## Repository layout

```text
Aeroguard/
├── backend/                 FastAPI app, services, db, tests, scripts/
│   ├── app/
│   │   ├── api/             scenarios, sessions, aar, training routers
│   │   ├── schemas/         pydantic request/response models
│   │   ├── services/        scenario_generator, scoring, aar, adaptive, demo_seed
│   │   └── db/              SQLAlchemy models + session
│   ├── scripts/seed_demo.py deterministic demo-data CLI
│   └── tests/               pytest suite (unit + contract + integration)
├── client/                  Vite + TS + Three.js simulator (port 5173)
├── dashboard/               React + Recharts instructor app (port 5174)
├── docs/                    engineering truth: background, modules, api, plans, guides
└── report.md                phase verification reports
```

## Getting started

Prerequisites: **Python 3.11/3.12**, **Node 20+**, Git. (Unity is not required —
the Phase 3 browser client replaced it for the vertical slice.)

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows;  source .venv/bin/activate on Unix
pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

- API docs: <http://127.0.0.1:8000/docs>
- Config is env-overridable and all-optional; see `backend/.env.example`
  (`AEROGUARD_DATABASE_URL`, plus optional LLM narrator settings).

### 2. Demo data (optional but recommended for the dashboard)

```bash
cd backend
.venv/Scripts/python scripts/seed_demo.py --sessions 50
```

Seeds ~50 deterministic synthetic sessions across six differentiated trainee
profiles so trends and the weakness heatmap are meaningful.

### 3. Simulator client

```bash
cd client
npm install
npm run dev            # http://localhost:5173  (proxies /api -> :8000)
```

### 4. Instructor dashboard

```bash
cd dashboard
npm install
npm run dev            # http://localhost:5174  (proxies /api -> :8000)
```

The dashboard's instructor builder emits a **Play in simulator** link that opens
the client at 5173 prefilled with the exact scenario conditions and seed.

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
| `GET`  | `/trainees/{id}/performance` | Historical per-condition aggregates |
| `POST` | `/training/recommend` | Rule-based next-scenario recommendation + reason |

## Scoring model

A deterministic 100-point score computed server-side from the recorded events:

| Component | Max | Notes |
|---|---|---|
| Detection | 30 | correct = full, missed = 0, false alarm = penalty |
| Classification | 30 | correct = full, incorrect = 0 |
| Response decision | 25 | abstract categories: monitor / track / report / hold |
| Timing | 15 | response-time curve (target + tolerance) |
| Penalties | — | e.g. false alarms |

The score is a training signal, not a scientifically validated operational
metric. See `docs/modules/scoring_engine.md`.

## Testing

```bash
# Backend (161 tests)
cd backend && .venv/Scripts/python -m pytest tests -q

# Simulator client (typecheck + 30 unit tests + build)
cd client && npm run typecheck && npm test && npm run build

# Dashboard (typecheck + 40 unit tests + build)
cd dashboard && npm run typecheck && npm test && npm run build
```

Golden tests enforce scenario determinism; contract tests keep the OpenAPI
spec, the routers and the docs in sync.

## Documentation

Start at `docs/guides/start_here.md`, then:

- **Background** — `docs/background/problem_and_scope.md`, `safety_scope.md`
- **Modules** — `docs/modules/` (architecture, scenario engine, scoring, event
  model, AAR & adaptive training, FastAPI backend, UI/UX)
- **API** — `docs/api/api_specification.md`, `docs/api/openapi.yaml`
- **Guides** — `docs/guides/` (local setup, testing & validation, project structure)
- **Plans** — `docs/plans/00-master-roadmap.md` and per-phase plans
- **Project management** — `docs/project-management/` (requirements, decisions,
  checklist, git workflow, demo validation, troubleshooting)

## Scope & safety

Aeroguard is explicitly **not** a physical anti-drone system, a
command-and-control platform, a weapon-targeting system, an interception system
or a replacement for live operational training. Responses are **abstract
categories only** — no targeting, engagement or real-drone logic. See
`docs/background/safety_scope.md`.

## Status

Phases 0–6 are complete: environment, scenario engine, scoring & sessions,
browser client, AAR & adaptive training, content expansion, and the
dashboard + instructor mode. **Phase 7** (deterministic replay with a timeline
scrubber, sound/UI polish, a full demo-validation run, optional Docker) is next;
**Phase 8** (optional Unity spike) is gated behind Phase 7. Progress is tracked
in `docs/project-management/development_checklist.md` and
`docs/plans/00-master-roadmap.md`.

---

_No license file is present yet; treat the code as all-rights-reserved until one is added._
