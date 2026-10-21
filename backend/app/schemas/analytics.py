"""Response schemas for cohort condition analytics.

    GET /api/v1/analytics/conditions

Read-only aggregates over completed sessions, bucketed by the scenario
conditions that the training loop already stores (environment, time of day,
visibility). Scores are the server-authoritative values written to ScoreRow at
session completion; this module never recomputes them.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

AnalyticsDimension = Literal["environment", "time_of_day", "visibility"]


class ConditionBucketMetrics(BaseModel):
    """Aggregate metrics for every completed session in one condition bucket."""

    bucket: str
    session_count: int
    mean_final_score: float
    mean_detection_score: float
    mean_classification_score: float
    mean_response_score: float
    mean_timing_score: float


class ConditionDimension(BaseModel):
    """All observed buckets for a single scenario condition."""

    dimension: AnalyticsDimension
    buckets: list[ConditionBucketMetrics]


class ConditionsAnalyticsResponse(BaseModel):
    total_sessions: int
    dimensions: list[ConditionDimension]
