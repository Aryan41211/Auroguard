"""Scenario generation HTTP route (POST /scenarios/generate)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import ScenarioRow
from app.schemas.scenario import Scenario, ScenarioGenerateRequest
from app.services.anti_repetition import (
    RecentConfigTracker,
    generate_with_anti_repetition,
)
from app.services.scenario_generator import InfeasibleScenarioError
from app.services.scenario_validator import ScenarioValidationError, validate_scenario

router = APIRouter(tags=["scenarios"])


@router.post("/scenarios/generate", response_model=Scenario)
def generate_scenario_route(
    body: ScenarioGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> Scenario:
    tracker: RecentConfigTracker = request.app.state.recent_configs
    try:
        scenario = generate_with_anti_repetition(body, tracker)
        validate_scenario(scenario)
    except (InfeasibleScenarioError, ScenarioValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if db.get(ScenarioRow, scenario.scenario_id) is None:
        db.add(ScenarioRow.from_schema(scenario))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return scenario
