from __future__ import annotations

from app.db.models import EventRow, ScenarioRow, ScoreRow, event_row_to_request
from app.services.scoring import score


def _generate(client, seed: int) -> dict:
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
    return response.json()


def test_full_session_lifecycle_is_deterministic(client, db_session) -> None:
    scenario = _generate(client, seed=4242)
    session_id = client.post(
        "/api/v1/sessions",
        json={"trainee_id": "TRAIN-042", "scenario_id": scenario["scenario_id"]},
    ).json()["session_id"]

    threat = scenario["threats"][0]
    events = [
        {"type": "THREAT_DETECTED", "timestamp_ms": 1000, "threat_id": threat["id"]},
        {
            "type": "CLASSIFICATION_SUBMITTED",
            "timestamp_ms": 2000,
            "threat_id": threat["id"],
            "payload": {"label": threat["classification_label"]},
        },
        {
            "type": "RESPONSE_SUBMITTED",
            "timestamp_ms": 3000,
            "threat_id": threat["id"],
            "payload": {"response": threat["expected_response"]},
        },
    ]
    for event in events:
        assert (
            client.post(
                f"/api/v1/sessions/{session_id}/events", json=event
            ).status_code
            == 201
        )

    completed = client.post(f"/api/v1/sessions/{session_id}/complete")
    assert completed.status_code == 200

    score_row = db_session.get(ScoreRow, session_id)
    assert score_row is not None
    assert score_row.final_score == completed.json()["final_score"]

    # Recompute independently from the persisted scenario + events.
    scenario_row = db_session.get(ScenarioRow, scenario["scenario_id"])
    event_rows = (
        db_session.query(EventRow)
        .filter(EventRow.session_id == session_id)
        .order_by(EventRow.timestamp_ms, EventRow.event_id)
        .all()
    )
    recomputed = score(
        session_id,
        scenario_row.to_schema(),
        [event_row_to_request(row) for row in event_rows],
    )
    assert recomputed.final_score == score_row.final_score
