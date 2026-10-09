"""Pydantic models mirroring the frozen v1 session contract.

Source of truth: docs/api/openapi.yaml (SessionCreateRequest, SessionCreated,
CompleteResponse).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    trainee_id: str
    scenario_id: str


class SessionCreated(BaseModel):
    session_id: str
    status: Literal["active"] = "active"


class CompleteResponse(BaseModel):
    session_id: str
    detection_score: float = Field(ge=0, le=100)
    classification_score: float = Field(ge=0, le=100)
    response_score: float = Field(ge=0, le=100)
    timing_score: float = Field(ge=0, le=100)
    penalty: float = Field(ge=0)
    final_score: float = Field(ge=0, le=100)
    aar_available: bool
    scoring_version: int
