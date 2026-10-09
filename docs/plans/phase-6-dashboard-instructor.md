# Phase 6 — Dashboard + instructor mode

> Roadmap: `docs/plans/00-master-roadmap.md` § Phase 6.
> **Tasks:** React+Vite+TS + Recharts: history table, score trends, weakness heatmap ·
> instructor scenario builder · trainee performance view · `scripts/seed_demo.py` (~50 synthetic sessions).
> **DoD:** dashboard renders trends from seeded data; instructor-launched scenario is playable.

## Constraints carried forward

- Git: direct commits to `main`, Conventional Commits, small focused commits, push at phase end.
- Authority split: the dashboard never scores; all data comes from `/api/v1` JSON.
- Offline-first: localhost only. Contract: `docs/api/openapi.yaml` stays the source of truth;
  every new route is added there and guarded by `tests/test_contract*.py`.
- Existing references pin `docs/api/api_specification.md §9` (API rules), so the new endpoint
  section is appended as §10 — no renumbering.
- Ports: simulator client dev server owns 5173; dashboard takes **5174**; backend 8000.
- Existing tests must stay green (146 backend, 19 client at phase-5 close).

## Task 1 — Session history endpoint (backend)

The dashboard needs list-shaped data (history table + trends) that no endpoint provides yet.

- `app/schemas/history.py`: `SessionHistoryEntry` (session_id, trainee_id, scenario_id, status,
  started_at, completed_at, seed, difficulty, environment, time_of_day, visibility,
  sensor_quality, threat_count, final_score + detection/classification/response/timing/penalty,
  all nullable for active sessions) and `SessionHistoryResponse { sessions: [...] }`.
- `app/api/sessions.py`: `GET /sessions` (same path as existing POST; optional `trainee_id`
  query filter). Joins `ScenarioRow` (conditions, seed, threat count) and `ScoreRow`
  (component scores) — no scoring, read-only projection. Order: `started_at DESC,
  session_id DESC` (newest first, deterministic tie-break).
- Tests (`tests/test_session_history.py`): completed entry carries conditions + component
  scores; active entry has null scores; `trainee_id` filter; ordering newest-first;
  empty list when no sessions.
- `docs/api/openapi.yaml`: `get` under `/api/v1/sessions` + `SessionHistoryEntry` /
  `SessionHistoryResponse` schemas; `tests/test_contract.py` EXPECTED_SCHEMAS extended.
- `docs/api/api_specification.md`: new `## 10. List session history` (§9 untouched).

## Task 2 — CORS for the dashboard dev origin

`app/main.py` allow_origins gains `http://localhost:5174` and `http://127.0.0.1:5174`
(the dashboard normally reaches the API through its Vite proxy, but direct fetches must work too).

## Task 3 — Demo data seeder

- `app/services/demo_seed.py` — `seed_demo_data(db, *, sessions=50, base_seed=...) -> SeedSummary`.
  Deterministic (`random.Random(base_seed)`); 6 trainees with differentiated skill profiles
  (baseline accuracy, latency, false-alarm rate, night/multi-threat penalties) so trends and
  the heatmap are meaningful.
  Per session: pick conditions from the RNG, re-roll difficulty until
  `generate_scenario` accepts it (feasibility), persist `ScenarioRow`, then drive the **route
  functions** (`create_session`, `submit_event`, `complete_session`) with the same db session so
  seeding exercises real business logic and scoring. Events: SESSION_STARTED, SCENARIO_LOADED,
  per-threat THREAT_DETECTED → CLASSIFICATION_SUBMITTED → RESPONSE_SUBMITTED (correct or
  wrong per skill profile), occasional FALSE_ALARM, SESSION_COMPLETED. Unique seeds per
  session ⇒ unique `scenario_id`s.
- `scripts/seed_demo.py` — argparse CLI (`--sessions`, `--base-seed`, `--database-url`),

## Task 4 — Dashboard app (new `dashboard/` subproject)

