"""Scenario validation rules (docs/modules/scenario_engine.md section 8).

The Scenario model already constrains field ranges (difficulty 1-10,
sensor_quality 0-1, duration > 0). This validator re-checks those ranges
so it stays a complete guard even for scenarios built without Pydantic
validation, and adds the relational rules the schema cannot express.
"""

from __future__ import annotations

from app.schemas.scenario import Scenario
from app.services.scenario_generator import LABEL_TO_RESPONSE, compute_difficulty


class ScenarioValidationError(ValueError):
    """Raised when a scenario violates a validation rule."""


def validate_scenario(scenario: Scenario) -> None:
    if scenario.duration_seconds <= 0:
        raise ScenarioValidationError("duration_seconds must be > 0")

    if not 1 <= scenario.difficulty <= 10:
        raise ScenarioValidationError("difficulty must be inside 1-10")

    if not 0 <= scenario.sensor_quality <= 1:
        raise ScenarioValidationError("sensor_quality must be inside 0-1")

    if not scenario.threats:
        raise ScenarioValidationError("at least one threat is required")

    ids = [threat.id for threat in scenario.threats]
    if len(ids) != len(set(ids)):
        raise ScenarioValidationError("threat ids must be unique")

    for threat in scenario.threats:
        if not 0 <= threat.spawn_time < scenario.duration_seconds:
            raise ScenarioValidationError(
                f"spawn_time {threat.spawn_time} out of range for threat {threat.id}"
            )
        expected = LABEL_TO_RESPONSE[threat.classification_label]
        if threat.expected_response != expected:
            raise ScenarioValidationError(
                f"threat {threat.id} response {threat.expected_response.value} "
                f"does not match ground truth for "
                f"{threat.classification_label.value}"
            )

    computed = compute_difficulty(
        environment=scenario.environment,
        time_of_day=scenario.time_of_day,
        threat_count=len(scenario.threats),
        visibility=scenario.visibility,
        sensor_quality=scenario.sensor_quality,
        duration_seconds=scenario.duration_seconds,
    )
    if computed != scenario.difficulty:
        raise ScenarioValidationError(
            f"declared difficulty {scenario.difficulty} does not match computed {computed}"
        )
