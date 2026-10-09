# Aeroguard — Master Execution Plan (via OpenCode)

> **For agentic workers:** Roadmap-of-plans. Each phase has its own code-level plan in `docs/plans/phase-N-*.md`, executed via superpowers:subagent-driven-development (fresh subagent per task, review per task, final whole-branch review).

**Goal:** Build the full Aeroguard prototype — scenario → simulate → detect/classify/respond → score → AAR → adaptive loop — with a browser client first, Unity later (user decision, 2026-10-09).

**Architecture:** FastAPI + SQLite backend is the authority (scenario, scoring, AAR, adaptive); a Three.js/Vite browser client is the presentation layer; React dashboard for instructor/analytics. All communicate over `/api/v1` JSON per `docs/api/api_specification.md`.

**Tech Stack:** Python 3.12 / FastAPI / Pydantic / SQLAlchemy / pytest · TypeScript / Vite / Three.js · React + Recharts (dashboard) · SQLite · (later: Unity, Docker)

**Specs:** `docs/guides/first_vertical_slice.md`, `docs/project-management/build_order.md`, `docs/modules/scenario_engine.md`, `docs/modules/scoring_engine.md`, `docs/modules/event_and_data_model.md`, `docs/api/api_specification.md`, `docs/modules/aar_and_adaptive_training.md`, `docs/modules/ai_implementation.md`, `docs/guides/testing_validation.md`, `docs/project-management/git_workflow.md`

## Global Constraints

- **Git:** direct commits to `main`, Conventional Commits, commit after every meaningful change, push at each phase end (`docs/project-management/git_workflow.md`)
- **Safety:** abstract responses only; no targeting/interception/real-drone logic (`docs/background/safety_scope.md`)
- **Determinism:** same seed + generator_version ⇒ identical scenario (NFR-01); golden tests enforce it
- **Authority split:** client never scores; server scores from events (`docs/modules/scoring_engine.md §11`)
- **Offline-first:** everything runs on localhost, no cloud
- **Quality gates before any phase-complete claim:** `pytest` green + `git status` clean + `git log` reviewed (verification-before-completion)

## How each phase runs in OpenCode

1. Plan mode → `writing-plans` saves `docs/plans/phase-N-<name>.md` (code-level tasks, TDD steps)
2. Execute → subagent-driven-development (fresh subagent per task)
3. auto-pilot auto-loads skills: `fastapi-service` + `ml-pytest` for backend tasks, `frequent-commits` for every commit, `docker-compose-ml` at Phase 7
4. After each task: pytest green → commit → after each feature block: push `main`
5. Phase close: verification-before-completion checklist → update `docs/project-management/development_checklist.md` → push

## File Structure (target end-state)

```text
backend/
  app/main.py, config.py
  app/api/{scenarios,sessions,aar,training}.py
  app/schemas/{scenario,session,events,aar}.py
  app/services/{scenario_generator,scoring,aar,adaptive}.py
  app/db/{database,models}.py
  tests/{test_scenarios,test_scoring,test_aar,test_adaptive,test_api,test_contract}.py
client/                 (Vite + TS + Three.js)
  src/{main.ts, api/client.ts, sim/{scene,threats,spawner,weather}.ts,
       ui/{detect,classification,response,aar}.ts, state/session.ts}
dashboard/              (Vite + React + Recharts)
scripts/seed_demo.py
docs/plans/             (one plan doc per phase)
docs/api/openapi.yaml   (frozen v1 contract)
```

---

## Phase 0 — Environment & contract (½ day)

**Tasks:** venv + pinned `requirements.txt` · FastAPI `app.main:app` with tested `GET /health` · pytest wired · extend `.gitignore` · freeze `docs/api/openapi.yaml` with contract test.
**DoD:** uvicorn serves `/health` → `{"status":"ok"}`; `pytest` green; contract test guards 7 endpoints + 15 schema names.

## Phase 1 — Scenario engine (1–2 days)

**Tasks:** enums · Pydantic `Scenario`/`ThreatProfile` mirroring contract · seeded generator (`random.Random(seed)`) · validator (`docs/modules/scenario_engine.md §8`) · anti-repetition cooldown · `POST /scenarios/generate` route → service · tests: determinism (seed 12345 twice ⇒ identical), validation rejections, label legality, spawn-times-in-range.
**DoD:** `pytest tests/test_scenarios.py -v` green; same seed reproducible via curl.

