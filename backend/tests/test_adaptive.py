from __future__ import annotations

from app.services.adaptive import (
    RecommendInput,
    SessionSummary,
    aggregate_performance,
    build_recommendation,
    clamp_level,
    decide_difficulty_delta,
)


def _summary(final=80.0, detection=24.0, classification=24.0, response=20.0,
             time_of_day="day", visibility="clear", threat_count=1, reaction=2000.0,
             environment="urban") -> SessionSummary:
    return SessionSummary(
        final_score=final, detection_score=detection, classification_score=classification,
        response_score=response, environment=environment, time_of_day=time_of_day,
        visibility=visibility, threat_count=threat_count, average_reaction_ms=reaction,
    )


def test_decide_difficulty_delta_rules() -> None:
    assert decide_difficulty_delta([94, 92, 93]) == 1
    assert decide_difficulty_delta([55, 58]) == -1
    assert decide_difficulty_delta([70, 80, 75]) == 0
    assert decide_difficulty_delta([95, 96]) == 0  # not enough history for +1


def test_clamp_level() -> None:
    assert clamp_level(0) == 1
    assert clamp_level(11) == 10
    assert clamp_level(5) == 5


def test_aggregate_performance() -> None:
    sessions = [
        _summary(final=100.0, detection=30.0, classification=30.0, response=25.0, time_of_day="day"),
        _summary(final=60.0, detection=30.0, classification=0.0, response=0.0,
                 time_of_day="night", visibility="reduced", threat_count=3, reaction=4000.0),
    ]
    profile = aggregate_performance("TRAIN-001", sessions, current_level=4)
    assert profile.session_count == 2
    assert profile.detection_accuracy == 100.0
    assert profile.classification_accuracy == 50.0
    assert profile.response_accuracy == 50.0
    assert profile.day_score == 100.0
    assert profile.night_score == 60.0
    assert profile.multi_threat_score == 60.0
    assert profile.low_visibility_score == 60.0
    assert profile.average_reaction_time_ms == 3000.0
    assert profile.current_level == 4


def test_aggregate_performance_empty() -> None:
    profile = aggregate_performance("TRAIN-X", [], current_level=2)
    assert profile.session_count == 0
    assert profile.detection_accuracy == 0.0
    assert profile.night_score is None


def _input(**overrides) -> RecommendInput:
    base = dict(
        recent_final_scores=[80.0, 80.0, 80.0], overall_score=80.0, night_score=None,
        multi_threat_score=None, last_environment="urban", last_time_of_day="day",
        last_threat_count=2, current_level=3,
    )
    base.update(overrides)
    return RecommendInput(**base)


def test_recommend_increases_after_three_strong_sessions() -> None:
    result = build_recommendation(_input(recent_final_scores=[94, 92, 93], overall_score=93.0))
    assert result.recommended_difficulty == 4
    assert "increasing" in result.reason.lower()
    assert result.time_of_day.value == "day"


def test_recommend_decreases_after_two_weak_sessions() -> None:
    result = build_recommendation(_input(recent_final_scores=[55, 58], overall_score=56.5))
    assert result.recommended_difficulty == 2
    assert "decreasing" in result.reason.lower()


def test_recommend_targets_night_without_raising_difficulty() -> None:
    result = build_recommendation(_input(night_score=60.0, overall_score=85.0, current_level=5))
    assert result.time_of_day.value == "night"
    assert result.recommended_difficulty == 5  # no over-adaptation
    assert "night" in result.reason.lower()


def test_recommend_targets_multi_threat() -> None:
    result = build_recommendation(
        _input(multi_threat_score=60.0, overall_score=85.0, last_threat_count=1, current_level=5)
    )
    assert result.threat_count == 3
    assert result.recommended_difficulty == 5


def test_recommend_empty_history_defaults() -> None:
    result = build_recommendation(
        _input(recent_final_scores=[], overall_score=None, current_level=1)
    )
    assert result.recommended_difficulty == 1
    assert "no completed sessions" in result.reason.lower()
