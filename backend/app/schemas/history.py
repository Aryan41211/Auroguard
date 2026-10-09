"""Session history schemas for the instructor dashboard (GET /sessions).

List-shaped projection of the session, its scenario conditions and its stored
score. Read-only: the dashboard never scores; scores come from ScoreRow as
written by the server at session completion.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.scenario import Environment, TimeOfDay, Visibility


class SessionHistoryEntry(BaseModel):
    session_id: str
    trainee_id: str
    scenario_id: str
    status: Literal["active", "completed"]
    started_at: datetime
    completed_at: datetime | None = None
    # Scenario conditions (joined from ScenarioRow).
    seed: int
    difficulty: int
    environment: Environment
    time_of_day: TimeOfDay
    visibility: Visibility
    sensor_quality: float
    threat_count: int
    # Stored score (joined from ScoreRow); null while the session is active.
    final_score: float | None = None
    detection_score: float | None = None
    classification_score: float | None = None
    response_score: float | None = None
    timing_score: float | None = None
    penalty: float | None = None


class SessionHistoryResponse(BaseModel):
    sessions: list[SessionHistoryEntry]
