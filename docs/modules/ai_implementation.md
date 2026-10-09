# AEROVIGIL — AI and Intelligence Layer

## 1. What "AI-enabled" means in this project

The strongest initial interpretation is adaptive intelligence rather than an unnecessarily large neural network.

Use three layers.

### Layer A — Procedural intelligence

Generate varied scenarios from constraints.

### Layer B — Adaptive intelligence

Adjust the next scenario according to measured performance.

### Layer C — Analytical intelligence

Identify recurring weaknesses and recommend training conditions.

## 2. Procedural scenario generation

Input:

```text
difficulty
environment
time
sensor quality
threat count
seed
```

Output:

```text
scenario manifest
```

The generator is deterministic for a given seed.

## 3. Adaptive difficulty

Start with rules.

Example:

```text
three strong sessions
    -> increase one difficulty dimension

repeated weak performance
    -> reduce one difficulty dimension

weak night performance
    -> increase probability of night practice
```

Do not change all dimensions at once.

## 4. Performance feature vector

A future model could use:

```text
detection_accuracy
classification_accuracy
response_accuracy
mean_detection_time
mean_response_time
false_alarm_rate
miss_rate
night_score
day_score
multi_threat_score
low_visibility_score
```

## 5. Future ML

Only after enough synthetic/validated data exists consider:

- difficulty prediction
- success probability prediction
- clustering of trainee weaknesses
- scenario recommendation

## 6. LLM usage

An LLM can optionally turn structured AAR metrics into a concise natural-language explanation.

Example input:

```json
{
  "classification_accuracy": 62,
  "night_score": 58,
  "multi_threat_score": 61
}
```

Possible output:

```text
The trainee's main weakness is classification during
low-visibility multi-threat sessions. Additional moderate
night scenarios are recommended before increasing difficulty.
```

The LLM should not be the source of score truth.

## 7. Principle

`Measured events -> deterministic metrics -> adaptive logic`

not:

`LLM -> decides whether trainee was correct`
