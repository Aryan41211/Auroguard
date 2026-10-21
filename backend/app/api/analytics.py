"""Cohort analytics HTTP routes.

    GET /analytics/conditions

Thin route: it joins completed sessions to their scenario conditions and
stored score, then delegates all grouping and averaging to the pure
services.analytics functions.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ScenarioRow, ScoreRow, SessionRow
from app.schemas.analytics import ConditionsAnalyticsResponse
from app.services.analytics import CompletedSessionConditions, build_condition_analytics

router = APIRouter(tags=["analytics"])


@router.get("/analytics/conditions", response_model=ConditionsAnalyticsResponse)
def get_condition_analytics(
    trainee_id: str | None = None, db: Session = Depends(get_db)
) -> ConditionsAnalyticsResponse:
    """Aggregate completed-session scores by environment, time of day and visibility.

    ``trainee_id`` optionally narrows the cohort to one trainee. Sessions
    without a stored score (active, or never completed) are excluded.
    """
    query = (
        db.query(SessionRow, ScenarioRow, ScoreRow)
        .join(ScenarioRow, ScenarioRow.scenario_id == SessionRow.scenario_id)
        .join(ScoreRow, ScoreRow.session_id == SessionRow.session_id)
        .filter(SessionRow.status == "completed")
    )
    if trainee_id is not None:
        query = query.filter(SessionRow.trainee_id == trainee_id)

    sessions = [
        CompletedSessionConditions(
            environment=scenario.environment,
            time_of_day=scenario.time_of_day,
            visibility=scenario.visibility,
            final_score=score.final_score,
            detection_score=score.detection_score,
            classification_score=score.classification_score,
            response_score=score.response_score,
            timing_score=score.timing_score,
        )
        for _, scenario, score in query.all()
    ]
    return build_condition_analytics(sessions)
