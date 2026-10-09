# AEROVIGIL — Detailed Build Order

This is an engineering implementation order.

## Stage 1 — Repository

Create:

```text
AEROVIGIL/
docs/
backend/
simulator/
data/
```

Add the documentation first.

## Stage 2 — Backend skeleton

Create:

```text
backend/app/main.py
backend/app/api/
backend/app/services/
backend/app/schemas/
backend/app/db/
backend/tests/
```

Make `/health` work.

## Stage 3 — Scenario engine

Implement:

1. enums
2. Pydantic scenario schema
3. random seed
4. generator
5. validator
6. unit tests

Do not involve Unity yet.

## Stage 4 — Scoring engine

Implement scoring as a pure Python service.

Input:

- scenario
- event list

Output:

- metrics
- component scores
- final score
- errors

Test it heavily.

## Stage 5 — SQLite

Persist:

- scenarios
- sessions
- events
- scores

## Stage 6 — Unity scene

Build the smallest possible environment.

## Stage 7 — Unity interaction

Implement:

- detect
- classify
- response
- session completion

Use hardcoded local scenario data temporarily if necessary.

## Stage 8 — API integration

Replace local scenario data with FastAPI data.

Then replace local score calculation with backend scoring.

## Stage 9 — AAR

Build AAR from stored session data.

## Stage 10 — Adaptive engine

Use recent scores and condition-specific metrics.

## Stage 11 — Content expansion

Add:

- urban
- rural
- day
- night
- reduced visibility
- 2–5 threats

## Stage 12 — Dashboard

Only now build React analytics.

## Stage 13 — VR

Only after desktop interaction is stable.

## Rule

At every stage maintain a runnable build.

Never let the project remain broken for several stages.
