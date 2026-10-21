# Contributing to Aeroguard

Thanks for your interest. Aeroguard is an offline-first drone and counter-drone
**training simulator**. Contributions of code, tests, docs and design feedback
are welcome, provided they respect the project's [scope and safety
boundaries](README.md#scope--safety).

## Before you start

- Read the [README](README.md) and the [local setup guide](docs/guides/local_setup.md).
- Check existing issues before opening a new one; for a large change, open an
  issue first so the approach can be agreed.
- Report security issues privately as described in [SECURITY.md](SECURITY.md) —
  never in a public issue or pull request.
- By contributing, you agree that your contribution is licensed under the
  [MIT License](LICENSE).

## Development setup

Prerequisites: Python 3.11 or 3.12, Node 20+ (developed on Node 22), Git.
Unity **6000.6.5f1** is optional and only needed for the Unity spike.

### Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows; source .venv/bin/activate on Unix
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Check <http://127.0.0.1:8000/health> and <http://127.0.0.1:8000/docs>. All
configuration is optional and env-overridable; see
`backend/.env.example`. Never commit a populated `.env` file.

For meaningful dashboard data, seed the deterministic demo set:

```bash
cd backend
python scripts/seed_demo.py --sessions 50
```

### Simulator client

```bash
cd client
npm ci
npm run dev                       # http://localhost:5173, proxies /api → :8000
```

### Instructor dashboard

```bash
cd dashboard
npm ci
npm run dev                       # http://localhost:5174, proxies /api → :8000
```

### Docker (optional)

```bash
docker compose up --build
```

See [docs/guides/docker.md](docs/guides/docker.md) for details.

## Branch and commit conventions

Work on a short-lived branch off the latest `main` — do not commit directly to
`main`, force-push shared branches, or merge your own PR.

Use a branch name that names the change, for example:

```text
feat/replay-scrubber
fix/false-alarm-penalty
docs/local-setup-clarify
test/scoring-edge-cases
chore/bump-vite
refactor/extract-aar-builder
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
matching the existing history:

```text
<type>(<optional scope>): <imperative summary>
```

Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`
and `perf`. Examples from this repository:

```text
feat(unity): add the runtime scene, simulation loop and IMGUI HUD
test(scoring): cover false alarms and missed threats
docs(readme): document the optional Unity client and phase 8 status
fix(api): reject events for completed sessions
```

Keep each commit small, focused and independently understandable; prefer
several atomic commits over one large one. Do not mix unrelated refactors or
formatting churn into a behavioural change. See
[docs/project-management/git_workflow.md](docs/project-management/git_workflow.md)
for the original solo-build workflow this convention grew from.

## Tests

Run the relevant suite before opening a pull request. All suites are offline
by default.

### Backend

```bash
cd backend
.venv/Scripts/python -m pytest tests -q      # Windows
# source .venv/bin/activate && python -m pytest tests -q   # Unix
```

Golden tests enforce scenario determinism and contract tests keep
`docs/api/openapi.yaml`, the routers and the docs in sync. If you change the
API, update the OpenAPI spec and the human-readable
[docs/api/api_specification.md](docs/api/api_specification.md) in the same PR.

### Simulator client

```bash
cd client
npm run typecheck
npm test
npm run build
```

### Instructor dashboard

```bash
cd dashboard
npm run typecheck
npm test
npm run build
```

### Unity (optional spike)

EditMode tests need no backend:

```powershell
$unity = "C:\Program Files\Unity\Hub\Editor\6000.6.5f1\Editor\Unity.exe"
Start-Process -FilePath $unity -Wait -ArgumentList @(
  "-batchmode", "-nographics",
  "-projectPath", "unity/Aeroguard-Unity",
  "-runTests", "-testPlatform", "EditMode",
  "-testResults", "$env:TEMP\unity-editmode.xml",
  "-logFile", "$env:TEMP\unity-editmode.log"
)
```

The live PlayMode integration test is skipped unless
`AEROGUARD_RUN_LIVE_TESTS=1` and a backend is running on
`AEROGUARD_API_URL`. Full commands and build automation are in
[unity/Aeroguard-Unity/README.md](unity/Aeroguard-Unity/README.md).

### End-to-end validation (optional)

With the backend running and demo data seeded,
`python backend/scripts/validate_demo.py` exercises the full
generate → play → score → AAR → recommend sequence. See
[docs/guides/testing_validation.md](docs/guides/testing_validation.md).

## Pull request expectations

- Keep the PR focused on one change with a clear description and a linked
  issue where one exists.
- Add or update tests for behavioural changes, and update affected docs.
- Ensure typechecks, tests and builds pass locally for every surface you
  touched.
- Preserve the invariants: deterministic seeds, server-authoritative scoring,
  validated event logs, and no client-side score computation.
- Do not commit secrets, `.env` files, databases, build outputs, Unity
  `Library/` caches or model weights.
- Do not add real drone detection, targeting, jamming or engagement logic.
  Responses stay abstract training categories.
- Avoid generated files and dependency lockfile churn unless the change
  specifically requires it.
- A maintainer will review; expect at least one approval and a green CI run
  before merge. Maintainers may squash-merge to keep the history atomic.

## Questions

Open a public discussion or issue for non-security questions. For anything
sensitive, use the private process in [SECURITY.md](SECURITY.md).
