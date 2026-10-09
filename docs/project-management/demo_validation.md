# Aeroguard — Prototype Validation

## Goal

Validate the product as software, not as a claim of real-world operational effectiveness.

## Demonstration sequence

1. Start application.
2. Create/select trainee id.
3. Generate scenario.
4. Show scenario conditions.
5. Start simulation.
6. Detect simulated object.
7. Classify.
8. Select abstract response.
9. Introduce second object if enabled.
10. Complete session.
11. Show AAR.
12. Start another scenario.
13. Show changed randomized conditions.
14. Show performance history.
15. Show adaptive recommendation.

## Technical evidence to collect

Record:

- scenario seed
- scenario configuration
- session id
- event log
- final score
- AAR
- next recommendation

## Validation questions

Can the same seed reproduce the same scenario?

Can the same events reproduce the same score?

Can a missed threat be detected in the AAR?

Can performance be compared across sessions?

Can adaptive difficulty explain why it changed?

## Avoid unsupported claims

Do not claim:

- military-grade accuracy
- real battlefield readiness
- real-world interception performance
- clinically validated human performance
- operational effectiveness

unless independently validated by the appropriate authority.

The prototype should make the software architecture and training methodology demonstrable.
