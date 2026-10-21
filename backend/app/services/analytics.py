"""Cohort condition aggregation for the analytics endpoint.

Pure functions over already-scored completed sessions. Inputs are plain
condition values plus the stored ScoreRow metrics, so the aggregation is
unit-testable without HTTP or a database. Output is rounded to two decimals,
matching the precision used by the scoring and adaptive services.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.schemas.analytics import (
    AnalyticsDimension,
    ConditionBucketMetrics,
    ConditionDimension,
    ConditionsAnalyticsResponse,
)

# Canonical display/iteration order for each condition dimension.
DIMENSION_ORDER: tuple[AnalyticsDimension, ...] = (
    "environment",
    "time_of_day",
    "visibility",
)

_BUCKET_ORDER: dict[AnalyticsDimension, tuple[str, ...]] = {
    "environment": ("urban", "rural"),
    "time_of_day": ("day", "night"),
    "visibility": ("clear", "reduced", "poor"),
}


@dataclass(frozen=True)
class CompletedSessionConditions:
    """One completed session: its scenario conditions and stored score."""

    environment: str
    time_of_day: str
    visibility: str
    final_score: float
    detection_score: float
    classification_score: float
    response_score: float
    timing_score: float


def _mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


def _bucket_sort_key(dimension: AnalyticsDimension, bucket: str) -> tuple[int, str]:
    order = _BUCKET_ORDER[dimension]
    try:
        return (order.index(bucket), bucket)
    except ValueError:
        return (len(order), bucket)


def _aggregate_dimension(
    sessions: list[CompletedSessionConditions], dimension: AnalyticsDimension
) -> ConditionDimension:
    grouped: dict[str, list[CompletedSessionConditions]] = {}
    for session in sessions:
        grouped.setdefault(getattr(session, dimension), []).append(session)

    buckets = [
        ConditionBucketMetrics(
            bucket=bucket,
            session_count=len(group),
            mean_final_score=_mean([s.final_score for s in group]),
            mean_detection_score=_mean([s.detection_score for s in group]),
            mean_classification_score=_mean([s.classification_score for s in group]),
            mean_response_score=_mean([s.response_score for s in group]),
            mean_timing_score=_mean([s.timing_score for s in group]),
        )
        for bucket, group in grouped.items()
    ]
    buckets.sort(key=lambda item: _bucket_sort_key(dimension, item.bucket))
    return ConditionDimension(dimension=dimension, buckets=buckets)


def build_condition_analytics(
    sessions: Iterable[CompletedSessionConditions],
) -> ConditionsAnalyticsResponse:
    """Aggregate completed sessions into per-condition bucket metrics."""
    rows = list(sessions)
    return ConditionsAnalyticsResponse(
        total_sessions=len(rows),
        dimensions=[_aggregate_dimension(rows, dimension) for dimension in DIMENSION_ORDER],
    )
