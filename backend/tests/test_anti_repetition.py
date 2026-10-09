import random

from app.schemas.scenario import ScenarioGenerateRequest
from app.services.anti_repetition import (
    RecentConfigTracker,
    generate_with_anti_repetition,
)


def _request(**overrides) -> ScenarioGenerateRequest:
    base = dict(difficulty=6, environment="urban", time_of_day="night", threat_count=2)
    base.update(overrides)
    return ScenarioGenerateRequest(**base)


def test_pinned_seed_is_deterministic_and_recorded() -> None:
    tracker = RecentConfigTracker()
    first = generate_with_anti_repetition(_request(seed=12345), tracker)
    second = generate_with_anti_repetition(_request(seed=12345), tracker)
    assert first == second
    assert tracker.is_recent(first)


def test_unpinned_generation_returns_scenario_and_records_it() -> None:
    tracker = RecentConfigTracker()
    scenario = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(0)
    )
    assert len(scenario.threats) == 2
    assert tracker.is_recent(scenario)


def test_recent_configuration_is_avoided() -> None:
    tracker = RecentConfigTracker()
    first = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(1)
    )
    second = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(1)
    )
    assert second != first


def test_fallback_when_window_exhausted_still_returns_scenario() -> None:
    tracker = RecentConfigTracker(capacity=100)
    rng = random.Random(5)
    for _ in range(50):
        generate_with_anti_repetition(_request(), tracker, seed_source=rng)
    scenario = generate_with_anti_repetition(
        _request(), tracker, seed_source=rng, max_attempts=1
    )
    assert len(scenario.threats) == 2


def test_tracker_clear_empties_window() -> None:
    tracker = RecentConfigTracker()
    scenario = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(2)
    )
    assert tracker.is_recent(scenario)
    tracker.clear()
    assert not tracker.is_recent(scenario)
