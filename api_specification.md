# AEROVIGIL — API Specification

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
  "final_score": 87,
  "aar_available": true
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
