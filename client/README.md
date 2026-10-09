# Aeroguard client (Phase 3 vertical slice)

Browser client for the Aeroguard trainer: Vite + TypeScript + Three.js.
It renders the scenario, drives the detect/classify/respond flow, and shows
the after-action review (AAR).

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
