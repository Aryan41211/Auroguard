"""Session lifecycle HTTP routes: create, record events, complete."""

from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import EventRow, ScenarioRow, SessionRow
from app.schemas.events import EventCreateRequest, EventCreated
from app.schemas.session import SessionCreateRequest, SessionCreated

router = APIRouter(tags=["sessions"])


def _new_session_id() -> str:
    return f"SES-{uuid.uuid4().hex[:8].upper()}"


def _threat_ids(scenario: ScenarioRow) -> set[str]:
    return {threat["id"] for threat in json.loads(scenario.threats_json)}


@router.post("/sessions", response_model=SessionCreated, status_code=201)
def create_session(
    body: SessionCreateRequest, db: Session = Depends(get_db)
) -> SessionCreated:
    scenario = db.get(ScenarioRow, body.scenario_id)
    if scenario is None:
        raise HTTPException(
            status_code=404, detail=f"unknown scenario_id: {body.scenario_id}"
        )
    session = SessionRow(
        session_id=_new_session_id(),
        trainee_id=body.trainee_id,
        scenario_id=body.scenario_id,
        status="active",
    )
    db.add(session)
    db.commit()
    return SessionCreated(session_id=session.session_id, status="active")


@router.post(
    "/sessions/{session_id}/events", response_model=EventCreated, status_code=201
)
def submit_event(
    session_id: str, body: EventCreateRequest, db: Session = Depends(get_db)
) -> EventCreated:
    session = db.get(SessionRow, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"unknown session_id: {session_id}")
    if session.status == "completed":
        raise HTTPException(status_code=422, detail="session already completed")

    if body.threat_id is not None:
        scenario = db.get(ScenarioRow, session.scenario_id)
        if scenario is None or body.threat_id not in _threat_ids(scenario):
            raise HTTPException(
                status_code=422, detail=f"unknown threat_id: {body.threat_id}"
            )

    count = (
        db.query(EventRow).filter(EventRow.session_id == session_id).count()
    )
    event = EventRow(
        event_id=f"EVT-{count + 1:03d}",
        session_id=session_id,
        timestamp_ms=body.timestamp_ms,
        type=body.type.value,
        threat_id=body.threat_id,
        payload_json=json.dumps(body.payload),
    )
    db.add(event)
    db.commit()
    return EventCreated(event_id=event.event_id, accepted=True)
