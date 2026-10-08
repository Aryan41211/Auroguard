# AEROVIGIL — Recommended Project Structure

```text
AEROVIGIL/
│
├── README.md
├── LICENSE
├── .gitignore
│
├── docs/
│   ├── start_here.md
│   ├── problem_and_scope.md
│   ├── product_requirements.md
│   ├── blueprint.md
│   ├── system_architecture.md
│   ├── scenario_engine.md
│   ├── scoring_engine.md
│   ├── event_and_data_model.md
│   ├── api_specification.md
│   ├── aar_and_adaptive_training.md
│   ├── unity_prototype.md
│   ├── fastapi_backend.md
│   ├── ui_ux.md
│   ├── testing_validation.md
│   ├── project_structure.md
│   ├── local_setup.md
│   ├── development_checklist.md
│   ├── safety_scope.md
│   ├── decisions.md
│   ├── first_vertical_slice.md
│   ├── ai_implementation.md
│   ├── build_order.md
│   ├── git_workflow.md
│   ├── demo_validation.md
│   └── troubleshooting.md
│
├── simulator/
│   └── UnityProject/
│
├── backend/
│   ├── app/
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
│
├── dashboard/
│   └── web/
│
├── data/
│   ├── scenarios/
│   └── fixtures/
│
└── scripts/
```

## Important

Do not create every directory before it is needed.

Start with:

```text
docs/
backend/
simulator/
```

Then grow the project as functionality is implemented.

## Separation

### simulator/

Only Unity-related code and assets.

### backend/

Scenario, scoring, storage, AAR and adaptive logic.

### dashboard/

Optional analytics UI.

### data/

Test fixtures and scenario definitions that are safe to distribute with the prototype.

### docs/

Engineering truth: requirements, architecture and decisions.
