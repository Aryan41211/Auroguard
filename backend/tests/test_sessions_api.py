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


def test_event_ids_are_globally_unique_across_sessions(client) -> None:
    scenario_id = _create_scenario(client)
    first_session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    second_session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-002", "scenario_id": scenario_id},
    ).json()["session_id"]

    first_event = client.post(
        f"/api/v1/sessions/{first_session}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01"},
    )
    second_event = client.post(
        f"/api/v1/sessions/{second_session}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 2000, "threat_id": "T01"},
    )

    assert first_event.status_code == 201
    assert second_event.status_code == 201
    assert first_event.json() == {"event_id": "EVT-001", "accepted": True}
    assert second_event.json() == {"event_id": "EVT-002", "accepted": True}
    assert first_event.json()["event_id"] != second_event.json()["event_id"]


def _complete_flow(client, seed: int = 12345) -> str:
    scenario_id = _create_scenario(client, seed)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario_id},
    ).json()["session_id"]
    events = [
        {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": "T01"},
        {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 2000, "threat_id": "T01", "payload": {"label": "hostile"}},
        {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 3000, "threat_id": "T01", "payload": {"response": "hold"}},
    ]
    for event in events:
        assert client.post(f"/api/v1/sessions/{session_id}/events", json=event).status_code == 201
    return session_id


def test_complete_returns_server_side_score(client, db_session) -> None:
    from app.db.models import ScoreRow, SessionRow

    session_id = _complete_flow(client)
    response = client.post(f"/api/v1/sessions/{session_id}/complete")
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session_id
    assert body["aar_available"] is True
    assert body["scoring_version"] == 1
    assert 0 <= body["final_score"] <= 100

    row = db_session.get(ScoreRow, session_id)
    assert row is not None
    assert row.final_score == body["final_score"]
    assert db_session.get(SessionRow, session_id).status == "completed"


def test_complete_is_idempotent(client, db_session) -> None:
    from app.db.models import ScoreRow

    session_id = _complete_flow(client, seed=777)
    first = client.post(f"/api/v1/sessions/{session_id}/complete").json()
    second = client.post(f"/api/v1/sessions/{session_id}/complete").json()
    assert first == second
    assert db_session.query(ScoreRow).filter(ScoreRow.session_id == session_id).count() == 1


def test_complete_unknown_session_returns_404(client) -> None:
    response = client.post("/api/v1/sessions/SES-NOPE/complete")
    assert response.status_code == 404
    assert response.json()["detail"] == "unknown session_id: SES-NOPE"


def test_events_rejected_after_completion(client) -> None:
    session_id = _complete_flow(client, seed=888)
    client.post(f"/api/v1/sessions/{session_id}/complete")
    response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 5000, "threat_id": "T01"},
    )
    assert response.status_code == 422
