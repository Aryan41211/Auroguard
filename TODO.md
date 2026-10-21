# Aeroguard — Master TODO (Phase 7 completion)

Phases 0–6 are complete (see `docs/plans/00-master-roadmap.md`). This file tracks
the remaining work to finish the project: **Phase 7 — replay, demo polish,
deployment**, plus the open "Polish" checklist items.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## A. Branch & baseline

- [x] A1 Create `feat/phase-7-replay-polish-deployment` branch
- [x] A2 Record baseline test counts — backend 161 · client 30 · dashboard 40

## B. Deterministic replay (backend authority)

- [x] B1 `app/schemas/replay.py` — ReplayResponse / ReplayEvent / ReplayFrame / ReplayThreatState
- [x] B2 `app/services/replay.py` — pure builder: events → ordered frames + per-threat state timeline
- [x] B3 `app/api/replay.py` — `GET /api/v1/sessions/{session_id}/replay`
- [x] B4 Wire router into `app/main.py`
- [x] B5 Tests: service unit tests (determinism, ordering, state timeline)
- [x] B6 Tests: API tests (200 shape, 404 unknown session)
- [x] B7 Update `docs/api/openapi.yaml` (path + schemas) — contract conformance
- [x] B8 Update `docs/api/api_specification.md`

## C. Replay viewer (client)

- [x] C1 `client/src/replay/timeline.ts` — pure timeline model (frames, scrub index)
- [x] C2 `client/src/replay/timeline.test.ts`
- [x] C3 `client/src/replay/replayPanel.ts` — scrubber UI + event feed
- [x] C4 `client/src/replay/replayPlayer.ts` — drives the 3D scene from frames
- [x] C5 `client/src/api/client.ts` — `getReplay(sessionId)`
- [x] C6 Entry point: "Watch replay" from AAR panel + `#replay=<session_id>` deep link
- [x] C7 Client tests for new modules

## D. Sound & UI polish

- [x] D1 `client/src/audio/sounds.ts` — WebAudio synth cues (no binary assets, offline)
- [x] D2 `client/src/audio/sounds.test.ts`
- [x] D3 Wire cues into the session loop (detect / classify / respond / spawn / false alarm)
- [x] D4 UI polish: better lighting + sky, panel styling, keyboard shortcuts
- [x] D5 Error handling: API failures show a recoverable error panel (client + dashboard)
- [x] D6 Demo mode: guided auto-play ("demo" query param) for the demo script

## E. Dashboard integration

- [x] E1 History row "Replay" link → client replay deep link
- [x] E2 Dashboard error handling / empty states
- [x] E3 Dashboard tests

## F. Deployment & operations

- [x] F1 `backend/Dockerfile` (multi-stage, non-root, healthcheck)
- [x] F2 `client/Dockerfile` + `dashboard/Dockerfile` (nginx, build-time API base)
- [x] F3 `docker-compose.yml` (backend, client, dashboard, healthchecks)
- [x] F4 `.dockerignore` files
- [x] F5 Docs: `docs/guides/docker.md`

## G. Demo validation & evidence

- [x] G1 `backend/scripts/validate_demo.py` — full demo sequence against the live API
- [x] G2 Answer the 5 validation questions (seed / score / missed threat / comparison / adaptive)
- [x] G3 Write `docs/project-management/demo_evidence.md` with real captured output
- [x] G4 Troubleshooting pass → `docs/project-management/troubleshooting.md`

## H. Documentation close-out

- [x] H1 README — status, replay, docker, new endpoints, test counts
- [x] H2 `docs/project-management/development_checklist.md` — Phase 7 + Polish sections
- [x] H3 `docs/plans/00-master-roadmap.md` — Phase 7 marked complete
- [x] H4 `report.md` — Phase 7 verification report
- [x] H5 `docs/modules/*.md` — replay module doc

## I. Final verification

- [x] I1 Backend: `pytest -q` green
- [x] I2 Client: `npm run typecheck && npm test && npm run build` green
- [x] I3 Dashboard: `npm run typecheck && npm test && npm run build` green
- [x] I4 `git status` clean, commits pushed
