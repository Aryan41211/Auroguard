# Aeroguard — Architecture Decision Record

## ADR-001 — Unity for simulation

### Decision

Use Unity for the desktop simulator.

### Reason

Unity provides mature 3D rendering, input, lighting, UI and future VR support.

### Rejected alternative

Building the 3D simulator entirely in Python.

Reason for rejection: unnecessary graphics complexity and weaker VR path.

---

## ADR-002 — FastAPI for backend

### Decision

Use Python + FastAPI.

### Reason

The team can rapidly build typed APIs and reuse Python for scenario generation, scoring and analytics.

---

## ADR-003 — SQLite for prototype

### Decision

Use SQLite.

### Reason

Local, simple, portable and sufficient for prototype sessions.

---

## ADR-004 — Rule-based adaptive difficulty first

### Decision

Start with explicit rules.

### Reason

The system needs explainability and there is no initial real training dataset.

ML can be evaluated later using generated session data.

---

## ADR-005 — Desktop first, VR later

### Decision

Desktop is the primary development target.

### Reason

The problem statement permits desktop or VR-capable simulation. Desktop development lowers hardware requirements and allows the team to validate the training loop first.

---

## ADR-006 — Event-based session recording

### Decision

Record important trainee actions as timestamped events.

### Reason

Events enable reproducible scoring, AAR timelines and future analytics.

---

## ADR-007 — Ground truth separated from presentation

### Decision

Threat truth lives in scenario data, not in the visible 3D model.

### Reason

This prevents graphics code from becoming the scoring authority and allows visual assets to change without changing training logic.
