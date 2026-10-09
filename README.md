# Aeroguard — Engineering Blueprint Pack

This folder contains the engineering blueprint and prototype-building documentation for the SIH problem statement:

**AI-Enabled Drone & Counter-Drone Threat Simulation Trainer**

Start with:

1. `docs/guides/start_here.md`
2. `docs/background/problem_and_scope.md`
3. `docs/modules/blueprint.md`
4. `docs/guides/first_vertical_slice.md`
5. `docs/project-management/build_order.md`

Docs are grouped under `docs/`: `background/`, `modules/`, `api/`, `project-management/`, `guides/`, and `plans/`. See `docs/guides/project_structure.md`.

Then use the subsystem documents while implementing.

This pack is intentionally focused on building the actual software prototype, not on PPT preparation.

## Running the Phase 3 demo (browser client)

1. Backend: `cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000`
2. Client: `cd client && npm install && npm run dev`
3. Open http://localhost:5173, start a scenario, detect/classify/respond, finish, and review the AAR.

Pixel-level visual checks (3D scene rendering, threat movement, AAR layout)
are a human browser step: open the client, run a full session, and confirm
the scene, HUD, action buttons, and scorecard render as expected.

Client unit tests: `cd client && npm test`
Backend tests: `cd backend && .venv/Scripts/python -m pytest tests -q`
