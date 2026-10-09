# Aeroguard — Safety and Scope

## Purpose

Aeroguard is a simulated training and assessment system.

The engineering scope should remain focused on:

- recognition
- classification
- observation
- abstract response decisions
- performance assessment
- training adaptation

## Explicitly out of scope

Do not implement:

- weapon targeting
- weapon firing
- interception trajectories
- autonomous physical engagement
- real-world target coordinates
- guidance for defeating real counter-drone systems
- operational attack planning
- real physical drone control

## Why

The problem statement can be solved convincingly without these components.

The value of the prototype is the training loop:

`observe -> identify -> decide -> measure -> review -> improve`

## Data safety

Use synthetic trainee ids in the prototype.

Do not store sensitive personal information unless there is a clear requirement.

## Demonstration data

Use simulated scenarios and clearly label them as synthetic.

## Explainability

Scores and recommendations must be based on recorded simulator events, not opaque claims.

## AI policy for the prototype

AI should support:

- scenario generation
- adaptive difficulty
- performance analysis

AI should not be used to create operational engagement instructions.
