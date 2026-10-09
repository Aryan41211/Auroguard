from __future__ import annotations

from app.schemas.events import EventCreateRequest
from app.schemas.scenario import Scenario
from app.services.scoring import SCORING_VERSION, score, timing_points


def _scenario() -> Scenario:
    return Scenario(
        scenario_id="SCN-000001",
        seed=1,
        generator_version="1.0",
        difficulty=3,
        environment="rural",
        time_of_day="day",
        visibility="clear",
        sensor_quality=0.9,
        duration_seconds=120.0,
        threats=[
            {
                "id": "T01",
                "classification_label": "hostile",
                "expected_response": "hold",
                "spawn_time": 10.0,
            }
        ],
    )


def test_timing_points_curve() -> None:
    assert timing_points(0) == 15
    assert timing_points(3000) == 15
    assert timing_points(3001) == 10
    assert timing_points(6000) == 10
    assert timing_points(6001) == 5
    assert timing_points(9000) == 5
    assert timing_points(9001) == 0


def test_perfect_session_scores_100() -> None:
    events = [
        EventCreateRequest(type="THREAT_DETECTED", timestamp_ms=1000, threat_id="T01"),
        EventCreateRequest(
            type="CLASSIFICATION_SUBMITTED",
            timestamp_ms=2000,
            threat_id="T01",
            payload={"label": "hostile"},
        ),
        EventCreateRequest(
            type="RESPONSE_SUBMITTED",
            timestamp_ms=3000,
            threat_id="T01",
            payload={"response": "hold"},
        ),
    ]
    result = score("SES-TEST", _scenario(), events)
    assert result.final_score == 100.0
    assert result.scoring_version == SCORING_VERSION == 1


def test_score_is_pure_and_clamped_at_zero() -> None:
    events = [EventCreateRequest(type="FALSE_ALARM", timestamp_ms=100, payload={})]
    first = score("SES-TEST", _scenario(), events)
    second = score("SES-TEST", _scenario(), events)
    assert first == second
    assert first.detection_score == 0.0
    assert first.penalty == 5.0
    assert first.final_score == 0.0
