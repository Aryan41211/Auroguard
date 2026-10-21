# Aeroguard — Docker Deployment

Run the whole stack (API, simulator, dashboard) with Docker Compose. The images
are offline-friendly: no external services are required and no secrets are
baked in.

## 1. Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose version`)
- Ports `8000`, `5173` and `5174` free on the host

## 2. Start the stack

From the repository root:

```bash
docker compose up --build
```

Then open:

| Service | URL | Notes |
| --- | --- | --- |
| Simulator (client) | <http://localhost:5173> | Play a session, replay from the AAR |
| Dashboard | <http://localhost:5174> | Session history, "Watch" replay links |
| API docs | <http://localhost:8000/docs> | OpenAPI / Swagger UI |
| API health | <http://localhost:8000/health> | Used by the container healthcheck |

Run detached with `docker compose up -d --build` and follow logs with
`docker compose logs -f`.

## 3. What runs

| Service | Image | Container port | Build |
| --- | --- | --- | --- |
| `backend` | `aeroguard-backend` | `8000` | `backend/Dockerfile` (multi-stage, non-root uid 10001) |
| `client` | `aeroguard-client` | `80` → host `5173` | `client/Dockerfile` (Node build → nginx) |
| `dashboard` | `aeroguard-dashboard` | `80` → host `5174` | `dashboard/Dockerfile` (Node build → nginx) |

- The backend stores SQLite data in the named volume `aeroguard-data` mounted
  at `/data` (`AEROGUARD_DATABASE_URL=sqlite:////data/aeroguard.db`). Data
  survives `docker compose down`; it is removed by `docker compose down -v`.
- Both front ends serve static files from nginx and proxy `/api/` to
  `http://backend:8000`, so the browser only ever talks to one origin.
- `client` and `dashboard` wait for the backend healthcheck
  (`service_healthy`) before starting.

## 4. Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `AEROGUARD_SIMULATOR_URL` | `http://localhost:5173` | Public URL of the simulator, baked into the dashboard bundle at build time |
| `AEROGUARD_LLM_BASE_URL` | unset | Optional OpenAI-compatible narrator endpoint |
| `AEROGUARD_LLM_API_KEY` | unset | Optional narrator API key (never commit it) |
| `AEROGUARD_LLM_MODEL` | unset | Optional narrator model name |

The narrator is optional: without it the AAR uses deterministic templated text.

Set values in the shell or a local, git-ignored `.env` file next to
`docker-compose.yml`:

```bash
AEROGUARD_SIMULATOR_URL=http://simulator.example.internal docker compose up -d --build
```

Because the simulator URL is a build-time constant, rebuild the dashboard image
after changing it:

```bash
docker compose build dashboard
docker compose up -d dashboard
```

## 5. Healthchecks

Every service defines an HTTP healthcheck:

```bash
docker compose ps
```

All three should report `healthy`. Manual checks:

```bash
curl http://localhost:8000/health
curl http://localhost:5173/healthz
curl http://localhost:5174/healthz
```

## 6. Common operations

```bash
docker compose logs -f backend     # follow the API log
docker compose build client        # rebuild one image after source changes
docker compose restart backend     # restart without rebuilding
docker compose down                # stop and remove containers (keeps the DB volume)
```

To reset all recorded sessions, remove the volume (destructive):

```bash
docker compose down -v
```

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `bind: address already in use` | Host port taken | Stop the local dev server or change the host port in `docker-compose.yml` |
| Front end loads but API calls fail | Backend not healthy yet | `docker compose ps`; wait for `healthy`, then `docker compose logs backend` |
| Dashboard replay links go to `localhost:5173` | Default `VITE_SIMULATOR_URL` | Rebuild with `AEROGUARD_SIMULATOR_URL` set (section 4) |
| Data disappears after `down` | Volume removed with `-v` | Expected; omit `-v` to keep `aeroguard-data` |
| nginx returns 502 | Backend container down or restarting | `docker compose logs backend`, then `docker compose restart backend` |

## 8. Running without Docker

See `docs/guides/local_setup.md` for the native Python/Node workflow. The test
commands are the same either way and do not require Docker.
