# Aeroguard — Unity Prototype Build

## 1. Unity goal

Unity is the visual simulation client.

The first prototype does not need a large map.

## 2. Initial scene

Create:

```text
MainScene
├── Environment
├── Lighting
├── MainCamera
├── SimulationManager
├── ThreatManager
├── InputManager
├── ScenarioManager
├── UI
└── EventLogger
```

## 3. Environment

Start with simple primitives:

- cubes for buildings
- plane for ground
- simple trees/objects
- directional light
- fog

Do not spend time on custom assets initially.

## 4. Threat object

Create a simple prefab:

```text
DroneThreat
├── Mesh
├── Collider
├── ThreatIdentity
├── ThreatMovement
└── VisibilityController
```

`ThreatIdentity` stores only a scenario object id and presentation metadata.

Ground truth should remain controlled by the scenario manifest/backend.

## 5. Simulation manager

Responsible for:

- loading scenario
- starting timer
- spawning threats
- advancing scenario state
- ending session

## 6. Interaction flow

```text
Idle
 |
 v
Threat appears
 |
 v
Trainee detects
 |
 v
Classification UI
 |
 v
Response UI
 |
 v
Threat resolved
 |
 v
Next threat
 |
 v
Session complete
```

## 7. Input

Desktop prototype:

- mouse for UI
- keyboard shortcuts only for convenience
- optional click-to-detect interaction

Keep the interaction explicit.

## 8. Day/night

Use Unity lighting:

- day: normal directional light
- night: lower ambient light
- optional skybox change

## 9. Sensor degradation

Apply presentation effects such as:

- fog
- blur
- noise overlay
- lower contrast
- temporary visibility reduction

Do not alter scoring based on the visual effect alone. Scoring should depend on the actual scenario conditions and recorded actions.

## 10. Multi-threat

Spawn multiple threat objects from the scenario manifest.

Start with 2–3.

Only optimize for larger counts after the interaction works.

## 11. UI

Minimum screens:

- Main Menu
- Scenario Setup
- Simulation HUD
- Classification Panel
- Response Panel
- AAR

## 12. Build sequence inside Unity

1. Empty scene
2. Camera + ground
3. One drone prefab
4. Drone movement
5. Spawn timer
6. Detection button
7. Classification panel
8. Response panel
9. Session completion
10. AAR screen
11. Scenario loading
12. Backend integration

## 13. Important architecture rule

Avoid putting all logic in `GameManager.cs`.

Use small components with clear responsibilities.
