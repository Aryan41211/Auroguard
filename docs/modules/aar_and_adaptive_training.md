# Aeroguard — AAR and Adaptive Training

## 1. After Action Review

AAR is not just a score page.

It should explain:

1. what happened
2. what the trainee did
3. what was correct
4. what was incorrect
5. where time was lost
6. what the trainee should practice next

## 2. AAR structure

### Session header

- scenario
- environment
- difficulty
- duration

### Performance

- final score
- detection accuracy
- classification accuracy
- response accuracy
- average response time

### Errors

- missed threats
- false alarms
- incorrect classifications
- incorrect responses

### Timeline

Show event sequence with timestamps.

### Recommendation

One or two clear training recommendations.

## 3. Weakness detection

Calculate performance by dimension.

Example:

```text
Overall: 88
Day: 93
Night: 74
Single threat: 95
Multi-threat: 68
```

The system should identify multi-threat and night performance as weaker dimensions.

## 4. Adaptive difficulty

Start simple.

Use rule-based adaptation rather than machine learning.

Example:

```text
if score >= 90 for last 3 sessions:
    increase difficulty by 1

elif score < 60 for last 2 sessions:
    decrease difficulty by 1

else:
    maintain difficulty
```

Add condition-specific adaptation:

```text
if night_score < overall_score - 15:
    increase probability of night scenarios
```

## 5. Recommendation algorithm

A recommendation should have:

- condition
- evidence
- recommended scenario
- expected training purpose

Example:

```text
Weakness:
Night classification

Evidence:
Night classification accuracy = 61%

Recommendation:
Generate another night scenario with moderate visibility and 2–3 threats.

Reason:
Provide additional repetitions under the weak condition without increasing every difficulty dimension at once.
```

## 6. Avoid over-adaptation

Do not immediately increase every difficulty variable.

If the trainee struggles with night conditions, change night/visibility first.

This makes training recommendations interpretable.

## 7. Future ML option

After enough simulated sessions, a model could estimate:

`P(success | scenario conditions, trainee profile)`

But this is not required for the MVP.

Rule-based adaptation is easier to validate and explain.
