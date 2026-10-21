"""Deterministic session replay.

A pure function of (scenario, recorded events): the same event log always
produces the same replay. The replay is a list of *frames* — one per
recorded event — each carrying the authoritative state of every threat at
that moment. A client scrubs through the frames to watch the session again.

The server stays authoritative: clients render these frames, they never
recompute them.

Source of truth: docs/modules/replay.md.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.events import EventType
from app.schemas.replay import (
    ReplayEvent,
    ReplayFrame,
    ReplayResponse,
    ReplayThreatState,
)
from app.schemas.scenario import Scenario
from app.schemas.scoring import ScoreResult

STAGE_PENDING = "pending"
STAGE_SPAWNED = "spawned"
STAGE_DETECTED = "detected"
STAGE_CLASSIFIED = "classified"
STAGE_RESPONDED = "responded"
STAGE_MISSED = "missed"


@dataclass(frozen=True)
class EventRecord:
    """A recorded event with its stable identifier."""

    event_id: str
    type: EventType
    timestamp_ms: int
    threat_id: str | None = None
    payload: dict | None = None

    def to_schema(self) -> ReplayEvent:
        return ReplayEvent(
            event_id=self.event_id,
            type=self.type,
            timestamp_ms=self.timestamp_ms,
            threat_id=self.threat_id,
            payload=dict(self.payload or {}),
        )


def _label(event: EventRecord) -> str:
    """Human readable description of a single event (deterministic)."""
    threat = event.threat_id or "threat"
    payload = event.payload or {}
    if event.type == EventType.SESSION_STARTED:
        return "Session started"
    if event.type == EventType.SCENARIO_LOADED:
        return "Scenario loaded"
    if event.type == EventType.THREAT_SPAWNED:
        return f"{threat} appeared"
    if event.type == EventType.THREAT_DETECTED:
        return f"{threat} detected"
    if event.type == EventType.CLASSIFICATION_SUBMITTED:
        label = payload.get("label")
        return f"{threat} classified as {label}" if label else f"{threat} classified"
    if event.type == EventType.RESPONSE_SUBMITTED:
        response = payload.get("response")
        return f"{threat} response: {response}" if response else f"{threat} responded"
    if event.type == EventType.FALSE_ALARM:
        return "False alarm raised"
    if event.type == EventType.THREAT_MISSED:
        return f"{threat} missed"
    if event.type == EventType.THREAT_RESOLVED:
        return f"{threat} resolved"
    if event.type == EventType.SESSION_PAUSED:
        return "Session paused"
    if event.type == EventType.SESSION_RESUMED:
        return "Session resumed"
    if event.type == EventType.SESSION_COMPLETED:
        return "Session completed"
    return event.type.value


def _initial_states(scenario: Scenario) -> dict[str, ReplayThreatState]:
    return {
        threat.id: ReplayThreatState(threat_id=threat.id, stage=STAGE_PENDING)
        for threat in scenario.threats
    }


def _apply(
    states: dict[str, ReplayThreatState], event: EventRecord
) -> dict[str, ReplayThreatState]:
    """Return a new state map with ``event`` applied (no mutation)."""
    updated = dict(states)
    threat_id = event.threat_id
    payload = event.payload or {}
    if event.type == EventType.THREAT_SPAWNED and threat_id is not None:
        current = updated.get(threat_id)
        updated[threat_id] = ReplayThreatState(
            threat_id=threat_id,
            stage=STAGE_SPAWNED,
            detected=current.detected if current else False,
            classification=current.classification if current else None,
            response=current.response if current else None,
        )
    elif event.type == EventType.THREAT_DETECTED and threat_id is not None:
        current = updated.get(threat_id)
        updated[threat_id] = ReplayThreatState(
            threat_id=threat_id,
            stage=STAGE_DETECTED,
            detected=True,
            classification=current.classification if current else None,
            response=current.response if current else None,
        )
    elif event.type == EventType.CLASSIFICATION_SUBMITTED and threat_id is not None:
        current = updated.get(threat_id)
        updated[threat_id] = ReplayThreatState(
            threat_id=threat_id,
            stage=STAGE_CLASSIFIED,
            detected=current.detected if current else False,
            classification=str(payload.get("label")),
            response=current.response if current else None,
        )
    elif event.type == EventType.RESPONSE_SUBMITTED and threat_id is not None:
        current = updated.get(threat_id)
        updated[threat_id] = ReplayThreatState(
            threat_id=threat_id,
            stage=STAGE_RESPONDED,
            detected=current.detected if current else False,
            classification=current.classification if current else None,
            response=str(payload.get("response")),
        )
    elif event.type == EventType.THREAT_MISSED and threat_id is not None:
        current = updated.get(threat_id)
        updated[threat_id] = ReplayThreatState(
            threat_id=threat_id,
            stage=STAGE_MISSED,
            detected=current.detected if current else False,
            classification=current.classification if current else None,
            response=current.response if current else None,
        )
    return updated


def _ordered(events: list[EventRecord]) -> list[EventRecord]:
    """Chronological order, stable for identical timestamps."""
    return sorted(events, key=lambda event: (event.timestamp_ms, event.event_id))


def build_frames(
    scenario: Scenario, events: list[EventRecord]
) -> list[ReplayFrame]:
    """Build the scrubber frames for a recorded session."""
    states = _initial_states(scenario)
    frames: list[ReplayFrame] = []
    for event in _ordered(events):
        states = _apply(states, event)
        frames.append(
            ReplayFrame(
                timestamp_ms=event.timestamp_ms,
                event_id=event.event_id,
                event_type=event.type,
                label=_label(event),
                threat_id=event.threat_id,
                threats=[states[key] for key in sorted(states)],
            )
        )
    return frames


def build_replay(
    session_id: str,
    trainee_id: str,
    scenario: Scenario,
    events: list[EventRecord],
    score_result: ScoreResult | None = None,
) -> ReplayResponse:
    """Build the full replay payload for a session."""
    ordered = _ordered(events)
    frames = build_frames(scenario, events)
    duration_ms = ordered[-1].timestamp_ms if ordered else 0
    return ReplayResponse(
        session_id=session_id,
        trainee_id=trainee_id,
        scenario=scenario,
        events=[event.to_schema() for event in ordered],
        frames=frames,
        score=score_result,
        duration_ms=duration_ms,
    )


def state_at(
    scenario: Scenario, frames: list[ReplayFrame], timestamp_ms: int
) -> list[ReplayThreatState]:
    """Threat states at ``timestamp_ms`` (used by the scrubber)."""
    current = [
        ReplayThreatState(threat_id=threat.id, stage=STAGE_PENDING)
        for threat in sorted(scenario.threats, key=lambda t: t.id)
    ]
    for frame in frames:
        if frame.timestamp_ms > timestamp_ms:
            break
        current = list(frame.threats)
    return current
