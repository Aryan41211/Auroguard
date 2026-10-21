# Aeroguard — API Specification

## 1. API conventions

Base:

`/api/v1`

Content type:

`application/json`

Use Pydantic models for request/response validation.

## 2. Generate scenario

### Request

`POST /scenarios/generate`

```json
{
  "difficulty": 5,
  "environment": "urban",
  "time_of_day": "night",
  "threat_count": 2,
  "seed": 12345
}
```

### Response

```json
{
  "scenario_id": "SCN-100",
  "seed": 12345,
  "difficulty": 5,
  "environment": "urban",
  "time_of_day": "night",
  "sensor_quality": 0.7,
  "duration_seconds": 120,
  "threats": []
}
```

## 3. Create session

`POST /sessions`

```json
{
  "trainee_id": "TRAIN-001",
  "scenario_id": "SCN-100"
}
```

## 4. Submit event

`POST /sessions/{session_id}/events`

```json
{
  "type": "THREAT_DETECTED",
  "timestamp_ms": 1820,
  "threat_id": "T01",
  "payload": {}
}
```

## 5. Complete session

`POST /sessions/{session_id}/complete`

Response:

```json
{
  "session_id": "SES-1001",
  "detection_score": 30.0,
  "classification_score": 30.0,
  "response_score": 25.0,
  "timing_score": 15.0,
  "penalty": 0.0,
  "final_score": 100.0,
  "aar_available": true,
  "scoring_version": 1
}
```

## 6. Retrieve AAR

`GET /sessions/{session_id}/aar`

Response should include:

- summary
- scores
- timing
- mistakes
- strengths
- weaknesses
- recommendation

## 7. Performance

`GET /trainees/{trainee_id}/performance`

Returns historical aggregates.

## 8. Recommendation

`POST /training/recommend`

Input:

```json
{
  "trainee_id": "TRAIN-001"
}
```

Output:

```json
{
  "recommended_difficulty": 6,
  "environment": "urban",
  "time_of_day": "night",
  "threat_count": 3,
  "reason": "Recent sessions show weaker performance under night and multi-threat conditions."
}
```

## 9. API rules

- validate every request
- reject unknown enum values
- return meaningful HTTP status codes
- never trust client-provided final scores
- calculate scores server-side when backend mode is enabled

## 10. List session history

`GET /sessions`

Feeds the instructor dashboard history table and score trends. Optional
`trainee_id` query parameter filters to one trainee. Sessions are ordered
newest-first by `started_at`, with `session_id` as a deterministic tie-break.

Response:

```json
{
  "sessions": [
    {
      "session_id": "SES-1001",
      "trainee_id": "TRAIN-001",
      "scenario_id": "SCN-100",
      "status": "completed",
      "started_at": "2026-01-01T12:00:00",
      "completed_at": "2026-01-01T12:02:00",
      "seed": 12345,
      "difficulty": 5,
      "environment": "urban",
      "time_of_day": "night",
      "visibility": "reduced",
      "sensor_quality": 0.7,
      "threat_count": 2,
      "final_score": 82.0,
      "detection_score": 30.0,
      "classification_score": 25.0,
      "response_score": 15.0,
      "timing_score": 12.0,
      "penalty": 0.0
    }
  ]
}
```

Score fields are null while a session is still `active`.

## 11. Session replay

`GET /sessions/{session_id}/replay`

Returns the recorded event log plus server-derived frames for the replay
scrubber. Works for active and completed sessions; `score` is `null` until the
session has been scored. Two requests for the same session return identical
payloads (events and frames are stable-sorted by `timestamp_ms`, then
`event_id`).

Response:

```json
{
  "session_id": "SES-1001",
  "trainee_id": "TRAIN-001",
  "scenario": {
    "scenario_id": "SCN-100",
    "seed": 12345,
    "difficulty": 5,
    "threats": []
  },
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
  "score": {
    "session_id": "SES-1001",
    "detection_score": 30.0,
    "classification_score": 30.0,
    "response_score": 25.0,
    "timing_score": 15.0,
    "penalty": 0.0,
    "final_score": 100.0,
    "scoring_version": 1
  },
  "duration_ms": 200000
}
```

`frames` contains one entry per event, carrying the state of every threat after
that event. Stages are `pending`, `spawned`, `detected`, `classified`,
`responded` and `missed`. See `docs/modules/replay.md`.

Errors: `404` for an unknown session or a missing scenario row.

## 12. Cohort condition analytics

`GET /analytics/conditions`

Aggregates every completed, scored session into buckets for the scenario
conditions the training loop already records: `environment`, `time_of_day` and
`visibility`. Active or unscored sessions are excluded. An optional
`trainee_id` query parameter narrows the cohort to one trainee.

Each bucket reports its session count and the mean of the stored score
components, rounded to two decimals. Buckets appear in canonical order
(`urban`/`rural`, `day`/`night`, `clear`/`reduced`/`poor`); an empty database
returns `total_sessions: 0` with empty bucket lists.

Response:

```json
{
  "total_sessions": 3,
  "dimensions": [
    {
      "dimension": "environment",
      "buckets": [
        {
          "bucket": "urban",
          "session_count": 2,
          "mean_final_score": 85.0,
          "mean_detection_score": 25.5,
          "mean_classification_score": 25.5,
          "mean_response_score": 21.25,
          "mean_timing_score": 12.75
        },
        {
          "bucket": "rural",
          "session_count": 1,
          "mean_final_score": 70.0,
          "mean_detection_score": 21.0,
          "mean_classification_score": 21.0,
          "mean_response_score": 17.5,
          "mean_timing_score": 10.5
        }
      ]
    }
  ]
}
```

This endpoint does not recompute scores; it reads the server-authoritative
`ScoreRow` values written at session completion.

