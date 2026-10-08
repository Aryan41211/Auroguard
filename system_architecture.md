# AEROVIGIL — System Architecture

## 1. Components

### Unity client

Responsibilities:

- render world
- render simulated threats
- accept keyboard/mouse/controller input
- display state
- send trainee actions
- receive scenario data
- show AAR

### FastAPI backend

Responsibilities:

- create scenario
- validate scenario
- store session
- score actions
- generate AAR
- calculate training profile
- recommend next scenario

### SQLite

Tables:

- scenarios
- sessions
- events
- scores
- performance_profiles

## 2. Communication

Initial protocol:

`HTTP + JSON`

Example:

```text
POST /api/v1/scenarios/generate
POST /api/v1/sessions
POST /api/v1/sessions/{id}/events
POST /api/v1/sessions/{id}/complete
GET  /api/v1/sessions/{id}/aar
GET  /api/v1/trainees/{id}/performance
POST /api/v1/training/recommend
```

## 3. Data flow

```text
Unity requests scenario
        |
        v
FastAPI creates scenario
        |
        v
Scenario JSON
        |
        v
Unity loads scenario
        |
        v
Trainee plays
        |
        v
Actions/events
        |
        v
FastAPI validates + stores
        |
        v
Session completion
        |
        v
Scoring
        |
        v
AAR
```

## 4. Offline mode

The application should work when:

- FastAPI is localhost
- SQLite is local
- Unity assets are local

Internet should not be required for the core simulator.

## 5. Future deployment

If required later:

```text
Unity Client
    |
    v
API Gateway / HTTPS
    |
    +--> FastAPI
    |
    +--> PostgreSQL
    |
    +--> Object storage for optional assets
```

Do not introduce cloud infrastructure until the local prototype is stable.
