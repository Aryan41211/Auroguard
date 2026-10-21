# Phase 8 (optional) - Unity client spike

**Status:** complete
**Gate:** only after the Phase 7 definition of done (met before this spike started)
**Scope:** prove the training loop is graphics-independent; do not replace the
browser client or add new backend behaviour.

## Goal

A minimal Unity 6 client that runs the same server-authoritative loop as
`client/`:

```text
/health -> generate scenario -> create session -> submit events -> complete -> AAR
```

Success means: the same event log produces the same score whether it comes from
the browser or from Unity, and no scoring or adaptive logic is duplicated in
C#.

## Deliverables

| Area | Delivered |
|---|---|
| Project | `unity/Aeroguard-Unity`, pinned to Unity `6000.6.5f1`, built-in modules only |
| Scene | Empty `Assets/Scenes/Main.unity`; camera, lighting, airfield and HUD built at runtime |
| API layer | Coroutine `UnityWebRequest` client for health, scenario, session, events, complete, AAR |
| Contract | `[Serializable]` DTOs mirroring the frozen snake_case schema; `ApiJson` omits `threat_id` for session-level events |
| Simulation | Seeded scenario request, timed threat spawning, deterministic presentation path, detect/classify/respond, false alarm, missed-threat recording, auto-complete at duration |
| AAR | Summary, component scores, mistakes, strengths/weaknesses, recommendation, next scenario |
| Environment | Day/night light, fog density by visibility tier; visuals never affect scoring |
| Automation | `Aeroguard.EditorTools.ProjectSetup.Configure` (scene + build settings) and `BuildWindows` |
| Tests | 17 EditMode unit tests + 1 guarded PlayMode live integration test |
| Build | Windows x64 player built in batch mode as a smoke check |

## Explicit non-goals

- Custom art, prefabs, animation, audio or WebGL/VR builds.
- Client-side scoring, replay or adaptive recommendations.
- Any backend or OpenAPI changes (the spike consumes the frozen `v1` contract).
- Making Unity the supported training surface.

## Validation

```powershell
# EditMode, offline
Unity -batchmode -nographics -projectPath unity/Aeroguard-Unity \
      -runTests -testPlatform EditMode -testResults editmode.xml

# PlayMode, live backend
$env:AEROGUARD_RUN_LIVE_TESTS = "1"
$env:AEROGUARD_API_URL = "http://127.0.0.1:8000"
Unity -batchmode -nographics -projectPath unity/Aeroguard-Unity \
      -runTests -testPlatform PlayMode -testResults playmode.xml

# Windows player build
Unity -batchmode -quit -nographics -projectPath unity/Aeroguard-Unity \
      -executeMethod Aeroguard.EditorTools.ProjectSetup.BuildWindows
```

Captured results:

- EditMode: **17 passed, 0 failed** (base-URL resolution, threat paths, DTO/AAR
  parsing, event JSON).
- PlayMode live: **1 passed, 0 failed** - final score `100`, no mistakes, AAR
  summary contains `100`.
- Windows build: success, ~96 MB player at `Builds/Aeroguard.exe` (git-ignored).

The live test is skipped unless `AEROGUARD_RUN_LIVE_TESTS=1`, so offline test
runs stay green.

## Notes and follow-ups

- `threat_id` must be absent, not `""`, on session events; `JsonUtility` cannot
  express that, hence `ApiJson`.
- IMGUI and runtime scene construction were chosen so the spike has no binary
  assets and stays reviewable.
- If Unity is ever promoted beyond a spike: replace IMGUI with UGUI/UI Toolkit,
  add prefabs and a proper scene, and add a WebGL build to CI. None of that
  changes the backend contract.
