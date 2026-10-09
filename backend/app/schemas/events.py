"""Pydantic models mirroring the frozen v1 event contract.

Source of truth: docs/api/openapi.yaml (EventCreateRequest, EventCreated).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class EventType(str, Enum):
    SESSION_STARTED = "SESSION_STARTED"
    SCENARIO_LOADED = "SCENARIO_LOADED"
    THREAT_SPAWNED = "THREAT_SPAWNED"
    THREAT_DETECTED = "THREAT_DETECTED"
    CLASSIFICATION_SUBMITTED = "CLASSIFICATION_SUBMITTED"
    RESPONSE_SUBMITTED = "RESPONSE_SUBMITTED"
    FALSE_ALARM = "FALSE_ALARM"
    THREAT_MISSED = "THREAT_MISSED"
    THREAT_RESOLVED = "THREAT_RESOLVED"
    SESSION_PAUSED = "SESSION_PAUSED"
    SESSION_RESUMED = "SESSION_RESUMED"
    SESSION_COMPLETED = "SESSION_COMPLETED"


class EventCreateRequest(BaseModel):
    type: EventType
    timestamp_ms: int = Field(ge=0)
    threat_id: str | None = None
    payload: dict = Field(default_factory=dict)


class EventCreated(BaseModel):
    event_id: str
    accepted: bool
