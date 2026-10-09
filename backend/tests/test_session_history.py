"""GET /sessions session history listing (Phase 6 instructor dashboard)."""

from __future__ import annotations

from datetime import datetime

from app.db.models import SessionRow


def _create_session(client, scenario_body, trainee_id="TRAIN-H1"):
    scenario = client.post("/api/v1/scenarios/generate", json=scenario_body).json()
    created = client.post(
        "/api/v1/sessions",
        json={"trainee_id": trainee_id, "scenario_id": scenario["scenario_id"]},
    ).json()
    return scenario, created["session_id"]


def _complete_with_events(client, session_id, scenario):
    client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={"type": "SESSION_STARTED", "timestamp_ms": 0},
    )
    t = 500
    for threat in scenario["threats"]:
        client.post(
            f"/api/v1/sessions/{session_id}/events",
            json={
                "type": "THREAT_DETECTED",
                "timestamp_ms": t,
                "threat_id": threat["id"],
            },
        )
        client.post(
            f"/api/v1/sessions/{session_id}/events",
            json={
                "type": "CLASSIFICATION_SUBMITTED",
                "timestamp_ms": t + 800,
                "threat_id": threat["id"],
                "payload": {"label": threat["classification_label"]},
            },
        )
        client.post(
            f"/api/v1/sessions/{session_id}/events",
            json={
                "type": "RESPONSE_SUBMITTED",
                "timestamp_ms": t + 1500,
                "threat_id": threat["id"],
                "payload": {"response": threat["expected_response"]},
            },
        )
        t += 2000
    return client.post(f"/api/v1/sessions/{session_id}/complete").json()


_BODY = {
    "difficulty": 3,
    "environment": "urban",
    "time_of_day": "day",
    "threat_count": 1,
    "seed": 424242,
}


def test_history_empty_without_sessions(client):
    body = client.get("/api/v1/sessions").json()
    assert body == {"sessions": []}


def test_history_lists_completed_session_with_conditions_and_scores(client):
    scenario, session_id = _create_session(client, _BODY)
    result = _complete_with_events(client, session_id, scenario)

    body = client.get("/api/v1/sessions").json()
    assert len(body["sessions"]) == 1
    entry = body["sessions"][0]
    assert entry["session_id"] == session_id
    assert entry["trainee_id"] == "TRAIN-H1"
    assert entry["status"] == "completed"
    assert entry["completed_at"] is not None
    assert entry["seed"] == 424242
    assert entry["difficulty"] == 3
    assert entry["environment"] == "urban"
    assert entry["time_of_day"] == "day"
    assert entry["threat_count"] == 1
    assert 0 <= entry["sensor_quality"] <= 1
    assert entry["final_score"] == result["final_score"]
    assert entry["detection_score"] == result["detection_score"]
    assert entry["classification_score"] == result["classification_score"]
    assert entry["response_score"] == result["response_score"]
    assert entry["timing_score"] == result["timing_score"]
    assert entry["penalty"] == result["penalty"]


def test_history_active_session_has_null_scores(client):
    _, session_id = _create_session(client, _BODY)
    entry = client.get("/api/v1/sessions").json()["sessions"][0]
    assert entry["session_id"] == session_id
    assert entry["status"] == "active"
    assert entry["completed_at"] is None
    assert entry["final_score"] is None
    assert entry["detection_score"] is None


def test_history_filters_by_trainee(client):
    _, first = _create_session(client, _BODY, trainee_id="TRAIN-AAA")
    _, second = _create_session(client, _BODY, trainee_id="TRAIN-BBB")

    all_sessions = client.get("/api/v1/sessions").json()["sessions"]
    assert {s["trainee_id"] for s in all_sessions} == {"TRAIN-AAA", "TRAIN-BBB"}

    filtered = client.get(
        "/api/v1/sessions", params={"trainee_id": "TRAIN-AAA"}
    ).json()["sessions"]
    assert [s["session_id"] for s in filtered] == [first]
    assert second not in [s["session_id"] for s in filtered]


def test_history_orders_newest_first(client, db_session):
    _, first = _create_session(client, {**_BODY, "seed": 111})
    _, second = _create_session(client, {**_BODY, "seed": 222})

    db_session.get(SessionRow, first).started_at = datetime(2026, 1, 1, 12, 0, 0)
    db_session.get(SessionRow, second).started_at = datetime(2026, 1, 2, 12, 0, 0)
    db_session.commit()

    ids = [s["session_id"] for s in client.get("/api/v1/sessions").json()["sessions"]]
    assert ids == [second, first]
