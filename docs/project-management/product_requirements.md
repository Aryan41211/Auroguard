# AEROVIGIL — Product Requirements

## 1. Functional requirements

### FR-01 Scenario creation

The system shall create a scenario from:

- environment
- time condition
- visibility
- sensor quality
- threat count
- threat profiles
- difficulty
- random seed
- scenario duration

### FR-02 Scenario randomization

The system shall randomize selected scenario variables while respecting configured safety and difficulty limits.

### FR-03 Threat spawning

The simulator shall spawn simulated aerial objects according to the scenario definition.

### FR-04 Detection

The trainee shall have an explicit detection action.

The system shall record:

- object id
- detection timestamp
- detection location/context
- whether the detection was valid

### FR-05 Classification

After detection, the trainee shall select a classification from the allowed training taxonomy.

The system shall compare the choice with scenario ground truth.

### FR-06 Response decision

The trainee shall select an abstract response category.

Example categories:

- continue monitoring
- track
- report/escalate
- hold

The system shall compare the choice with the scenario's expected training label.

### FR-07 Timing

The system shall calculate:

- time to first detection
- time from detection to classification
- time from classification to response
- total decision time

### FR-08 Event log

Every important state transition shall create a timestamped event.

### FR-09 Scoring

The system shall calculate component scores and a final score.

### FR-10 AAR

The system shall generate:

- session summary
- accuracy metrics
- timing metrics
- mistakes
- event timeline
- strengths
- weaknesses
- recommended next training

### FR-11 Session history

The system shall retain completed session summaries.

### FR-12 Adaptive difficulty

The system shall be able to select a next difficulty/scenario configuration from recent performance.

## 2. Non-functional requirements

### NFR-01 Determinism

A scenario with the same version, configuration, and seed should produce the same generated scenario.

### NFR-02 Explainability

Every score and recommendation must be traceable to measurable session data.

### NFR-03 Offline-first prototype

The simulator should be usable on a laptop without requiring a cloud service.

### NFR-04 Performance

The initial desktop prototype should target stable frame rate on ordinary student hardware.

### NFR-05 Modularity

Scenario generation, scoring, storage, and rendering should be separate modules.

### NFR-06 Testability

The scoring engine and scenario generator must be testable without launching Unity.

## 3. Acceptance criteria for the MVP

A build is considered MVP-complete when:

1. User starts a scenario.
2. A threat appears.
3. User detects it.
4. User classifies it.
5. User selects a response.
6. The system records the session.
7. Score is calculated.
8. AAR is shown.
9. Session can be retrieved from history.
10. Starting another session changes at least one randomized scenario variable.
