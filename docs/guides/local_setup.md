# Aeroguard — Local Laptop Setup

## 1. Recommended software

Install:

- Git
- VS Code
- Python 3.11 or 3.12
- Unity Hub
- a current supported Unity LTS release
- .NET tooling installed with Unity
- optional Node.js for React dashboard

Exact Unity version should be selected once and pinned for the team.

## 2. Create repository

```bash
mkdir Aeroguard
cd Aeroguard
git init
```

Create the docs, backend and simulator directories.

## 3. Backend environment

```bash
cd backend
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Install:

```bash
pip install fastapi uvicorn pydantic sqlalchemy pytest httpx
```

Freeze dependencies after verifying versions.

## 4. Run backend

Development command:

```bash
uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
```

## 5. Unity

Create a 3D Unity project.

Recommended initial project name:

`Aeroguard-Simulator`

Keep the first scene tiny.

## 6. First local integration

Run FastAPI locally.

Then make Unity call:

`GET /health`

Only after this works should you connect scenario generation.

## 7. Recommended first integration test

Unity launches.

Unity calls backend.

Backend returns:

```json
{
  "status": "ok"
}
```

Unity displays:

`Backend: Connected`

That proves the two applications can communicate.

## 8. Then integrate scenario generation

Unity requests a scenario.

Backend returns JSON.

Unity displays the returned:

- difficulty
- environment
- time
- threat count

Do not add gameplay complexity until this data flow works.
