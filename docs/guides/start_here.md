# Aeroguard — Start Here

## Purpose

Aeroguard is a desktop-first, VR-ready software training simulator for practicing drone-threat recognition, classification, decision-making, and performance improvement in controlled virtual scenarios.

This document is the starting point for the engineering work.

## The core product

The system is not a real counter-drone controller and does not control physical drones or weapons.

The prototype creates a repeatable virtual training loop:

1. Generate a training scenario.
2. Present a simulated environment to the trainee.
3. Introduce one or more simulated aerial objects.
4. Let the trainee detect and classify the object.
5. Let the trainee select an abstract training response such as monitor, track, report/escalate, or hold.
6. Record every relevant event with timestamps.
7. Score the session against scenario ground truth.
8. Produce an After Action Review (AAR).
9. Use the performance profile to select or generate the next appropriate scenario.

## Recommended implementation

### Frontend / simulator

- Unity
- C#
- Desktop keyboard/mouse first
- Unity UI Toolkit or Canvas UI
- Optional Unity XR support later

### Backend

- Python
- FastAPI
- Pydantic
- SQLite
- SQLAlchemy or SQLModel
- pytest

### Optional analytics dashboard

- React + Vite
- TypeScript
- Recharts or another simple chart library

The dashboard is not required for the first vertical slice. A Unity AAR screen can prove the concept first.

## Build philosophy

Build a thin vertical slice before adding features.

The first working slice should contain:

`Scenario -> Simulation -> Detect -> Classify -> Response -> Score -> AAR`

Do not begin by creating a large repository or a photorealistic world.

## Repository rule

Keep the architecture modular enough that the simulator can later be connected to a web dashboard and VR interface without rewriting the scenario/scoring logic.

## Safety boundary

The project is a training and assessment simulator. Keep response choices abstract and training-oriented. Do not implement real-world weapon targeting, interception instructions, attack optimization, or autonomous physical engagement.

## First engineering milestone

A trainee should be able to launch one scenario, see one simulated threat, make three decisions, finish the session, and receive a reproducible score and AAR.
