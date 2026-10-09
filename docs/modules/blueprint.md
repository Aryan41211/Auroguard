# Aeroguard — Master Engineering Blueprint

## 1. Product loop

```text
Scenario Configuration
        |
        v
Scenario Generator
        |
        v
Scenario Manifest
        |
        v
Unity Simulation
        |
        +--> Trainee Actions
        |
        v
Event Logger
        |
        v
Scoring Engine
        |
        v
AAR Generator
        |
        v
Performance Profile
        |
        v
Adaptive Scenario Selection
        |
        +--------------------> Next Session
```

## 2. Major subsystems

### Simulator

Responsible for:

- environment rendering
- camera
- simulated object movement
- lighting
- visibility effects
- UI
- trainee input

It should not contain authoritative scoring rules.

### Scenario engine

Responsible for:

- generating scenarios
- randomization
- difficulty
- ground truth
- event schedule

### Scoring engine

Responsible for:

- validating actions
- calculating metrics
- applying score weights
- producing explainable results

### Session store

Responsible for:

- session metadata
- events
- scores
- performance history

### AAR engine

Responsible for turning measured session data into:

- summary
- mistakes
- timeline
- strengths
- weaknesses
- recommendations

### Adaptive engine

Responsible for choosing the next training configuration from performance data.

## 3. Separation of authority

The simulator is a presentation layer.

The scenario manifest is the authoritative description of the training exercise.

The scoring engine is the authoritative scoring component.

Do not calculate the final score from UI state alone.

## 4. Local development architecture

```text
+-----------------------+
|       Unity App       |
|  simulation + input   |
+-----------+-----------+
            |
       HTTP / JSON
            |
+-----------v-----------+
|       FastAPI         |
| scenario/scoring/AAR  |
+-----------+-----------+
            |
+-----------v-----------+
|        SQLite         |
| sessions/events/scores|
+-----------------------+
```

For an offline demo, FastAPI can run on `localhost`.

## 5. Initial alternative

For the very first proof-of-concept, you may keep scenario and scoring logic inside Unity to reduce setup time.

However, once the interaction works, move authoritative scenario/scoring logic into Python so it can be tested and reused.

## 6. Why this architecture

It prevents three common failures:

1. graphics becoming the entire project
2. scoring being hard-coded into UI buttons
3. inability to demonstrate analytics independently of Unity

## 7. Development order

Build by dependency, not by visual importance:

1. data models
2. scenario generator
3. scoring engine
4. session/event model
5. Unity scene
6. interaction flow
7. API integration
8. AAR
9. adaptive engine
10. dashboard
11. VR support

This is an engineering build order, not a presentation roadmap.
