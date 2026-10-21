# Aeroguard — Master TODO (Phase 7 completion)

Phases 0–6 are complete (see `docs/plans/00-master-roadmap.md`). This file tracks
the remaining work to finish the project: **Phase 7 — replay, demo polish,
deployment**, plus the open "Polish" checklist items.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

## A. Branch & baseline

- [x] A1 Create `feat/phase-7-replay-polish-deployment` branch
- [x] A2 Record baseline test counts — backend 161 · client 30 · dashboard 40

## B. Deterministic replay (backend authority)

- [ ] B1 `app/schemas/replay.py` — ReplayResponse / ReplayEvent / ReplayFrame / ReplayThreatState
- [ ] B2 `app/services/replay.py` — pure builder: events → ordered frames + per-threat state timeline
- [ ] B3 `app/api/replay.py` — `GET /api/v1/sessions/{session_id}/replay`
- [ ] B4 Wire router into `app/main.py`
- [ ] B5 Tests: service unit tests (determinism, ordering, state timeline)
- [ ] B6 Tests: API tests (200 shape, 404 unknown session)
- [ ] B7 Update `docs/api/openapi.yaml` (path + schemas) — contract conformance
- [ ] B8 Update `docs/api/api_specification.md`

## C. Replay viewer (client)

- [ ] C1 `client/src/replay/timeline.ts` — pure timeline model (frames, scrub index)
- [ ] C2 `client/src/replay/timeline.test.ts`
- [ ] C3 `client/src/replay/replayPanel.ts` — scrubber UI + event feed
- [ ] C4 `client/src/replay/replayPlayer.ts` — drives the 3D scene from frames
- [ ] C5 `client/src/api/client.ts` — `getReplay(sessionId)`
- [ ] C6 Entry point: "Watch replay" from AAR panel + `#replay=<session_id>` deep link
- [ ] C7 Client tests for new modules

## D. Sound & UI polish

- [ ] D1 `client/src/audio/sounds.ts` — WebAudio synth cues (no binary assets, offline)
- [ ] D2 `client/src/audio/sounds.test.ts`
- [ ] D3 Wire cues into the session loop (detect / classify / respond / spawn / false alarm)
- [ ] D4 UI polish: better lighting + sky, panel styling, keyboard shortcuts
- [ ] D5 Error handling: API failures show a recoverable error panel (client + dashboard)
- [ ] D6 Demo mode: guided auto-play ("demo" query param) for the demo script

## E. Dashboard integration

- [ ] E1 History row "Replay" link → client replay deep link
- [ ] E2 Dashboard error handling / empty states
- [ ] E3 Dashboard tests

## F. Deployment & operations

- [ ] F1 `backend/Dockerfile` (multi-stage, non-root, healthcheck)
- [ ] F2 `client/Dockerfile` + `dashboard/Dockerfile` (nginx, build-time API base)
- [ ] F3 `docker-compose.yml` (backend, client, dashboard, healthchecks)
- [ ] F4 `.dockerignore` files
- [ ] F5 Docs: `docs/guides/docker.md`

## G. Demo validation & evidence

- [ ] G1 `backend/scripts/validate_demo.py` — full demo sequence against the live API
- [ ] G2 Answer the 5 validation questions (seed / score / missed threat / comparison / adaptive)
- [ ] G3 Write `docs/project-management/demo_evidence.md` with real captured output
- [ ] G4 Troubleshooting pass → `docs/project-management/troubleshooting.md`

## H. Documentation close-out

- [ ] H1 README — status, replay, docker, new endpoints, test counts
- [ ] H2 `docs/project-management/development_checklist.md` — Phase 7 + Polish sections
- [ ] H3 `docs/plans/00-master-roadmap.md` — Phase 7 marked complete
- [ ] H4 `report.md` — Phase 7 verification report
- [ ] H5 `docs/modules/*.md` — replay module doc

## I. Final verification

- [ ] I1 Backend: `pytest -q` green
- [ ] I2 Client: `npm run typecheck && npm test && npm run build` green
- [ ] I3 Dashboard: `npm run typecheck && npm test && npm run build` green
- [ ] I4 `git status` clean, commits pushed
