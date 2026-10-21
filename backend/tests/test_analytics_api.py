"""API tests for GET /api/v1/analytics/conditions."""

from __future__ import annotations

from app.db.models import ScenarioRow, ScoreRow, SessionRow


def _seed_session(
    db_session,
    *,
    scenario_id: str,
    session_id: str,
    trainee_id: str = "TRAIN-A",
    environment: str = "urban",
    time_of_day: str = "day",
    visibility: str = "clear",
    status: str = "completed",
    scores: tuple[float, float, float, float, float] = (80.0, 24.0, 24.0, 20.0, 12.0),
) -> None:
    db_session.add(
        ScenarioRow(
            scenario_id=scenario_id,
            seed=1,
            generator_version="1.0",
            difficulty=3,
            environment=environment,
            time_of_day=time_of_day,
            visibility=visibility,
            sensor_quality=0.8,
            duration_seconds=120.0,
            threats_json="[]",
        )
    )
    db_session.add(
        SessionRow(
            session_id=session_id,
            trainee_id=trainee_id,
            scenario_id=scenario_id,
            status=status,
        )
    )
    if status == "completed":
        final, detection, classification, response, timing = scores
        db_session.add(
            ScoreRow(
                session_id=session_id,
                detection_score=detection,
                classification_score=classification,
                response_score=response,
                timing_score=timing,
                penalty=0.0,
                final_score=final,
                scoring_version=1,
            )
        )
    db_session.commit()


def _dimension(body: dict, name: str) -> dict:
    return next(d for d in body["dimensions"] if d["dimension"] == name)


def test_analytics_empty_database(client):
    response = client.get("/api/v1/analytics/conditions")

    assert response.status_code == 200
    body = response.json()
    assert body["total_sessions"] == 0
    assert [d["dimension"] for d in body["dimensions"]] == [
        "environment",
        "time_of_day",
        "visibility",
    ]
    assert all(d["buckets"] == [] for d in body["dimensions"])


def test_analytics_aggregates_completed_sessions_by_condition(client, db_session):
    _seed_session(
        db_session,
        scenario_id="SCN-1",
        session_id="SES-1",
        environment="urban",
        time_of_day="day",
        visibility="clear",
        scores=(90.0, 27.0, 27.0, 22.5, 13.5),
    )
    _seed_session(
        db_session,
        scenario_id="SCN-2",
        session_id="SES-2",
        environment="urban",
        time_of_day="night",
        visibility="reduced",
        scores=(80.0, 24.0, 24.0, 20.0, 12.0),
    )
    _seed_session(
        db_session,
        scenario_id="SCN-3",
        session_id="SES-3",
        environment="rural",
        time_of_day="night",
        visibility="poor",
        scores=(70.0, 21.0, 21.0, 17.5, 10.5),
    )

    body = client.get("/api/v1/analytics/conditions").json()

    assert body["total_sessions"] == 3
    environment = _dimension(body, "environment")
    assert [b["bucket"] for b in environment["buckets"]] == ["urban", "rural"]
    urban = environment["buckets"][0]
    assert urban["session_count"] == 2
    assert urban["mean_final_score"] == 85.0
    assert urban["mean_detection_score"] == 25.5
    assert urban["mean_classification_score"] == 25.5
    assert urban["mean_response_score"] == 21.25
    assert urban["mean_timing_score"] == 12.75

    assert _dimension(body, "time_of_day")["buckets"][1] == {
        "bucket": "night",
        "session_count": 2,
        "mean_final_score": 75.0,
        "mean_detection_score": 22.5,
        "mean_classification_score": 22.5,
        "mean_response_score": 18.75,
        "mean_timing_score": 11.25,
    }
    assert [b["bucket"] for b in _dimension(body, "visibility")["buckets"]] == [
        "clear",
        "reduced",
        "poor",
    ]


def test_analytics_excludes_active_sessions(client, db_session):
    _seed_session(
        db_session,
        scenario_id="SCN-1",
        session_id="SES-DONE",
        environment="urban",
        scores=(90.0, 27.0, 27.0, 22.5, 13.5),
    )
    _seed_session(
        db_session,
        scenario_id="SCN-2",
        session_id="SES-ACTIVE",
        environment="rural",
        status="active",
    )

    body = client.get("/api/v1/analytics/conditions").json()

    assert body["total_sessions"] == 1
    assert [b["bucket"] for b in _dimension(body, "environment")["buckets"]] == ["urban"]


def test_analytics_filters_by_trainee(client, db_session):
    _seed_session(
        db_session,
        scenario_id="SCN-1",
        session_id="SES-A",
        trainee_id="TRAIN-A",
        environment="urban",
        scores=(90.0, 27.0, 27.0, 22.5, 13.5),
    )
    _seed_session(
        db_session,
        scenario_id="SCN-2",
        session_id="SES-B",
        trainee_id="TRAIN-B",
        environment="rural",
        scores=(60.0, 18.0, 18.0, 15.0, 9.0),
    )

    body = client.get(
        "/api/v1/analytics/conditions", params={"trainee_id": "TRAIN-A"}
    ).json()

    assert body["total_sessions"] == 1
    buckets = _dimension(body, "environment")["buckets"]
    assert [b["bucket"] for b in buckets] == ["urban"]
    assert buckets[0]["mean_final_score"] == 90.0
