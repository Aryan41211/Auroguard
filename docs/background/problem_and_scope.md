# Aeroguard — Problem, Scope and Interpretation

## 1. Problem statement in engineering terms

The problem asks for a software-based training platform that allows personnel to repeatedly practice recognizing, classifying, and responding to simulated drone/swarm threats under different environmental and sensor conditions.

The system must support:

- scripted scenarios
- procedurally generated scenarios
- day/night conditions
- degraded sensor conditions
- urban/rural environments
- single and multi-threat scenarios
- objective scoring
- after-action review
- repeated-session performance tracking
- difficulty adjustment
- scenario randomization

## 2. What the product is

Aeroguard is best understood as:

> A virtual training environment plus an assessment engine plus a personalized training loop.

The simulator is only one part of the system.

The full product is:

`Simulation + Interaction + Event Logging + Scoring + AAR + Adaptive Training`

## 3. What the product is not

Do not scope the prototype as:

- a physical anti-drone system
- a drone command-and-control platform
- a weapon targeting system
- an autonomous interception system
- a real-world engagement planner
- a replacement for live operational training

The prototype should demonstrate training value, not operational deployment.

## 4. Core users

### Trainee

Needs to:

- start a scenario
- observe the simulated environment
- identify objects
- classify them
- choose abstract response categories
- review performance

### Instructor

Needs to:

- create/select scenarios
- control difficulty
- inspect trainee performance
- identify recurring weaknesses
- review session history

### Unit/admin user

Needs aggregate performance metrics without requiring access to unnecessary personal information.

## 5. Success criteria

The prototype should demonstrate:

### Functional

- scenario can be generated
- scenario can be played
- events are recorded
- trainee actions are scored
- AAR is generated
- results persist
- next scenario can adapt to performance

### Technical

- deterministic replay is possible from a stored scenario seed
- scenario ground truth is separated from the UI
- scoring does not depend on visual appearance
- backend APIs are testable independently of Unity

### Training

- repeated scenarios are not identical
- performance can be measured over multiple sessions
- weaknesses can be detected
- training recommendations are explainable

## 6. MVP boundary

### Must have

- one desktop environment
- one simulated aerial object
- one multi-object scenario
- day/night state
- visibility/sensor degradation
- randomized spawn position/timing
- detection interaction
- classification interaction
- abstract response interaction
- event logging
- scoring
- AAR
- session history

### Should have

- urban and rural environments
- adaptive difficulty
- multiple threat profiles
- instructor scenario configuration
- performance trends

### Later

- VR
- richer 3D assets
- multiplayer
- advanced analytics
- voice interaction
- optional LLM-generated natural-language summaries

## 7. Engineering principle

The training logic must remain independent of the graphics.

A drone represented by a simple sphere must be scored exactly like the same drone represented by a high-quality 3D model.
