from __future__ import annotations


def _create_scenario(client, seed: int = 12345) -> str:
    response = client.post(
        "/api/v1/scenarios/generate",
        json={
            "difficulty": 6,
            "environment": "urban",
            "time_of_day": "night",
            "threat_count": 2,
            "seed": seed,
        },
    )
    assert response.status_code == 200
    return response.json()["scenario_id"]


def test_create_session_returns_active_session(client) -> None:
    scenario_id = _create_scenario(client)
    response = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["session_id"].startswith("SES-")
    assert body["status"] == "active"


def test_create_session_unknown_scenario_returns_404(client) -> None:
    response = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": "SCN-DOESNOTEXIST"},
    )
    assert response.status_code == 404


def test_create_session_invalid_body_returns_422(client) -> None:
    response = client.post("/api/v1/sessions", json={"trainee_id": "TRAIN-001"})
    assert response.status_code == 422


def test_submit_event_returns_event_id(client) -> None:
    scenario_id = _create_scenario(client)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01"},
    )
    assert response.status_code == 201
    assert response.json() == {"event_id": "EVT-001", "accepted": True}


def test_submit_event_unknown_session_returns_404(client) -> None:
    response = client.post(
        "/api/v1/sessions/SES-NOPE/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "unknown session_id: SES-NOPE"


def test_submit_event_unknown_threat_returns_422(client) -> None:
    scenario_id = _create_scenario(client)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T99"},
    )
    assert response.status_code == 422


def test_submit_event_invalid_type_returns_422(client) -> None:
    scenario_id = _create_scenario(client)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "NOT_A_TYPE", "timestamp_ms": 1000},
    )
    assert response.status_code == 422
