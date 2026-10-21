"""Deterministic replay HTTP route (GET /sessions/{session_id}/replay)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import EventRow, ScenarioRow, ScoreRow, SessionRow
from app.schemas.events import EventType
from app.schemas.replay import ReplayResponse
from app.schemas.scoring import ScoreResult
from app.services.replay import EventRecord, build_replay

router = APIRouter(tags=["replay"])


@router.get("/sessions/{session_id}/replay", response_model=ReplayResponse)
def get_replay(session_id: str, db: Session = Depends(get_db)) -> ReplayResponse:
    """Replay the recorded session deterministically.

    Works for completed and in-flight sessions; the score is attached only
    once the session has been scored.
    """
    session = db.get(SessionRow, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"unknown session_id: {session_id}")

    scenario_row = db.get(ScenarioRow, session.scenario_id)
    if scenario_row is None:
        raise HTTPException(
            status_code=404, detail=f"unknown scenario_id: {session.scenario_id}"
        )

    event_rows = (
        db.query(EventRow)
        .filter(EventRow.session_id == session_id)
        .order_by(EventRow.timestamp_ms, EventRow.event_id)
        .all()
    )
    records = [
        EventRecord(
            event_id=row.event_id,
            type=EventType(row.type),
            timestamp_ms=row.timestamp_ms,
            threat_id=row.threat_id,
            payload=json.loads(row.payload_json),
        )
        for row in event_rows
    ]

    score_row = db.get(ScoreRow, session_id)
    score_result = (
        ScoreResult(
            session_id=session_id,
            detection_score=score_row.detection_score,
            classification_score=score_row.classification_score,
            response_score=score_row.response_score,
            timing_score=score_row.timing_score,
            penalty=score_row.penalty,
            final_score=score_row.final_score,
            scoring_version=score_row.scoring_version,
        )
        if score_row is not None
        else None
    )

    return build_replay(
        session_id=session_id,
        trainee_id=session.trainee_id,
        scenario=scenario_row.to_schema(),
        events=records,
        score_result=score_result,
    )
