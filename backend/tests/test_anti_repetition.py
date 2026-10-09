import random

from app.schemas.scenario import ScenarioGenerateRequest
from app.services.anti_repetition import (
    RecentConfigTracker,
    generate_with_anti_repetition,
)
from app.services.scenario_generator import generate_scenario


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
    assert RecentConfigTracker.signature(second) != RecentConfigTracker.signature(first)


def test_fallback_when_window_exhausted_still_returns_scenario() -> None:
    tracker = RecentConfigTracker(capacity=1)
    request = _request()
    rng_seed = 7
    first_seed = random.Random(rng_seed).randrange(1_000_000)
    recorded = generate_scenario(request, first_seed)
    tracker.record(recorded)

    scenario = generate_with_anti_repetition(
        request, tracker, seed_source=random.Random(rng_seed), max_attempts=1
    )

    # The single candidate collided with the recent window, so the bounded
    # fallback returned the last candidate instead of a fresh one.
    assert RecentConfigTracker.signature(scenario) == RecentConfigTracker.signature(recorded)
    assert tracker.is_recent(scenario)


def test_tracker_clear_empties_window() -> None:
    tracker = RecentConfigTracker()
    scenario = generate_with_anti_repetition(
        _request(), tracker, seed_source=random.Random(2)
    )
    assert tracker.is_recent(scenario)
    tracker.clear()
    assert not tracker.is_recent(scenario)
