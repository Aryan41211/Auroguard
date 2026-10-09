from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.aar import (
    AAR,
    Mistake,
    MistakeKind,
    PerformanceProfile,
    RecommendRequest,
    RecommendResponse,
    TimingMetrics,
)
from app.schemas.events import EventCreateRequest
from app.schemas.scoring import ScoreResult


def _score() -> ScoreResult:
    return ScoreResult(
        session_id="SES-0001", detection_score=30.0, classification_score=30.0,
        response_score=25.0, timing_score=15.0, penalty=0.0, final_score=100.0,
        scoring_version=1,
    )


def test_mistake_kind_matches_contract() -> None:
    assert {m.value for m in MistakeKind} == {
        "missed_threat", "false_alarm", "classification_error", "response_error",
    }


def test_aar_allows_empty_collections_and_none_timing() -> None:
    aar = AAR(
        session_id="SES-0001", scenario_id="SCN-000001", summary="s",
        scores=_score(), timing=TimingMetrics(), mistakes=[], strengths=[],
        weaknesses=[], recommendation="r",
        timeline=[EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=1, threat_id="T01")],
    )
    assert aar.timing.mean_total_decision_ms is None
    assert aar.timeline[0].type.value == "THREAT_DETECTED"


def test_mistake_requires_kind_and_timestamp() -> None:
    with pytest.raises(ValidationError):
        Mistake(kind="not_a_kind", timestamp_ms=0)


def test_mistake_requires_timestamp() -> None:
    with pytest.raises(ValidationError):
        Mistake(kind=MistakeKind.missed_threat)


def test_performance_profile_defaults_and_bounds() -> None:
    profile = PerformanceProfile(
        trainee_id="TRAIN-001", session_count=2,
        detection_accuracy=50.0, classification_accuracy=50.0, response_accuracy=50.0,
    )
    assert profile.current_level == 1
    assert profile.night_score is None
    with pytest.raises(ValidationError):
        PerformanceProfile(
            trainee_id="T", session_count=1,
            detection_accuracy=101.0, classification_accuracy=0.0, response_accuracy=0.0,
        )


def test_recommend_models() -> None:
    assert RecommendRequest(trainee_id="TRAIN-001").trainee_id == "TRAIN-001"
    response = RecommendResponse(
        recommended_difficulty=6, environment="urban", time_of_day="night",
        threat_count=3, reason="why",
    )
    assert response.environment.value == "urban"
    with pytest.raises(ValidationError):
        RecommendResponse(
            recommended_difficulty=11, environment="urban", time_of_day="night",
            threat_count=3, reason="why",
        )
    with pytest.raises(ValidationError):
        RecommendResponse(
            recommended_difficulty=5, environment="urban", time_of_day="night",
            threat_count=4, reason="why",
        )
