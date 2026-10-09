from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.events import EventCreateRequest, EventCreated, EventType

CONTRACT_TYPES = {
    "SESSION_STARTED",
    "SCENARIO_LOADED",
    "THREAT_SPAWNED",
    "THREAT_DETECTED",
    "CLASSIFICATION_SUBMITTED",
    "RESPONSE_SUBMITTED",
    "FALSE_ALARM",
    "THREAT_MISSED",
    "THREAT_RESOLVED",
    "SESSION_PAUSED",
    "SESSION_RESUMED",
    "SESSION_COMPLETED",
}


def test_event_type_has_all_contract_values() -> None:
    assert {member.value for member in EventType} == CONTRACT_TYPES


def test_event_create_accepts_valid_payload() -> None:
    event = EventCreateRequest(
        type="CLASSIFICATION_SUBMITTED",
        timestamp_ms=2000,
        threat_id="T01",
        payload={"label": "hostile"},
    )
    assert event.type is EventType.CLASSIFICATION_SUBMITTED
    assert event.payload == {"label": "hostile"}


def test_event_create_defaults_payload_and_threat_id() -> None:
    event = EventCreateRequest(type="SESSION_STARTED", timestamp_ms=0)
    assert event.threat_id is None
    assert event.payload == {}


def test_event_create_rejects_unknown_type() -> None:
    with pytest.raises(ValidationError):
        EventCreateRequest(type="NOT_A_TYPE", timestamp_ms=0)


def test_event_create_rejects_negative_timestamp() -> None:
    with pytest.raises(ValidationError):
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=-1)


def test_event_created_shape() -> None:
    created = EventCreated(event_id="EVT-001", accepted=True)
    assert created.event_id == "EVT-001"
    assert created.accepted is True