# Aeroguard — Engineering Checklist

## Foundation

- [x] Create repository
- [x] Add docs
- [x] Pin Unity version
- [x] Create Python environment
- [x] Create FastAPI skeleton
- [x] Add `/health`
- [x] Add Git ignore rules

## Data model

- [x] Scenario model
- [x] Threat model
- [x] Session model
- [x] Event model
- [x] Score model
- [x] Performance profile

## Scenario engine

- [x] Seed support
- [x] Scenario validation
- [x] Environment
- [x] Day/night
- [x] Visibility
- [x] Sensor quality
- [x] Threat count
- [x] Difficulty
- [x] Spawn timing
- [x] Anti-repetition logic

## Unity

> Delivered for the Phase 3 vertical slice by the browser Three.js client
> (`client/`); the optional Phase 8 spike adds a Unity implementation
> (`unity/Aeroguard-Unity`, Unity `6000.6.5f1`).

- [x] Main scene
- [x] Camera
- [x] Environment
- [x] Threat prefab
- [x] Threat movement
- [x] Scenario loader
- [x] Detection UI
- [x] Classification UI
- [x] Response UI
- [x] Timer
- [x] Session completion

## Backend

- [x] Scenario endpoint
- [x] Session endpoint
- [x] Event endpoint
- [x] Complete-session endpoint
- [x] AAR endpoint
- [x] Performance endpoint
- [x] Recommendation endpoint

## Scoring

- [x] Detection score
- [x] Classification score
- [x] Response score
- [x] Timing score
- [x] Penalties
- [x] Final score
- [x] Unit tests

## AAR

- [x] Summary
- [x] Metrics
- [x] Errors
- [x] Timeline
- [x] Weakness detection
- [x] Recommendation

## Adaptive training

- [x] Historical performance
- [x] Difficulty adjustment
- [x] Condition-specific weakness
- [x] Next scenario recommendation

## Content expansion (Phase 5)

- [x] Generator dimension coverage tests (environment, day/night, visibility tiers, sensor bins, threat counts)
- [x] Anti-repetition: 10 consecutive scenarios, no repeated configuration
- [x] Client fog/noise degradation by visibility tier (visual only)
- [x] Client night lighting adjustment (visual only)
- [x] Multi-threat HUD with per-threat stage and color coding (ground truth kept secret)
- [x] Per-condition metrics on performance endpoint (urban/rural, visibility tiers, sensor bins)
- [x] Condition-specific recommendation evidence

## Dashboard + instructor mode (Phase 6)

- [x] Session history endpoint (`GET /sessions`, optional `trainee_id` filter)
- [x] Dashboard dev origin allowed in CORS (5174)
- [x] Demo data seeder (`scripts/seed_demo.py`, 6 differentiated trainee profiles, ~50 sessions)
- [x] Tabbed dashboard app (`dashboard/`, Vite + React + TS + Recharts, port 5174)
- [x] Session history table with trainee filter
- [x] Score trend line chart per trainee
- [x] Weakness heatmap of condition scores (null buckets render `n/a`)
- [x] Trainee performance view with one-click recommendation
- [x] Instructor scenario builder with playable simulator link
- [x] Simulator start-panel prefill from scenario query params

## Replay, demo polish & deployment (Phase 7)

- [x] Replay schemas and pure replay builder (`app/schemas/replay.py`, `app/services/replay.py`)
- [x] `GET /sessions/{session_id}/replay` route
- [x] OpenAPI contract + conformance test for replay
- [x] Client replay timeline, player, scrubber panel and 3D replay view
- [x] AAR "Watch replay" entry point + `#replay=` deep link
- [x] Dashboard history "Watch" replay link
- [x] WebAudio sound cues (offline, no binary assets) + HUD toggle
- [x] Keyboard shortcuts (`d`, `1`–`5`, `m`, `t`, `r`, `h`, `f`, `Enter`)
- [x] Improved lighting/sky (hemisphere light, grid, night stars)
- [x] Recoverable error panels (client + dashboard)
- [x] Guided demo mode (`?demo=1` scripted auto-pilot)
- [x] `backend/scripts/validate_demo.py` + captured evidence
- [x] Dockerfiles, nginx configs, `docker-compose.yml`, `.dockerignore`
- [x] `docs/guides/docker.md` and troubleshooting pass
- [x] `docs/modules/replay.md` and API specification section

## Unity spike (Phase 8, optional)

- [x] Unity `6000.6.5f1` project with built-in modules only (`unity/Aeroguard-Unity`)
- [x] Runtime-built scene: camera, lighting, procedural airfield, HUD
- [x] Coroutine API client: health, scenario, session, events, complete, AAR
- [x] Seeded session loop with timed spawns and deterministic threat paths
- [x] Detect / classify / respond / false alarm / missed-threat recording
- [x] AAR view with scores, mistakes and recommendations
- [x] Day/night and visibility-driven fog/lighting (visual only)
- [x] Headless `Configure` and `BuildWindows` editor automation
- [x] 17 EditMode unit tests + 1 guarded live PlayMode integration test
- [x] Windows player build verified in batch mode
- [x] `unity/Aeroguard-Unity/README.md` and `docs/plans/phase-8-unity-spike.md`

## Polish

- [x] Better assets (procedural primitives only; no binary assets added)
- [x] Better lighting
- [x] Sound
- [x] UI polish
- [x] Error handling
- [x] Demo mode

## Optional

- [x] React dashboard
- [ ] VR
- [ ] advanced analytics
