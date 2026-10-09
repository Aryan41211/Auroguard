from __future__ import annotations


def _scenario(client, seed: int, difficulty: int = 3):
    return client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": difficulty, "environment": "rural", "time_of_day": "night",
              "threat_count": 1, "seed": seed},
    ).json()


def _play(client, scenario, *, correct: bool) -> str:
    threat = scenario["threats"][0]
    session = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-001", "scenario_id": scenario["scenario_id"]},
    ).json()
    sid = session["session_id"]
    if correct:
        events = [
            {"type": "THREAT_DETECTED", "timestamp_ms": 500, "threat_id": threat["id"]},
            {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 1500, "threat_id": threat["id"],
             "payload": {"label": threat["classification_label"]}},
            {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 2500, "threat_id": threat["id"],
             "payload": {"response": threat["expected_response"]}},
        ]
        for event in events:
            client.post(f"/api/v1/sessions/{sid}/events", json=event)
    client.post(f"/api/v1/sessions/{sid}/complete")
    return sid


def test_performance_unknown_trainee_is_404(client) -> None:
    assert client.get("/api/v1/trainees/TRAIN-NONE/performance").status_code == 404


def test_performance_aggregates_completed_sessions(client) -> None:
    _play(client, _scenario(client, 1), correct=True)
    _play(client, _scenario(client, 2), correct=True)
    response = client.get("/api/v1/trainees/TRAIN-001/performance")
    assert response.status_code == 200
    body = response.json()
    assert body["trainee_id"] == "TRAIN-001"
    assert body["session_count"] == 2
    assert body["detection_accuracy"] == 100.0
    assert body["night_score"] == 100.0


def test_recommend_unknown_trainee_is_404(client) -> None:
    assert client.post("/api/v1/training/recommend", json={"trainee_id": "TRAIN-NONE"}).status_code == 404


def test_recommend_invalid_body_is_422(client) -> None:
    assert client.post("/api/v1/training/recommend", json={}).status_code == 422


def test_recommend_defaults_for_active_only_trainee(client) -> None:
    scenario = _scenario(client, 3)
    client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-ACT", "scenario_id": scenario["scenario_id"]},
    )
    response = client.post("/api/v1/training/recommend", json={"trainee_id": "TRAIN-ACT"})
    assert response.status_code == 200
    body = response.json()
    assert body["recommended_difficulty"] == 1
    assert "no completed sessions" in body["reason"].lower()


def test_recommend_increases_and_persists_level(client) -> None:
    for seed in (10, 11, 12):
        _play(client, _scenario(client, seed, difficulty=3), correct=True)
    first = client.post("/api/v1/training/recommend", json={"trainee_id": "TRAIN-001"}).json()
    assert first["recommended_difficulty"] == 2
    assert "increasing" in first["reason"].lower()
    # level was persisted
    assert client.get("/api/v1/trainees/TRAIN-001/performance").json()["current_level"] == 2
