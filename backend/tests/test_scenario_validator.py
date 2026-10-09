import pytest

from app.schemas.scenario import ExpectedResponse, ScenarioGenerateRequest
from app.services.scenario_generator import generate_scenario
from app.services.scenario_validator import ScenarioValidationError, validate_scenario


def _valid_scenario():
    request = ScenarioGenerateRequest(
        difficulty=6, environment="urban", time_of_day="night", threat_count=2
    )
    return generate_scenario(request, 12345)


def test_valid_generated_scenario_passes() -> None:
    validate_scenario(_valid_scenario())


def test_duplicate_threat_ids_rejected() -> None:
    scenario = _valid_scenario()
    scenario.threats[1].id = scenario.threats[0].id
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_empty_threats_rejected() -> None:
    scenario = _valid_scenario()
    scenario.threats = []
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_spawn_time_outside_duration_rejected() -> None:
    scenario = _valid_scenario()
    scenario.threats[0].spawn_time = scenario.duration_seconds + 1
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_response_mismatch_rejected() -> None:
    scenario = _valid_scenario()
    current = scenario.threats[0].expected_response
    scenario.threats[0].expected_response = next(
        response for response in ExpectedResponse if response != current
    )
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_declared_difficulty_mismatch_rejected() -> None:
    scenario = _valid_scenario()
    scenario.difficulty = scenario.difficulty + 1
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_sensor_quality_out_of_range_rejected() -> None:
    scenario = _valid_scenario()
    scenario.sensor_quality = 1.5
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_difficulty_out_of_range_rejected() -> None:
    scenario = _valid_scenario()
    scenario.difficulty = 0
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)


def test_non_positive_duration_rejected() -> None:
    scenario = _valid_scenario()
    scenario.duration_seconds = 0
    with pytest.raises(ScenarioValidationError):
        validate_scenario(scenario)
