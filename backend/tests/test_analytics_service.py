"""Unit tests for the pure condition aggregation service."""

from __future__ import annotations

from app.services.analytics import CompletedSessionConditions, build_condition_analytics


def _session(
    environment: str = "urban",
    time_of_day: str = "day",
    visibility: str = "clear",
    final: float = 80.0,
    detection: float = 24.0,
    classification: float = 24.0,
    response: float = 20.0,
    timing: float = 12.0,
) -> CompletedSessionConditions:
    return CompletedSessionConditions(
        environment=environment,
        time_of_day=time_of_day,
        visibility=visibility,
        final_score=final,
        detection_score=detection,
        classification_score=classification,
        response_score=response,
        timing_score=timing,
    )


def _buckets(response, dimension: str) -> list:
    return next(d.buckets for d in response.dimensions if d.dimension == dimension)


def test_empty_input_returns_empty_dimensions() -> None:
    result = build_condition_analytics([])

    assert result.total_sessions == 0
    assert [d.dimension for d in result.dimensions] == [
        "environment",
        "time_of_day",
        "visibility",
    ]
    assert all(d.buckets == [] for d in result.dimensions)


def test_multiple_sessions_are_grouped_and_averaged() -> None:
    result = build_condition_analytics(
        [
            _session("urban", "day", "clear", 90.0, 27.0, 27.0, 22.5, 13.5),
            _session("urban", "night", "reduced", 80.0, 24.0, 24.0, 20.0, 12.0),
            _session("rural", "night", "poor", 70.0, 21.0, 21.0, 17.5, 10.5),
        ]
    )

    assert result.total_sessions == 3

    urban, rural = _buckets(result, "environment")
    assert urban.bucket == "urban"
    assert urban.session_count == 2
    assert urban.mean_final_score == 85.0
    assert urban.mean_detection_score == 25.5
    assert urban.mean_classification_score == 25.5
    assert urban.mean_response_score == 21.25
    assert urban.mean_timing_score == 12.75

    assert rural.session_count == 1
    assert rural.mean_final_score == 70.0
    assert rural.mean_timing_score == 10.5

    day, night = _buckets(result, "time_of_day")
    assert day.session_count == 1
    assert night.session_count == 2
    assert night.mean_final_score == 75.0

    clear, reduced, poor = _buckets(result, "visibility")
    assert [clear.bucket, reduced.bucket, poor.bucket] == ["clear", "reduced", "poor"]
    assert [clear.session_count, reduced.session_count, poor.session_count] == [1, 1, 1]


def test_means_are_rounded_to_two_decimals() -> None:
    result = build_condition_analytics(
        [
            _session("urban", "day", "clear", 90.0, 27.0, 27.0, 22.5, 13.5),
            _session("urban", "day", "clear", 81.11, 11.11, 12.22, 20.0, 11.11),
            _session("rural", "night", "poor", 70.0, 21.0, 21.0, 17.5, 10.5),
        ]
    )

    urban = _buckets(result, "environment")[0]
    assert urban.mean_final_score == 85.56  # (90 + 81.11) / 2 = 85.555
    assert urban.mean_detection_score == 19.05  # (27 + 11.11) / 2 = 19.055
    assert urban.mean_classification_score == 19.61
    assert urban.mean_response_score == 21.25
    assert urban.mean_timing_score == 12.3  # (13.5 + 11.11) / 2 = 12.305


def test_buckets_use_canonical_order_not_input_order() -> None:
    result = build_condition_analytics(
        [
            _session("rural", "night", "poor"),
            _session("urban", "day", "reduced"),
            _session("rural", "day", "clear"),
        ]
    )

    assert [b.bucket for b in _buckets(result, "environment")] == ["urban", "rural"]
    assert [b.bucket for b in _buckets(result, "time_of_day")] == ["day", "night"]
    assert [b.bucket for b in _buckets(result, "visibility")] == [
        "clear",
        "reduced",
        "poor",
    ]
