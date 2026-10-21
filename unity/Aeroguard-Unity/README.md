# Aeroguard Unity Spike (Phase 8)

A deliberately small Unity 6 client that proves the browser simulator is not
the only way to train: it walks the same server-authoritative loop as
`client/`:

```text
/health -> POST /scenarios/generate -> POST /sessions
        -> POST /events (detect / classify / respond / false alarm)
        -> POST /complete -> GET /aar
```

The Unity client records **what happened** and renders the AAR. It never
computes a score, so a session played here is scored exactly like one played in
the browser.

> Optional spike: the browser client remains the supported training surface.
> This project exists to prove the training logic is graphics-independent.

## Requirements

- Unity **6000.6.5f1** (Unity 6) with the Windows and WebGL Build Support modules.
- The FastAPI backend running locally on `http://127.0.0.1:8000`.
- No binary assets, prefabs or packages beyond Unity's built-in modules.

## Run it

1. Start the backend from the repository root:

   ```bash
   cd backend
   .venv/Scripts/python -m uvicorn app.main:app --port 8000
   ```

2. Open `unity/Aeroguard-Unity` in Unity Hub (editor version 6000.6.5f1).
3. Open `Assets/Scenes/Main.unity` and press **Play**.

The scene file itself is intentionally empty. `AeroguardBootstrap` builds the
camera, lighting, procedural airfield and simulation components at runtime, so
there is nothing binary to review.

### Controls

The IMGUI HUD drives the decision chain for the currently selected threat:

- **DETECT** - report that the target exists.
- **Classification** - `friendly` / `civilian` / `unknown` / `suspicious` / `hostile`.
- **Response** - `monitor` / `track` / `report` / `hold`.
- **Next threat**, **False alarm**, **End session**.
- After completion the AAR shows scores, mistakes, strengths, weaknesses and
  the next-training recommendation; **New scenario** starts a fresh seed.

### Configuration

Settings are resolved from command-line flags, then environment variables, then
offline defaults:

| Setting | Flag | Environment | Default |
|---|---|---|---|
| API base URL | `-aeroguardApi=URL` | `AEROGUARD_API_URL` | `http://127.0.0.1:8000` |
| Trainee ID | `-aeroguardTrainee=ID` | - | `UNITY-TRAINEE` |
| Seed | `-aeroguardSeed=NNN` | - | `20261021` (the frozen demo seed) |
| Difficulty | `-aeroguardDifficulty=1..10` | - | `4` |
| Threat count | `-aeroguardThreats=1..5` | - | `2` |

Example:

```powershell
.\Builds\Aeroguard.exe -aeroguardApi=http://127.0.0.1:8000 -aeroguardSeed=12345
```

> **WebGL caveat:** browsers cannot receive command-line flags or environment
> variables, so the WebGL build always uses the defaults above, including
> `http://127.0.0.1:8000` as the API base URL. To point a browser build at a
> different backend, change `ClientConfig.DefaultBaseUrl` or add a URL query
> parameter and rebuild; `-aeroguardApi` only affects desktop players.

## Architecture

| File | Responsibility |
|---|---|
| `ApiDtos.cs` | `[Serializable]` DTOs mirroring the frozen snake_case contract |
| `ApiJson.cs` | Event envelope JSON; omits `threat_id` for session-level events |
| `AeroguardApi.cs` | Coroutine `UnityWebRequest` client for all six endpoints |
| `ClientConfig.cs` | CLI/env resolution and validation |
| `SimulationManager.cs` | Session state machine, spawning, event submission, completion |
| `ThreatPath.cs` | Pure, deterministic presentation path (unit tested) |
| `ThreatController.cs` | Moves a primitive along `ThreatPath` |
| `EnvironmentView.cs` | Applies day/night and visibility to fog/lighting (visual only) |
| `ScenarioHud.cs` | IMGUI HUD, decision chain and AAR |
| `AeroguardBootstrap.cs` | Builds the scene at runtime |
| `Assets/Editor/ProjectSetup.cs` | Headless scene/build automation |

Threats are neutral grey spheres: the client never colours them by ground
truth, and `classification_label` / `expected_response` are read only from the
AAR, never to preselect an answer.

## Tests

**EditMode (17 tests, no backend required):**

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

Covers base-URL/flag resolution, deterministic threat paths, DTO parsing of the
frozen contract, AAR parsing, and event-envelope serialisation (including the
`threat_id` omission rule).

**PlayMode live integration (1 test, needs a running backend):**

```powershell
$env:AEROGUARD_RUN_LIVE_TESTS = "1"
$env:AEROGUARD_API_URL = "http://127.0.0.1:8000"
Start-Process -FilePath $unity -Wait -ArgumentList @(
  "-batchmode", "-nographics",
  "-projectPath", "unity/Aeroguard-Unity",
  "-runTests", "-testPlatform", "PlayMode",
  "-testResults", "$env:TEMP\unity-playmode.xml",
  "-logFile", "$env:TEMP\unity-playmode.log"
)
```

`UnityBackendIntegrationTests` runs health -> scenario -> session -> the full
event sequence -> complete -> AAR against the live API and asserts a final
score of `100` with no mistakes. It is skipped unless
`AEROGUARD_RUN_LIVE_TESTS=1`, so the suite stays green offline.

## Headless setup and build

Recreate the empty scene and build settings:

```powershell
Start-Process -FilePath $unity -Wait -ArgumentList @(
  "-batchmode", "-quit", "-nographics",
  "-projectPath", "unity/Aeroguard-Unity",
  "-executeMethod", "Aeroguard.EditorTools.ProjectSetup.Configure",
  "-logFile", "$env:TEMP\unity-configure.log"
)
```

Build a Windows player to `Builds/Aeroguard.exe` (ignored by git):

```powershell
Start-Process -FilePath $unity -Wait -ArgumentList @(
  "-batchmode", "-quit", "-nographics",
  "-projectPath", "unity/Aeroguard-Unity",
  "-executeMethod", "Aeroguard.EditorTools.ProjectSetup.BuildWindows",
  "-logFile", "$env:TEMP\unity-build.log"
)
```

Build a WebGL player to `Builds/WebGL` (ignored by git):

```powershell
Start-Process -FilePath $unity -Wait -ArgumentList @(
  "-batchmode", "-quit", "-nographics",
  "-projectPath", "unity/Aeroguard-Unity",
  "-executeMethod", "Aeroguard.EditorTools.ProjectSetup.BuildWebGL",
  "-logFile", "$env:TEMP\unity-webgl-build.log"
)
```

The build uses Gzip compression with the decompression fallback enabled, so it
runs behind any plain static file server without special `Content-Encoding`
headers.

### Serve the WebGL build

Start the backend first (see **Run it**), then serve the build folder:

```powershell
cd unity/Aeroguard-Unity/Builds/WebGL
python -m http.server 5174
```

Open `http://127.0.0.1:5174/index.html`.

Use port **5174** (or 5173) because the backend's CORS allowlist only accepts
those origins. Serving on another port makes the browser block the API calls.
Browsers also enforce mixed-content rules: if the page is served over HTTPS, the
backend must be HTTPS too.

## Out of scope for the spike

- VR builds.
- Custom art, animation, audio and prefabs.
- Client-side replay of previous sessions (use the browser client or dashboard).
- Offline rule scoring, adaptive logic or persistence (backend authority stays
  in the backend).
