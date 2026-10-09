"""Pydantic model mirroring the frozen v1 ScoreResult contract."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScoreResult(BaseModel):
    session_id: str
    detection_score: float
    classification_score: float
    response_score: float
    timing_score: float
    penalty: float
    final_score: float = Field(ge=0, le=100)
    scoring_version: int
