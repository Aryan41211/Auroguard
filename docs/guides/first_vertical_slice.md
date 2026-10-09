# AEROVIGIL — First Vertical Slice

This document is the exact first implementation target.

Do not build the entire platform first.

## Goal

Complete one end-to-end training session.

## Step 1 — Backend

Create:

- FastAPI app
- `/health`
- scenario model
- scenario generator
- one scenario endpoint

Return one valid scenario.

## Step 2 — Unity

Create:

- empty 3D scene
- ground
- camera
- one simple aerial threat

## Step 3 — Load scenario

Unity requests a scenario from FastAPI.

Display:

- environment
- time
- difficulty
- threat count

## Step 4 — Spawn threat

Read spawn time from scenario.

Spawn the object.

Move it along a simple deterministic path.

## Step 5 — Detection

Provide a clear trainee action:

`DETECT`

When selected:

- record event
- calculate detection latency
- move to classification

## Step 6 — Classification

Display abstract labels.

Example:

- friendly
- civilian
- unknown
- suspicious
- hostile

The scenario contains the expected training label.

## Step 7 — Response

Display abstract choices:

- monitor
- track
- report/escalate
- hold

Record selection.

## Step 8 — Scoring

Backend evaluates:

- detection
- classification
- response
- timing

## Step 9 — AAR

Display:

```text
Final Score
Detection
Classification
Response
Timing
Errors
Recommendation
```

## Step 10 — Repeat

Run the same scenario again with a different seed.

Confirm that at least one scenario variable changes.

## Definition of done

You are done with the first vertical slice when a person unfamiliar with the code can:

1. start the app
2. start a scenario
3. respond to a simulated threat
4. finish the scenario
5. see a score
6. see an AAR
7. start another scenario
8. observe randomized scenario differences

Only then should you expand the environment and AI.
