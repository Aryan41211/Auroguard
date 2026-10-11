# Aeroguard dashboard (Phase 6)

Instructor and trainee views over the read-only `/api/v1` JSON API: Vite +
React + TypeScript + Recharts (roadmap tech stack).

The dashboard never scores; every number comes from the backend. It dev-serves
on **5174** (the simulator client owns 5173) and proxies `/api` to
`http://localhost:8000`.

## Views

1. **History** — session history table with a trainee filter (`GET /sessions`).
2. **Trends** — final-score line chart per trainee over completed sessions.
3. **Weakness heatmap** — condition scores (day/night, urban/rural, visibility
   tiers, sensor bins, multi-threat) from `GET /trainees/{id}/performance`; null
   buckets render `n/a`.
4. **Trainee performance** — accuracies, mean reaction time, current level and a
   one-click `POST /training/recommend` with the metric-cited reason.
5. **Instructor builder** — form → `POST /scenarios/generate` → scenario preview
   and a **Play in simulator** link that prefills the simulator at
   `http://localhost:5173` from the query string.

## Prerequisites
- Node 20+ (developed on Node 22)
- The backend running (see the root README)

## Install
    npm install

## Run (dev)
1. Start the backend (from `backend/`):
       .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
2. Seed demo data (from `backend/`), optional but recommended:
       .venv/Scripts/python scripts/seed_demo.py --sessions 50
3. Start the dashboard (from `dashboard/`):
       npm run dev
4. Open http://localhost:5174

## Test / typecheck / build
    npm test
    npm run typecheck
    npm run build
