"""Pydantic models for the deterministic replay contract.

Source of truth: docs/api/openapi.yaml (ReplayResponse, ReplayEvent,
ReplayFrame, ReplayThreatState).

The replay payload is *server derived*: the backend replays the recorded
event log and publishes, for every moment in time, the authoritative
per-threat state. The client only renders it.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.events import EventType
from app.schemas.scenario import Scenario
from app.schemas.scoring import ScoreResult


class ReplayEvent(BaseModel):
    """A single recorded event, in recorded order."""

    event_id: str
    type: EventType
    timestamp_ms: int = Field(ge=0)
    threat_id: str | None = None
    payload: dict = Field(default_factory=dict)


class ReplayThreatState(BaseModel):
    """Authoritative state of one threat at a point in the replay."""

    threat_id: str
    stage: str = "pending"
    detected: bool = False
    classification: str | None = None
    response: str | None = None


class ReplayFrame(BaseModel):
    """One scrubber step: the state of the world at ``timestamp_ms``."""

    timestamp_ms: int = Field(ge=0)
    event_id: str
    event_type: EventType
    label: str
    threat_id: str | None = None
    threats: list[ReplayThreatState] = Field(default_factory=list)


class ReplayResponse(BaseModel):
    """Everything needed to replay a session deterministically."""

    session_id: str
    trainee_id: str
    scenario: Scenario
    events: list[ReplayEvent]
    frames: list[ReplayFrame]
    score: ScoreResult | None = None
    duration_ms: int = Field(ge=0)
