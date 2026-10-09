# Aeroguard — Scenario Engine

## 1. Purpose

The scenario engine creates repeatable but variable training situations.

It must prevent rote memorization while keeping scenarios controlled enough to score objectively.

## 2. Scenario dimensions

### Environment

- urban
- rural

### Time

- day
- night

### Visibility

- clear
- reduced
- poor

### Sensor quality

Numeric value from 0 to 1.

Example:

`1.0 = clear`

`0.7 = mild degradation`

`0.4 = strong degradation`

`0.2 = severe degradation`

### Threat count

Start with:

- 1
- 2
- 3
- 5

The prototype does not need hundreds of simultaneous objects.

### Difficulty

Integer 1–10.

## 3. Threat profile

Each simulated object should have a logical profile separate from its 3D model.

Example:

```json
{
  "id": "T01",
  "category": "unknown_aerial_object",
  "classification_label": "suspicious",
  "expected_response": "report",
  "spawn_time": 18.4,
  "speed_class": "medium",
  "visibility_class": "reduced"
}
```

These labels are training abstractions.

## 4. Seeded randomization

Each scenario should contain:

```json
{
  "scenario_id": "SCN-001",
  "seed": 483921,
  "generator_version": "1.0"
}
```

The seed allows the same scenario to be recreated for debugging.

## 5. Difficulty model

Difficulty can depend on:

```text
D = base
  + threat_count_factor
  + visibility_factor
  + sensor_factor
  + timing_factor
  + distraction_factor
```

Do not make difficulty a black box.

Every increase should have a reason.

## 6. Example generated scenario

```json
{
  "scenario_id": "SCN-104",
  "seed": 90321,
  "environment": "urban",
  "time_of_day": "night",
  "visibility": 0.55,
  "sensor_quality": 0.65,
  "difficulty": 6,
  "duration_seconds": 120,
  "threats": [
    {
      "id": "T01",
      "spawn_time": 12.4,
      "classification_label": "suspicious",
      "expected_response": "report"
    },
    {
      "id": "T02",
      "spawn_time": 48.7,
      "classification_label": "unknown",
      "expected_response": "track"
    }
  ]
}
```

## 7. Anti-repetition rules

The generator should avoid:

- same seed
- same threat count repeatedly
- same spawn positions repeatedly
- same sequence of events
- same environment for every session

It can enforce:

- cooldown on recently used configurations
- bounded randomization
- controlled difficulty variation

## 8. Scenario validation

Before a scenario is released to the trainee, validate:

- duration > 0
- threat ids unique
- spawn times inside scenario duration
- classification labels valid
- response labels valid
- difficulty inside 1–10
- sensor quality inside 0–1

Invalid scenarios must be rejected before gameplay.
