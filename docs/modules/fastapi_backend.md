# Aeroguard — FastAPI Backend Build

## 1. Suggested structure

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   ├── scenarios.py
│   │   ├── sessions.py
│   │   ├── aar.py
│   │   └── training.py
│   ├── schemas/
│   │   ├── scenario.py
│   │   ├── session.py
│   │   └── events.py
│   ├── services/
│   │   ├── scenario_generator.py
│   │   ├── scoring.py
│   │   ├── aar.py
│   │   └── adaptive.py
│   └── db/
│       ├── models.py
│       └── database.py
└── tests/
```

## 2. Initial dependencies

Typical prototype dependencies:

```text
fastapi
uvicorn
pydantic
sqlalchemy
pytest
httpx
```

Pin versions after creating the environment.

## 3. Development environment

Use a Python virtual environment.

Example:

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Install dependencies from `requirements.txt`.

## 4. FastAPI entry point

`main.py` should:

- create FastAPI app
- register routers
- expose health endpoint

Example endpoint:

`GET /health`

Response:

```json
{
  "status": "ok"
}
```

## 5. Service separation

Routes should not contain scoring algorithms.

Bad:

```text
route -> 100 lines of scoring logic
```

Better:

```text
route
  -> service
      -> scoring engine
```

## 6. Database

Create tables automatically during early development or use migrations once the schema stabilizes.

## 7. Testing

Test services without Unity.

Minimum tests:

- scenario generation
- scenario validation
- scoring
- timing
- AAR generation
- adaptive recommendation

## 8. Deterministic test

Given:

```text
seed = 12345
generator_version = 1
```

the scenario should be identical across runs.

This is important for debugging and demonstrations.
