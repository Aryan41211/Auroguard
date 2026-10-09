"""After Action Review HTTP route (GET /sessions/{session_id}/aar)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import (
    EventRow,
    ScenarioRow,
    ScoreRow,
    SessionRow,
    event_row_to_request,
)
from app.schemas.aar import AAR
from app.schemas.scoring import ScoreResult
from app.services.aar import build_aar
from app.services.aar_narrator import get_narrator

router = APIRouter(tags=["aar"])


@router.get("/sessions/{session_id}/aar", response_model=AAR)
def get_aar(session_id: str, db: Session = Depends(get_db)) -> AAR:
    session = db.get(SessionRow, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"unknown session_id: {session_id}")
    score_row = db.get(ScoreRow, session_id)
    if session.status != "completed" or score_row is None:
        raise HTTPException(status_code=404, detail=f"AAR not available for session: {session_id}")

    scenario_row = db.get(ScenarioRow, session.scenario_id)
    if scenario_row is None:
        raise HTTPException(status_code=404, detail=f"unknown scenario_id: {session.scenario_id}")

    event_rows = (
        db.query(EventRow)
        .filter(EventRow.session_id == session_id)
        .order_by(EventRow.timestamp_ms, EventRow.event_id)
        .all()
    )
    events = [event_row_to_request(row) for row in event_rows]
    score_result = ScoreResult(
        session_id=session_id,
        detection_score=score_row.detection_score,
        classification_score=score_row.classification_score,
        response_score=score_row.response_score,
        timing_score=score_row.timing_score,
        penalty=score_row.penalty,
        final_score=score_row.final_score,
        scoring_version=score_row.scoring_version,
    )
    return build_aar(
        session_id, scenario_row.to_schema(), events, score_result, get_narrator()
    )
