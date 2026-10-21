# Aeroguard — Deterministic Session Replay

## 1. Purpose

Replay lets a trainee or instructor watch a completed (or in-flight) session
again, scrub through it, and see exactly what the system recorded. It is the
visual companion to the AAR: the AAR says *what was wrong*, the replay shows
*when it happened*.

Replay must be deterministic and server-authoritative. It is not a second
simulation and it is not a video recording.

## 2. Server authority

Sources of truth:

- `docs/api/openapi.yaml` — `GET /sessions/{session_id}/replay` and the
  `ReplayResponse`, `ReplayEvent`, `ReplayFrame`, `ReplayThreatState` schemas.
- `backend/app/services/replay.py` — pure builder
  (`build_frames`, `build_replay`, `state_at`).
- `backend/app/api/replay.py` — thin route: load session, scenario, events and
  score, then delegate.

The backend replays the recorded event log and publishes, for every moment in
time, the authoritative per-threat state. The client only renders those frames;
it never derives or guesses state. This preserves the project rule that clients
report events and the server decides outcomes.

`GET /sessions/{session_id}/replay` accepts completed and active sessions. The
embedded `score` is `null` until the session has been scored; the AAR endpoint
still requires completion.

## 3. Response shape

```json
{
  "session_id": "SES-1001",
  "trainee_id": "TRAIN-001",
  "scenario": { "...": "full Scenario ground truth" },
  "events": [
    {
      "event_id": "EVT-042",
      "type": "THREAT_DETECTED",
      "timestamp_ms": 59400,
      "threat_id": "T01",
      "payload": { "confidence": 0.92 }
    }
  ],
  "frames": [
    {
      "timestamp_ms": 59400,
      "event_id": "EVT-042",
      "event_type": "THREAT_DETECTED",
      "label": "T01 detected",
      "threat_id": "T01",
      "threats": [
        {
          "threat_id": "T01",
          "stage": "detected",
          "detected": true,
          "classification": null,
          "response": null
        }
      ]
    }
  ],
  "score": { "...": "ScoreResult or null" },
  "duration_ms": 200000
}
```

- `events` and `frames` are ordered by `(timestamp_ms, event_id)`, so identical
  timestamps are stable and reproducible.
- There is exactly one frame per recorded event. A frame is the *state after*
  that event was applied.
- `duration_ms` is the last recorded timestamp (or `0` for an empty session).
- `frames[].threats` always contains every threat in the scenario, sorted by
  threat id, so the client can render a complete picture from any frame.

## 4. Threat stages

| Stage | Meaning |
| --- | --- |
| `pending` | In the scenario but not yet spawned at this point in time |
| `spawned` | `THREAT_SPAWNED` recorded |
| `detected` | Trainee detected it |
| `classified` | Trainee submitted a label (correct or not) |
| `responded` | Trainee submitted an abstract response |
| `missed` | A `THREAT_MISSED` event was recorded |

Stages are cumulative: a `CLASSIFICATION_SUBMITTED` event keeps `detected:
true`, and a `RESPONSE_SUBMITTED` event keeps the earlier classification and
response values. Later stages do not erase earlier evidence.

An untracked event type (for example `SESSION_COMPLETED`) still produces a
frame and keeps the state map unchanged, so the scrubber always covers the full
session.

Note that a missed threat is derived for the AAR from the *absence* of a
`THREAT_DETECTED` event, while replay shows `missed` only when a
`THREAT_MISSED` event exists. The two views are intentionally different: the
AAR is the authority on the mistake, the replay shows the recorded state.

## 5. Client rendering

Client modules (`client/src/replay/`):

| Module | Responsibility |
| --- | --- |
| `timeline.ts` | Pure frame/timeline model: scrub index, progress, active frame |
| `replayPlayer.ts` | Drives playback against an injectable `ReplayClock` |
| `replayPanel.ts` | Scrubber, play/pause, event feed |
| `replayView.ts` | Applies frames to the Three.js scene |
| `threatState.ts` | Maps server stages to visual states |

Entry points:

- **Watch replay** in the AAR panel.
- `#replay=SES-...` deep link (used by the dashboard's history "Watch" column).
- Keyboard: `r` opens the replay for the current session.

Playback ends when `virtualTime >= duration_ms`, so the timeline always reaches
the recorded end even if the last event is far after the last threat.

## 6. Determinism and testing

The builder is a pure function of `(scenario, events)`; no clocks, randomness or
database reads occur inside it. Tests:

- `backend/tests/test_replay_service.py` — frame ordering, stable tie-break,
  state accumulation, missed stage, empty session, `state_at`.
- `backend/tests/test_replay_api.py` — response shape, 404s, in-flight sessions.
- `backend/tests/test_contract_conformance.py` — route and schema present in
  `docs/api/openapi.yaml`.
- `client/src/replay/*.test.ts` — timeline math, player loop, stage mapping.
- `backend/scripts/validate_demo.py` — end-to-end evidence (see
  `docs/project-management/demo_evidence.md`).

To verify manually, complete a session, note its `SES-...` id, and request:

```bash
curl http://127.0.0.1:8000/api/v1/sessions/SES-1001/replay
```

Two requests for the same session must return identical payloads.

## 7. Non-goals

- Replay does not re-run threat physics; it is driven by the recorded log.
- Replay does not change scores or the AAR.
- Replay is not a video export format.
