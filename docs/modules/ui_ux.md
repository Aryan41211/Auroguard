# Aeroguard — UI/UX Specification

## 1. Design objective

The interface should feel like a training instrument, not a conventional action game.

Prioritize:

- clarity
- low cognitive overhead
- readable status
- obvious state transitions
- useful feedback

## 2. Main menu

```text
Aeroguard

[ Start Training ]
[ Scenario Library ]
[ Performance ]
[ Settings ]
[ Exit ]
```

## 3. Scenario setup

Fields:

- environment
- time
- visibility
- difficulty
- threat count

For later instructor mode:

- randomization toggle
- duration
- scenario seed

## 4. Simulation HUD

Display only information useful to the trainee.

Example:

```text
TIME 00:43
THREATS 2
SENSOR 72%
STATUS ACTIVE
```

Avoid exposing ground truth.

## 5. Classification

Present clear mutually exclusive options.

Do not show the correct answer until the relevant decision is complete.

## 6. Response

Use abstract training response categories.

Example:

- Monitor
- Track
- Report/Escalate
- Hold

The prototype should not provide real-world engagement instructions.

## 7. AAR

Use a hierarchy:

1. final score
2. key metrics
3. errors
4. timeline
5. recommendation

## 8. Accessibility

Support:

- readable font size
- high contrast
- keyboard navigation where practical
- non-color-only status indicators

## 9. UI state machine

```text
MENU
  -> SETUP
  -> LOADING
  -> SIMULATION
  -> CLASSIFICATION
  -> RESPONSE
  -> AAR
  -> MENU
```

Prevent invalid transitions.
