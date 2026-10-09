from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_generate_returns_contract_shaped_scenario() -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 6,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 2,
            "seed": 12345,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["seed"] == 12345
    assert body["scenario_id"] == "SCN-012345"
    assert body["generator_version"] == "1.0"
    assert body["difficulty"] == 6
    assert len(body["threats"]) == 2


def test_generate_is_deterministic_for_same_seed() -> None:
    payload = {
        "difficulty": 6,
        "environment": "urban",
        "time_of_day": "night",
        "threat_count": 2,
        "seed": 12345,
    }
    first = client.post("/api/v1/scenarios/generate", json=payload).json()
    second = client.post("/api/v1/scenarios/generate", json=payload).json()
    assert first == second


def test_generate_without_seed_returns_scenario() -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 6, "environment": "rural", "time_of_day": "day", "threat_count": 1},
    )
    assert response.status_code == 200
    assert response.json()["seed"] is not None


def test_generate_rejects_infeasible_configuration() -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 1,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 5,
        },
    )
    assert response.status_code == 422


def test_generate_rejects_invalid_threat_count() -> None:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 5, "environment": "urban", "time_of_day": "day", "threat_count": 4},
    )
    assert response.status_code == 422