Vite + React + TS + Recharts (roadmap tech stack). Dev port 5174 with `/api → localhost:8000`
proxy; `vitest` + `@testing-library/react` (jsdom) mirroring the client's test setup.

- Scaffold: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`,
  `src/main.tsx`, `src/styles.css`.
- `src/api/`: `types.ts` + `client.ts` — `listSessions(traineeId?)`,
  `getPerformance(traineeId)`, `recommend(traineeId)`, `generateScenario(request)`;
  same error-shape handling as the simulator client.
- Views (tabbed shell `src/App.tsx`):
  1. **History** — session history table with trainee filter (Task 1 data).
  2. **Trends** — Recharts `LineChart` of final score over sessions per trainee;
     pure `buildTrendSeries(history, traineeId)` extracted and unit-tested.
  3. **Weakness heatmap** — grid of condition scores (night/day, urban/rural, visibility
     tiers, sensor bins, multi-threat) from `PerformanceProfile`; pure `weaknessCells()` +
     `heatColor()` unit-tested; null cells render as "n/a".
  4. **Trainee performance** — accuracies, reaction time, current level + one-click
     `POST /training/recommend` showing the metric-cited reason.
  5. **Instructor scenario builder** — form → `POST /scenarios/generate` → scenario
     preview + **Play** link to the simulator
     (`http://localhost:5173/?…seed/difficulty/environment/time_of_day/threat_count/trainee_id`).
- Each view + its pure helpers lands as its own commit with tests.

## Task 5 — Playable instructor link (simulator client)

- `client/src/ui/scenarioParams.ts`: pure `parseScenarioParams(search)` — validates
  difficulty 1–10, threat_count ∈ {1,2,3,5}, enum fields; unknown/invalid values ignored
  (fall back to defaults). Unit tests.
- `client/src/ui/startPanel.ts`: prefill the form from `parseScenarioParams(location.search)`
  so the dashboard's Play link opens a ready-to-start scenario.

## Definition of done

1. `backend pytest` green; `client` vitest/typecheck/build green; `dashboard` vitest/typecheck/build green.
2. `python scripts/seed_demo.py --sessions 50` then `GET /api/v1/sessions` lists them and
   `GET /trainees/{id}/performance` aggregates them (live curl evidence).
3. Dashboard trends render from that seeded payload (component test + live fetch).
4. Instructor builder emits a Play link that prefills the simulator (parser tests).
5. Contract guards green; `git status` clean; checklist + ledger updated; push `main`.

## Commit plan (small, one logical change each)

1. `docs(plans): add phase 6 dashboard and instructor mode plan`
2. `feat(api): add session history listing endpoint`
3. `docs(api): specify session history endpoint`
4. `test(api): cover session history listing`
5. `fix(api): allow dashboard dev origin in CORS`
6. `feat(seed): add deterministic demo session seeder`
7. `feat(scripts): add seed_demo CLI`
8. `test(seed): verify seeded sessions feed history and performance`
9. `feat(dashboard): scaffold vite react app`
10. `feat(dashboard): add api client for history and training`
11. `test(dashboard): cover api client requests`
12. `feat(dashboard): add tabbed dashboard shell`
13. `feat(dashboard): add session history table` (+ tests)
14. `feat(dashboard): add score trend chart` (+ series tests)
15. `feat(dashboard): add weakness heatmap` (+ cell/color tests)
16. `feat(dashboard): add trainee performance view`
17. `feat(dashboard): add instructor scenario builder`
18. `feat(client): prefill start panel from scenario query params` (+ tests)
19. `docs(checklist): mark dashboard phase complete`

  creates schema if missing, prints a summary. Runnable as
  `python scripts/seed_demo.py` from `backend/`.
- Tests (`tests/test_seed_demo.py`): seeded tmp DB yields the requested count of completed
  sessions across multiple trainees, scores vary (non-constant trend), the history endpoint
  serves them, and `GET /trainees/{id}/performance` aggregates them.
