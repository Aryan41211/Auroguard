# Advanced analytics — cohort condition report

The optional advanced-analytics item is scoped to **cohort condition reports**:
how do completed training sessions score under different scenario conditions?
It adds one read-only backend endpoint and one instructor-dashboard view. It
does not change scoring semantics, the database schema, or the training loop.

> **VR/XR is out of scope.** No XR hardware or packages were available, so no
> VR surface (real or mocked) is included.

## What it answers

Given all completed, scored sessions (optionally filtered to one trainee), the
report groups sessions into buckets for three scenario conditions:

| Dimension | Buckets |
|---|---|
| `environment` | `urban`, `rural` |
| `time_of_day` | `day`, `night` |
| `visibility` | `clear`, `reduced`, `poor` |

For each bucket it reports `session_count` and the mean of the stored score
components (`final`, `detection`, `classification`, `response`, `timing`),
rounded to two decimals. Buckets are returned in canonical order; buckets with
no sessions are omitted.

## API

`GET /api/v1/analytics/conditions` — optional `?trainee_id=` query parameter.

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
        }
      ]
    }
  ]
}
```

- Active or unscored sessions are excluded; completed sessions are joined to
  their `ScenarioRow` conditions and `ScoreRow` scores.
- Scores are **read** from `ScoreRow`, never recomputed. The scoring engine is
  the only source of score values.
- An empty database returns `total_sessions: 0` with empty bucket lists.
- Response schemas: `ConditionsAnalyticsResponse`, `ConditionDimension`,
  `ConditionBucketMetrics` (`backend/app/schemas/analytics.py`).

Implementation:

| Layer | File |
|---|---|
| Route | `backend/app/api/analytics.py` |
| Pure aggregation | `backend/app/services/analytics.py` |
| Schemas | `backend/app/schemas/analytics.py` |
| Contract | `docs/api/openapi.yaml`, `docs/api/api_specification.md` |
| Tests | `backend/tests/test_analytics_service.py`, `backend/tests/test_analytics_api.py` |

## Dashboard

The instructor dashboard (`dashboard/`) adds an **Analytics** tab. It fetches the
endpoint with the current trainee filter and renders:

- a Recharts bar chart of mean final score per bucket, and
- a comparison table with session counts and all five mean score components.

Loading, empty and error states follow the existing dashboard views. Pure
formatting/flattening lives in `dashboard/src/views/analytics.ts`; the component
is `dashboard/src/views/AnalyticsView.tsx`.

## Tests

- Backend: aggregation unit tests (empty input, multiple sessions, means,
  two-decimal rounding, canonical bucket order) and API tests (200 shape,
  aggregation, active-session exclusion, trainee filter), plus OpenAPI contract
  conformance.
- Dashboard: pure-helper tests and component tests for data, loading, empty and
  error states, plus client path/filter tests.

## Changelog

- **2026-10-21** — Added `GET /api/v1/analytics/conditions`, the pure
  `services.analytics` aggregation, Pydantic response schemas, OpenAPI/API docs,
  and the dashboard **Analytics** tab with chart, table and states. No schema
  migration, no scoring changes, no VR/XR surface.
