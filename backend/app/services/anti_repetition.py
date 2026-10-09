"""Anti-repetition wrapper around the deterministic generator.

The generator stays a pure function of (request, seed) (NFR-01).
Anti-repetition lives here: when the caller pins a seed it is honoured
exactly; otherwise fresh seeds are re-rolled until the produced
configuration is outside the recent window.
"""

from __future__ import annotations

import random
from collections import deque

from app.schemas.scenario import Scenario, ScenarioGenerateRequest
from app.services.scenario_generator import generate_scenario

DEFAULT_CAPACITY = 10
DEFAULT_MAX_ATTEMPTS = 25
_SEED_UPPER_BOUND = 1_000_000


class RecentConfigTracker:
    """Bounded memory of recently generated configuration signatures."""

    def __init__(self, capacity: int = DEFAULT_CAPACITY) -> None:
        self._recent: deque[tuple] = deque(maxlen=capacity)

    @staticmethod
    def signature(scenario: Scenario) -> tuple:
        return (
            scenario.environment.value,
            scenario.time_of_day.value,
            len(scenario.threats),
            scenario.visibility.value,
            scenario.sensor_quality,
            scenario.duration_seconds,
            tuple(t.classification_label.value for t in scenario.threats),
        )

    def is_recent(self, scenario: Scenario) -> bool:
        return self.signature(scenario) in self._recent

    def record(self, scenario: Scenario) -> None:
        self._recent.append(self.signature(scenario))

    def clear(self) -> None:
        self._recent.clear()


def _fresh_seed(rng: random.Random) -> int:
    return rng.randrange(_SEED_UPPER_BOUND)


def generate_with_anti_repetition(
    request: ScenarioGenerateRequest,
    tracker: RecentConfigTracker,
    *,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    seed_source: random.Random | None = None,
) -> Scenario:
    if request.seed is not None:
        scenario = generate_scenario(request, request.seed)
        tracker.record(scenario)
        return scenario

    rng = seed_source or random.Random()
    last: Scenario | None = None
    for _ in range(max(1, max_attempts)):
        last = generate_scenario(request, _fresh_seed(rng))
        if not tracker.is_recent(last):
            tracker.record(last)
            return last

    assert last is not None  # the loop runs at least once
    tracker.record(last)
    return last
