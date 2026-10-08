from pathlib import Path

import yaml

CONTRACT = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.yaml"

EXPECTED_PATHS = {
    "/api/v1/scenarios/generate",
    "/api/v1/sessions",
    "/api/v1/sessions/{session_id}/events",
    "/api/v1/sessions/{session_id}/complete",
    "/api/v1/sessions/{session_id}/aar",
    "/api/v1/trainees/{trainee_id}/performance",
    "/api/v1/training/recommend",
}

EXPECTED_SCHEMAS = {
    "ScenarioGenerateRequest",
    "Scenario",
    "ThreatProfile",
    "SessionCreateRequest",
    "SessionCreated",
    "EventCreateRequest",
    "EventCreated",
    "CompleteResponse",
    "ScoreResult",
    "TimingMetrics",
    "Mistake",
    "AAR",
    "PerformanceProfile",
    "RecommendRequest",
    "RecommendResponse",
}


def _spec() -> dict:
    assert CONTRACT.exists(), f"contract missing: {CONTRACT}"
    return yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))


def test_contract_is_openapi_3() -> None:
    spec = _spec()
    assert spec["openapi"].startswith("3.")
    assert spec["info"]["title"] == "AEROVIGIL API"


def test_contract_lists_all_v1_endpoints() -> None:
    spec = _spec()
    assert EXPECTED_PATHS <= set(spec["paths"])


def test_contract_defines_core_schemas() -> None:
    spec = _spec()
    assert EXPECTED_SCHEMAS <= set(spec["components"]["schemas"])