## Phase 2 — Scoring + events + SQLite (2–3 days)

**Tasks:** `Event` schema + type enum · scoring service as pure function `score(scenario, events) -> ScoreResult` (30/30/25/15 weights, penalties, clamp, `scoring_version=1`) · **golden-file tests** covering all decision-tree branches · SQLAlchemy models (scenarios, sessions, events, scores, performance_profiles) · `POST /sessions`, `.../events`, `.../complete` (server computes score) · API→DB→scoring integration test.
**DoD:** every scoring branch tested; session completion via HTTP persists score; `docs/guides/testing_validation.md §3` covered.

## Phase 3 — Browser client vertical slice (3–4 days) ⭐ first demo

**Tasks:** Vite+TS scaffold, `api/client.ts` generated from contract · Three.js scene (ground, fog, directional light) · threat on deterministic path spawned at `spawn_time` · state machine `idle → detect → classify → respond → resolve → complete` · UI panels (HUD, DETECT, classification labels, response choices) · event submission with `timestamp_ms` · AAR screen · scenario reload with new seed.
**DoD:** `docs/guides/first_vertical_slice.md` definition-of-done, recorded as screen capture.

## Phase 4 — AAR + adaptive engine (2 days)

**Tasks:** AAR service (summary, scores, timing, mistakes, chronological timeline, condition-sliced weaknesses) → `GET .../aar` · performance aggregation → `GET .../performance` · rule-based recommender (≥90×3 ⇒ +1, <60×2 ⇒ −1, night < overall−15 ⇒ night bias) with metric-built reason → `POST /training/recommend` · tests from `docs/guides/testing_validation.md §5`.
**DoD:** all five `docs/project-management/demo_validation.md` questions answer YES via tests/script.

## Phase 5 — Content expansion (2–3 days)

**Tasks:** generator dims (urban/rural, day/night, visibility tiers, sensor_quality, threat counts, explainable difficulty factors) · cooldown anti-repetition · client night lighting, fog/noise degradation (visuals never affect scoring) · multi-threat HUD (2–3) · per-condition metrics.
**DoD:** 10 consecutive scenarios show no repeated config; scoring unchanged by visual-only changes.

## Phase 6 — Dashboard + instructor mode (2–3 days)

**Tasks:** React+Vite+TS + Recharts: history table, score trends, weakness heatmap · instructor scenario builder · trainee performance view · `scripts/seed_demo.py` (~50 synthetic sessions).
**DoD:** dashboard renders trends from seeded data; instructor-launched scenario is playable.

## Phase 7 — Replay, demo polish, deployment (2 days)

**Tasks:** deterministic replay (seed + events → timeline scrubber) · sound/UI polish · full `docs/project-management/demo_validation.md` run with evidence collection · optional docker-compose · troubleshooting pass.
**DoD:** demo script passes twice; replay reproduces sessions identically.

## Phase 8 (optional) — Unity client spike

Pin Unity LTS, minimal scene, `/health` then scenario flow (`docs/guides/local_setup.md §6-8`). Gate: only after Phase 7 DoD.

---

## Timeline (solo, part-time)

| Week | Phase | Milestone |
|------|-------|-----------|
| 1 | 0 + 1 | Health + deterministic scenario API |
| 2 | 2 | Scoring engine, golden tests, persistence |
| 3 | 3 | **Playable vertical slice (demo #1)** |
| 4 | 4 | AAR + adaptive recommendations |
| 5 | 5 | Day/night, degradation, multi-threat |
| 6 | 6 | Dashboard + instructor mode |
| 7 | 7 | Replay + demo polish (demo #2, final) |
| 8 | buffer / 8 | Unity spike or contingency |

**Critical path:** 0→1→2→3. Two people? Split at Phase 3: one owns backend (4–5), other owns client (3) + dashboard (6), meeting at the frozen API contract.

## Risks & mitigations

- **Scope creep in Phase 3** → DoD is the 8-point slice checklist, nothing visual beyond primitives
- **Scoring churn breaks golden tests** → `docs/guides/testing_validation.md §8`: scoring changes bump `scoring_version`; tests pin it
- **Contract drift client/server** → single source `docs/api/openapi.yaml`, regenerate types both sides each phase
- **Unity rabbit hole** → hard gate: Phase 8 only after Phase 7 DoD
