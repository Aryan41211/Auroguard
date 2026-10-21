from __future__ import annotations


def _generate(client, seed: int = 4242):
    return client.post(
        "/api/v1/scenarios/generate",
        json={"difficulty": 3, "environment": "rural", "time_of_day": "day",
              "threat_count": 1, "seed": seed},
    ).json()


def _session(client, scenario):
    return client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-007", "scenario_id": scenario["scenario_id"]},
    ).json()


def test_replay_unknown_session_is_404(client) -> None:
    assert client.get("/api/v1/sessions/SES-NOPE/replay").status_code == 404


def test_replay_of_a_fresh_session_is_empty_but_valid(client) -> None:
    scenario = _generate(client)
    session = _session(client, scenario)
    response = client.get(f"/api/v1/sessions/{session['session_id']}/replay")
    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == session["session_id"]
    assert body["trainee_id"] == "TRAIN-007"
    assert body["events"] == []
    assert body["frames"] == []
    assert body["duration_ms"] == 0
    assert body["score"] is None
    assert body["scenario"]["scenario_id"] == scenario["scenario_id"]


def test_replay_reproduces_the_recorded_event_log(client) -> None:
    scenario = _generate(client)
    threat = scenario["threats"][0]
    session = _session(client, scenario)
    sid = session["session_id"]
    for payload in (
        {"type": "SESSION_STARTED", "timestamp_ms": 0},
        {"type": "SCENARIO_LOADED", "timestamp_ms": 5},
        {"type": "THREAT_SPAWNED", "timestamp_ms": 2000, "threat_id": threat["id"]},
        {"type": "THREAT_DETECTED", "timestamp_ms": 3000, "threat_id": threat["id"]},
        {"type": "CLASSIFICATION_SUBMITTED", "timestamp_ms": 3500,
         "threat_id": threat["id"], "payload": {"label": threat["classification_label"]}},
        {"type": "RESPONSE_SUBMITTED", "timestamp_ms": 4000, "threat_id": threat["id"],
         "payload": {"response": threat["expected_response"]}},
    ):
        assert client.post(
            f"/api/v1/sessions/{sid}/events", json=payload
        ).status_code == 201

    body = client.get(f"/api/v1/sessions/{sid}/replay").json()
    assert [event["type"] for event in body["events"]] == [
        "SESSION_STARTED", "SCENARIO_LOADED", "THREAT_SPAWNED",
        "THREAT_DETECTED", "CLASSIFICATION_SUBMITTED", "RESPONSE_SUBMITTED",
    ]
    assert [frame["event_type"] for frame in body["frames"]] == [
        event["type"] for event in body["events"]
    ]
    assert body["duration_ms"] == 4000
    last = body["frames"][-1]
    state = next(s for s in last["threats"] if s["threat_id"] == threat["id"])
    assert state["stage"] == "responded"
    assert state["detected"] is True


def test_replay_includes_the_score_after_completion(client) -> None:
    scenario = _generate(client)
    session = _session(client, scenario)
    sid = session["session_id"]
    completed = client.post(f"/api/v1/sessions/{sid}/complete").json()

    body = client.get(f"/api/v1/sessions/{sid}/replay").json()
    assert body["score"]["final_score"] == completed["final_score"]
    assert body["score"]["scoring_version"] == completed["scoring_version"]


def test_replay_is_byte_identical_across_calls(client) -> None:
    scenario = _generate(client)
    session = _session(client, scenario)
    sid = session["session_id"]
    client.post(
        f"/api/v1/sessions/{sid}/events",
        json={"type": "THREAT_DETECTED", "timestamp_ms": 1000,
              "threat_id": scenario["threats"][0]["id"]},
    )
    first = client.get(f"/api/v1/sessions/{sid}/replay").json()
    second = client.get(f"/api/v1/sessions/{sid}/replay").json()
    assert first == second


def test_replay_exposes_the_scenario_ground_truth_for_review(client) -> None:
    scenario = _generate(client)
    session = _session(client, scenario)
    body = client.get(f"/api/v1/sessions/{session['session_id']}/replay").json()
    assert body["scenario"]["seed"] == scenario["seed"]
    assert body["scenario"]["threats"][0]["classification_label"] == (
        scenario["threats"][0]["classification_label"]
    )
