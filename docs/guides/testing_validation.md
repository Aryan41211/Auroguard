# AEROVIGIL — Testing and Validation

## 1. Testing layers

### Unit tests

Test:

- scenario generator
- scoring
- timing
- adaptive logic
- validation

### Integration tests

Test:

`API -> database -> scoring -> AAR`

### Simulator tests

Test:

- scenario loads
- threat appears
- UI transitions
- input works
- session ends

### End-to-end

Test:

`Start -> detect -> classify -> respond -> AAR`

## 2. Scenario tests

Given the same seed:

- generated scenario must match expected values

Given invalid configuration:

- generator must reject it

## 3. Scoring tests

Test all branches:

- correct detection
- missed threat
- false alarm
- correct classification
- wrong classification
- correct response
- wrong response
- fast response
- slow response

## 4. AAR tests

Verify:

- final score matches scoring engine
- every mistake is represented
- timeline is chronologically ordered
- recommendation is supported by metrics

## 5. Adaptive tests

Example:

Input:

```text
last scores = [94, 92, 93]
```

Expected:

```text
difficulty increases
```

Input:

```text
last scores = [55, 58]
```

Expected:

```text
difficulty decreases or remains capped by policy
```

## 6. Human usability test

Use a small internal test group.

Measure:

- time to understand controls
- confusion points
- missed UI signals
- completion rate

Do not claim military effectiveness from a student prototype test.

## 7. Performance test

Measure:

- frame rate
- scenario load time
- API latency
- memory use

## 8. Regression strategy

Whenever scoring changes:

- rerun scoring tests
- rerun AAR tests
- compare known scenario outputs

Scoring changes must be versioned.
