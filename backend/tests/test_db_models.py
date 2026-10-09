from __future__ import annotations

from sqlalchemy import inspect

from app.db.models import (
    EventRow,
    PerformanceProfileRow,
    ScenarioRow,
    ScoreRow,
    SessionRow,
)
from app.schemas.scenario import Scenario


def _scenario() -> Scenario:
    return Scenario(
        scenario_id="SCN-000001",
        seed=1,
        generator_version="1.0",
        difficulty=3,
        environment="rural",
        time_of_day="day",
        visibility="clear",
        sensor_quality=0.9,
        duration_seconds=120.0,
        threats=[
            {
                "id": "T01",
                "classification_label": "hostile",
                "expected_response": "hold",
                "spawn_time": 10.0,
                "speed_class": "fast",
            }
        ],
    )


def test_all_expected_tables_exist(db_engine) -> None:
    names = set(inspect(db_engine).get_table_names())
    assert {"scenarios", "sessions", "events", "scores", "performance_profiles"} <= names


def test_scenario_row_round_trips(db_session) -> None:
    scenario = _scenario()
    db_session.add(ScenarioRow.from_schema(scenario))
    db_session.commit()
    row = db_session.get(ScenarioRow, scenario.scenario_id)
    assert row is not None
    assert row.to_schema() == scenario


def test_session_event_score_and_profile_rows(db_session) -> None:
    scenario = _scenario()
    db_session.add(ScenarioRow.from_schema(scenario))
    db_session.add(
        SessionRow(
            session_id="SES-TEST0001",
            trainee_id="TRAIN-001",
            scenario_id=scenario.scenario_id,
            status="active",
        )
    )
    db_session.add(
        EventRow(
            event_id="EVT-001",
            session_id="SES-TEST0001",
            timestamp_ms=1000,
            type="THREAT_DETECTED",
            threat_id="T01",
            payload_json="{}",
        )
    )
    db_session.add(
        ScoreRow(
            session_id="SES-TEST0001",
            detection_score=30.0,
            classification_score=30.0,
            response_score=25.0,
            timing_score=15.0,
            penalty=0.0,
            final_score=100.0,
            scoring_version=1,
        )
    )
    db_session.add(PerformanceProfileRow(trainee_id="TRAIN-001", session_count=1))
    db_session.commit()

    assert db_session.get(SessionRow, "SES-TEST0001").status == "active"
    assert db_session.get(EventRow, "EVT-001").type == "THREAT_DETECTED"
    assert db_session.get(ScoreRow, "SES-TEST0001").final_score == 100.0
    assert db_session.get(PerformanceProfileRow, "TRAIN-001").session_count == 1
