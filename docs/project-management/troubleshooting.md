# Aeroguard — Troubleshooting

## Unity cannot reach FastAPI

Check:

```text
FastAPI running?
Correct host/port?
Firewall?
HTTP URL?
```

Use:

`http://127.0.0.1:8000/health`

## Scenario JSON fails to parse

Check:

- property names
- enum values
- null fields
- schema version

Log the raw response during development.

## Score differs between runs

Check:

- scenario seed
- event timestamps
- generator version
- scoring version
- floating-point timing assumptions

## AAR missing an event

Check:

1. Unity emitted event
2. HTTP request succeeded
3. backend validated event
4. database stored event
5. AAR queried correct session

## Unity scene becomes too slow

First reduce:

- object count
- texture resolution
- post-processing
- lighting complexity

Do not optimize prematurely.

## Adaptive system behaves strangely

Log:

```text
previous performance
selected weakness
rule triggered
new difficulty
reason
```

Adaptive behavior must be explainable.

## Backend code becomes hard to maintain

Check whether:

- routes contain business logic
- models contain scoring logic
- Unity is treated as the source of truth

Move logic into services.

## Replay shows no events

Check, in order:

1. `GET /api/v1/sessions/{session_id}` returns the session (otherwise use the
   `SES-...` id from history, not the scenario id).
2. The session has recorded events: `GET /api/v1/sessions/{session_id}/replay`
   should list them in `events`.
3. The client was opened with `#replay=SES-...`, or via the "Watch replay"
   button in the AAR.
4. The browser console for a failed `/replay` request.

A replay of an in-flight session is valid; `score` is `null` until the session
is completed.

## Replay scrubbing stops early or overshoots

The replay is server-authoritative: frames are the recorded events, and
`duration_ms` is the last event timestamp. A completed session's last event is
often `SESSION_COMPLETED` at a large timestamp; that is expected. If the total
duration looks wrong, inspect the last event in the replay payload rather than
patching the client timeline.

## Browser client cannot reach the API

The client and dashboard call `/api/v1` on their own origin, which the Vite dev
server and the nginx containers proxy to `http://backend:8000`. Check:

- the backend is running on port 8000
- you are using the dev server (`npm run dev`) or a container, not `dist/`
  opened directly from disk (no proxy there)
- CORS only matters when calling the API from another origin; the allowed
  origins are `localhost:5173` and `localhost:5174`

## Dashboard replay links open the wrong host

`VITE_SIMULATOR_URL` is baked in at build time and defaults to
`http://localhost:5173`. Set it before `npm run build`, or rebuild the
dashboard container with `AEROGUARD_SIMULATOR_URL`. See `docs/guides/docker.md`.

## Docker Compose starts but the front ends fail

`docker compose ps` should show `backend` as `healthy` before the front ends
start. Then:

```bash
docker compose logs backend
docker compose logs client
```

Common causes: host port already in use, or the dashboard bundle built before
`AEROGUARD_SIMULATOR_URL` was set. Details in `docs/guides/docker.md`.

## Demo validation script fails

`backend/scripts/validate_demo.py` reports `[FAIL]` with the failing HTTP call
or check. Common causes:

- API not running at `--base-url` (the script prints a clear "cannot reach"
  message)
- an infeasible scenario request (difficulty too low/high for the fixed
  environment/time/threat factors) — the API returns `422` with the reason
- a check on `session_count >= 2`: run the script to completion at least once
  for that trainee after completing two sessions

The script is also covered by `backend/tests/test_validate_demo.py` against an
in-process TestClient, so this path is exercised in CI.

## Tests fail on a Windows checkout

Run the suites from the repository root with the right interpreters:

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend\tests -q
npm test --prefix client
npm test --prefix dashboard
```

If ports or a stale `aeroguard.db` interfere, the test fixtures already use a
temporary database per test; a stale dev database only affects a manually
started server. Delete the dev `.db` file (not tracked) if you want a clean
local demo.

