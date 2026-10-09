"""Scenario generation HTTP route (POST /scenarios/generate)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

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
    body: ScenarioGenerateRequest, request: Request
) -> Scenario:
    tracker: RecentConfigTracker = request.app.state.recent_configs
    try:
        scenario = generate_with_anti_repetition(body, tracker)
        validate_scenario(scenario)
    except (InfeasibleScenarioError, ScenarioValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return scenario
