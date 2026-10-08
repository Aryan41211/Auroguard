# AEROVIGIL — Troubleshooting

## Unity cannot reach FastAPI

Check:

```text
FastAPI running?
Correct host/port?
Firewall?
HTTP URL?
```

Use:

`http://127.0.0.1:8000/health`

## Scenario JSON fails to parse

Check:

- property names
- enum values
- null fields
- schema version

Log the raw response during development.

## Score differs between runs

Check:

- scenario seed
- event timestamps
- generator version
- scoring version
- floating-point timing assumptions

## AAR missing an event

Check:

1. Unity emitted event
2. HTTP request succeeded
3. backend validated event
4. database stored event
5. AAR queried correct session

## Unity scene becomes too slow

First reduce:

- object count
- texture resolution
- post-processing
- lighting complexity

Do not optimize prematurely.

## Adaptive system behaves strangely

Log:

```text
previous performance
selected weakness
rule triggered
new difficulty
reason
```

Adaptive behavior must be explainable.

## Backend code becomes hard to maintain

Check whether:

- routes contain business logic
- models contain scoring logic
- Unity is treated as the source of truth

Move logic into services.
