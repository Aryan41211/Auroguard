# Aeroguard — Demo Evidence

Captured output from running the full demo sequence against a real API process.
This is the technical evidence requested by `demo_validation.md`; it validates
the software architecture and training methodology, not real-world operational
effectiveness (see the "avoid unsupported claims" list there).

## How this was captured

```powershell
# from backend/ (with the venv active, or use .venv\Scripts\python.exe)
$env:AEROGUARD_DATABASE_URL = "sqlite:///./demo_validate.db"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# in a second shell
python backend/scripts/validate_demo.py `
    --trainee-id DEMO-TRAINEE --seed 20261021 --json demo_evidence.json
```

The script drives the public HTTP API, then independently recomputes the
scenario and the score from the pure services to check that the server's output
is reproducible. Exit code `0` and `5/5 validation questions passed` means every
check held. Everything below is unedited output from that run.

## Validation questions

| # | Question | Answer | Evidence |
| --- | --- | --- | --- |
| 1 | Can the same seed reproduce the same scenario? | **Yes** | Seed `20261021` produced `SCN-261021`; a repeated API call and the local generator both returned a byte-identical scenario. |
| 2 | Can the same events reproduce the same score? | **Yes** | The AAR timeline was rescored locally to `50.0`; the API stored `50.0`; a repeated `complete` call returned the identical result. |
| 3 | Can a missed threat be detected in the AAR? | **Yes** | AAR `mistakes` contains `missed_threat` for `T02` at `68700 ms` ("no detection recorded"). |
| 4 | Can performance be compared across sessions? | **Yes** | `GET /trainees/DEMO-TRAINEE/performance` aggregates both sessions; history shows `SES-5EBBAEC0` = `50.0` and `SES-8FCFF1C7` = `100.0`. |
| 5 | Can adaptive difficulty explain why it changed? | **Yes** | Recommendation returns difficulty `1` with a reason naming the weak dimension ("Multi-threat score 50.0 is 25.0 points below overall 75.0..."). |

## Scenario seed and configuration

```json
{
  "scenario_id": "SCN-261021",
  "seed": 20261021,
  "generator_version": "1.0",
  "difficulty": 4,
  "environment": "urban",
  "time_of_day": "day",
  "visibility": "reduced",
  "sensor_quality": 0.85,
  "duration_seconds": 150.0,
  "threats": [
    {
      "id": "T01",
      "category": "unknown_aerial_object",
      "classification_label": "suspicious",
      "expected_response": "report",
      "spawn_time": 57.6,
      "speed_class": "fast",
      "visibility_class": "reduced"
    },
    {
      "id": "T02",
      "category": "unknown_aerial_object",
      "classification_label": "civilian",
      "expected_response": "monitor",
      "spawn_time": 68.7,
      "speed_class": "medium",
      "visibility_class": "reduced"
    }
  ]
}
```

## Session and event log

Session `SES-5EBBAEC0` deliberately handles `T01` correctly and misses `T02`
(the same failure mode as the client's demo auto-pilot):

```json
[
  {"type": "SESSION_STARTED", "timestamp_ms": 0, "threat_id": null},
  {"type": "SCENARIO_LOADED", "timestamp_ms": 0, "threat_id": null},
  {"type": "THREAT_SPAWNED", "timestamp_ms": 57600, "threat_id": "T01"},
  {"type": "THREAT_DETECTED", "timestamp_ms": 59400, "threat_id": "T01"},
  {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 60600, "threat_id": "T01", "payload": {"label": "suspicious"}},
  {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 61500, "threat_id": "T01", "payload": {"response": "report"}},
  {"type": "THREAT_SPAWNED", "timestamp_ms": 68700, "threat_id": "T02"},
  {"type": "SESSION_COMPLETED", "timestamp_ms": 200000, "threat_id": null}
]
```

The second session `SES-8FCFF1C7` used seed `20261022` (difficulty 3, one
threat) and handled it correctly, producing a perfect `100.0` for contrast.

## Final score and AAR

```json
{
  "summary": "Final score 50.0/100: detected 1/2, classified 1/2, responded 1/2.",
  "scores": {
    "detection_score": 15.0,
    "classification_score": 15.0,
    "response_score": 12.5,
    "timing_score": 7.5,
    "penalty": 0.0,
    "final_score": 50.0,
    "scoring_version": 1
  },
  "timing": {
    "mean_time_to_detection_ms": 1800.0,
    "mean_detection_to_classification_ms": 1200.0,
    "mean_classification_to_response_ms": 900.0,
    "mean_total_decision_ms": 2100.0
  },
  "mistakes": [
    {
      "kind": "missed_threat",
      "timestamp_ms": 68700,
      "threat_id": "T02",
      "detail": "no detection recorded"
    }
  ],
  "weaknesses": [
    "Detection: lost 15.0 of 30.",
    "Classification: lost 15.0 of 30.",
    "Response: lost 12.5 of 25.",
    "Timing: lost 7.5 of 15."
  ],
  "recommendation": "Focus on detection in the next session."
}
```

The score is proportional to the two-threat scenario: one correct decision chain
earns half of detection, classification and response, and the timing points are
divided by the total threat count.

## Performance history and adaptive recommendation

```json
{
  "trainee_id": "DEMO-TRAINEE",
  "session_count": 2,
  "detection_accuracy": 75.0,
  "classification_accuracy": 75.0,
  "response_accuracy": 75.0,
  "average_reaction_time_ms": 2100.0,
  "day_score": 75.0,
  "multi_threat_score": 50.0,
  "reduced_visibility_score": 75.0,
  "urban_score": 75.0,
  "high_sensor_score": 75.0,
  "current_level": 1
}
```

```json
{
  "recommended_difficulty": 1,
  "environment": "urban",
  "time_of_day": "day",
  "threat_count": 3,
  "reason": "Multi-threat score 50.0 is 25.0 points below overall 75.0; recommending a 3-threat scenario at difficulty 1."
}
```

The recommendation is explainable: it names the dimension that drove the
change and the resulting scenario parameters, and the backend persists the new
level (`PerformanceProfileRow.current_level`) for the next request.

## Replay of the missed threat

```json
{
  "session_id": "SES-5EBBAEC0",
  "duration_ms": 200000,
  "events": 8,
  "frames": 8,
  "missed_threat_state": {
    "threat_id": "T02",
    "stage": "spawned",
    "detected": false,
    "classification": null,
    "response": null
  }
}
```

The replay replays the recorded log frame by frame; the missed threat is
visibly spawned but never detected. The AAR is the authority on the mistake
(`missed_threat`), while the replay shows *when* it happened.

## Notes for a live demo

- The same script is a smoke test after deployment:
  `python backend/scripts/validate_demo.py --base-url http://localhost:8000`.
- Run it against a fresh database for clean `SES-*` identifiers; the checks are
  written to tolerate a reused `DEMO-TRAINEE` (they assert `session_count >= 2`).
- The client demo mode (`?demo=1`) mirrors this failure mode: the scripted
  auto-pilot handles the early threats and intentionally misclassifies the last
  one, so the AAR always contains a teaching point.
