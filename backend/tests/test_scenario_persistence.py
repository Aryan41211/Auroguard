from __future__ import annotations

from app.db.models import ScenarioRow


def test_generate_persists_scenario(client, db_session) -> None:
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
    scenario_id = response.json()["scenario_id"]
    row = db_session.get(ScenarioRow, scenario_id)
    assert row is not None
    assert row.to_schema().model_dump(mode="json") == response.json()


def test_regenerate_same_seed_is_idempotent(client, db_session) -> None:
    payload = {
        "difficulty": 6,
        "environment": "urban",
        "time_of_day": "night",
        "threat_count": 2,
        "seed": 999,
    }
    client.post("/api/v1/scenarios/generate", json=payload)
    client.post("/api/v1/scenarios/generate", json=payload)
    count = db_session.query(ScenarioRow).filter(ScenarioRow.seed == 999).count()
    assert count == 1
