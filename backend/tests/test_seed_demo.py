"""Deterministic demo seeder: coverage for history + performance feed."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import models  # noqa: F401  (register table metadata)
from app.db.database import Base
from app.db.models import SessionRow
from app.services.demo_seed import SeedSummary, seed_demo_data

SESSIONS = 12
BASE_SEED = 20260101


def _seed_into_tmp(tmp_path, name: str, sessions: int, base_seed: int) -> SeedSummary:
    engine = create_engine(
        f"sqlite:///{tmp_path / name}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    db = factory()
    try:
        return seed_demo_data(db, sessions=sessions, base_seed=base_seed)
    finally:
        db.close()
        engine.dispose()


def test_seed_completes_requested_sessions_across_trainees(db_session):
    summary = seed_demo_data(db_session, sessions=SESSIONS, base_seed=BASE_SEED)

    assert summary.sessions_requested == SESSIONS
    assert summary.sessions_completed == SESSIONS
    assert len(summary.trainee_ids) >= 2

    rows = db_session.query(SessionRow).all()
    assert len(rows) == SESSIONS
    assert {row.status for row in rows} == {"completed"}
    assert {row.trainee_id for row in rows} == set(summary.trainee_ids)
    assert all(row.final_score is not None for row in rows)


def test_seed_scores_vary_across_sessions(db_session):
    summary = seed_demo_data(db_session, sessions=SESSIONS, base_seed=BASE_SEED)
    assert len(set(summary.final_scores)) > 1


def test_seed_history_endpoint_serves_sessions(db_session, client):
    seed_demo_data(db_session, sessions=SESSIONS, base_seed=BASE_SEED)

    body = client.get("/api/v1/sessions").json()
    assert len(body["sessions"]) == SESSIONS
    assert all(entry["status"] == "completed" for entry in body["sessions"])
    assert all(entry["final_score"] is not None for entry in body["sessions"])
    assert {entry["trainee_id"] for entry in body["sessions"]} == set(
        row.trainee_id for row in db_session.query(SessionRow).all()
    )


def test_seed_performance_endpoint_aggregates(db_session, client):
    summary = seed_demo_data(db_session, sessions=SESSIONS, base_seed=BASE_SEED)
    trainee_id = summary.trainee_ids[0]

    response = client.get(f"/api/v1/trainees/{trainee_id}/performance")
    assert response.status_code == 200
    profile = response.json()
    assert profile["trainee_id"] == trainee_id
    assert profile["session_count"] == dict(summary.per_trainee_counts)[trainee_id]
    assert 0 <= profile["detection_accuracy"] <= 100
    assert 0 <= profile["classification_accuracy"] <= 100
    assert 0 <= profile["response_accuracy"] <= 100


def test_seed_is_deterministic_for_same_base_seed(tmp_path):
    first = _seed_into_tmp(tmp_path, "first.db", SESSIONS, BASE_SEED)
    second = _seed_into_tmp(tmp_path, "second.db", SESSIONS, BASE_SEED)

    assert first == second
    assert first.scenario_ids == second.scenario_ids
    assert first.final_scores == second.final_scores
    assert first.per_trainee_counts == second.per_trainee_counts


def test_seed_differs_for_different_base_seed(tmp_path):
    first = _seed_into_tmp(tmp_path, "a.db", SESSIONS, BASE_SEED)
    second = _seed_into_tmp(tmp_path, "b.db", SESSIONS, BASE_SEED + 1)

    assert first.scenario_ids != second.scenario_ids


def test_seed_zero_sessions_is_empty(db_session):
    summary = seed_demo_data(db_session, sessions=0, base_seed=BASE_SEED)
    assert summary.sessions_requested == 0
    assert summary.sessions_completed == 0
    assert summary.scenario_ids == ()
    assert db_session.query(SessionRow).count() == 0
