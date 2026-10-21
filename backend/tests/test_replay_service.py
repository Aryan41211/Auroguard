from __future__ import annotations

from app.schemas.events import EventType
from app.schemas.scenario import Scenario, ThreatProfile
from app.services.replay import (
    STAGE_CLASSIFIED,
    STAGE_DETECTED,
    STAGE_MISSED,
    STAGE_PENDING,
    STAGE_RESPONDED,
    STAGE_SPAWNED,
    EventRecord,
    build_frames,
    build_replay,
    state_at,
)


def _scenario() -> Scenario:
    return Scenario(
        scenario_id="SCN-1",
        seed=42,
        generator_version="v1",
        difficulty=3,
        environment="rural",
        time_of_day="day",
        visibility="clear",
        sensor_quality=0.8,
        duration_seconds=60.0,
        threats=[
            ThreatProfile(
                id="T-1",
                category="quadcopter",
                classification_label="unknown",
                expected_response="track",
                spawn_time=2.0,
                speed_class="medium",
                visibility_class="clear",
            ),
            ThreatProfile(
                id="T-2",
                category="fixed_wing",
                classification_label="friendly",
                expected_response="monitor",
                spawn_time=8.0,
                speed_class="fast",
                visibility_class="clear",
            ),
        ],
    )


def _event(
    event_id: str,
    event_type: EventType,
    timestamp_ms: int,
    threat_id: str | None = None,
    payload: dict | None = None,
) -> EventRecord:
    return EventRecord(
        event_id=event_id,
        type=event_type,
        timestamp_ms=timestamp_ms,
        threat_id=threat_id,
        payload=payload or {},
    )


def _full_log() -> list[EventRecord]:
    return [
        _event("EVT-001", EventType.SESSION_STARTED, 0),
        _event("EVT-002", EventType.SCENARIO_LOADED, 10),
        _event("EVT-003", EventType.THREAT_SPAWNED, 2000, "T-1"),
        _event("EVT-004", EventType.THREAT_DETECTED, 3000, "T-1"),
        _event(
            "EVT-005",
            EventType.CLASSIFICATION_SUBMITTED,
            3500,
            "T-1",
            {"label": "unknown"},
        ),
        _event(
            "EVT-006",
            EventType.RESPONSE_SUBMITTED,
            4200,
            "T-1",
            {"response": "track"},
        ),
        _event("EVT-007", EventType.THREAT_RESOLVED, 4300, "T-1"),
        _event("EVT-008", EventType.FALSE_ALARM, 5000),
        _event("EVT-009", EventType.SESSION_COMPLETED, 6000),
    ]


def test_frames_are_one_per_event_in_chronological_order() -> None:
    frames = build_frames(_scenario(), _full_log())
    assert [frame.event_id for frame in frames] == [
        f"EVT-{index:03d}" for index in range(1, 10)
    ]
    assert [frame.timestamp_ms for frame in frames] == sorted(
        frame.timestamp_ms for frame in frames
    )


def test_frames_are_sorted_even_when_events_arrive_out_of_order() -> None:
    log = _full_log()
    shuffled = [log[3], log[0], log[6], log[1], log[2], log[5], log[4], log[7], log[8]]
    frames = build_frames(_scenario(), shuffled)
    assert [frame.event_id for frame in frames] == [
        f"EVT-{index:03d}" for index in range(1, 10)
    ]


def test_frames_carry_the_full_threat_set_from_the_start() -> None:
    frames = build_frames(_scenario(), _full_log())
    assert [state.threat_id for state in frames[0].threats] == ["T-1", "T-2"]
    assert all(state.stage == STAGE_PENDING for state in frames[0].threats)


def test_threat_stage_advances_with_the_event_log() -> None:
    frames = build_frames(_scenario(), _full_log())
    stages = {
        frame.event_id: {state.threat_id: state.stage for state in frame.threats}
        for frame in frames
    }
    assert stages["EVT-002"]["T-1"] == STAGE_PENDING
    assert stages["EVT-003"]["T-1"] == STAGE_SPAWNED
    assert stages["EVT-004"]["T-1"] == STAGE_DETECTED
    assert stages["EVT-005"]["T-1"] == STAGE_CLASSIFIED
    assert stages["EVT-006"]["T-1"] == STAGE_RESPONDED
    assert stages["EVT-009"]["T-1"] == STAGE_RESPONDED


def test_classification_and_response_payloads_are_recorded() -> None:
    frames = build_frames(_scenario(), _full_log())
    classified = next(f for f in frames if f.event_id == "EVT-005")
    t1 = next(state for state in classified.threats if state.threat_id == "T-1")
    assert t1.classification == "unknown"
    assert t1.response is None
    responded = next(f for f in frames if f.event_id == "EVT-006")
    t1 = next(state for state in responded.threats if state.threat_id == "T-1")
    assert t1.response == "track"
    assert t1.detected is True


def test_missed_threat_is_marked_in_the_timeline() -> None:
    log = [
        _event("EVT-001", EventType.SESSION_STARTED, 0),
        _event("EVT-002", EventType.THREAT_MISSED, 9000, "T-2"),
    ]
    frames = build_frames(_scenario(), log)
    t2 = next(state for state in frames[-1].threats if state.threat_id == "T-2")
    assert t2.stage == STAGE_MISSED
    assert frames[-1].label == "T-2 missed"


def test_labels_are_human_readable_and_deterministic() -> None:
    frames = build_frames(_scenario(), _full_log())
    labels = {frame.event_id: frame.label for frame in frames}
    assert labels["EVT-001"] == "Session started"
    assert labels["EVT-003"] == "T-1 appeared"
    assert labels["EVT-005"] == "T-1 classified as unknown"
    assert labels["EVT-006"] == "T-1 response: track"
    assert labels["EVT-008"] == "False alarm raised"
    assert labels["EVT-009"] == "Session completed"


def test_build_replay_is_deterministic_for_the_same_log() -> None:
    scenario = _scenario()
    log = _full_log()
    first = build_replay("SES-1", "TRAIN-001", scenario, log)
    second = build_replay("SES-1", "TRAIN-001", scenario, list(log))
    assert first.model_dump() == second.model_dump()


def test_build_replay_reports_events_frames_and_duration() -> None:
    replay = build_replay("SES-1", "TRAIN-001", _scenario(), _full_log())
    assert replay.session_id == "SES-1"
    assert replay.trainee_id == "TRAIN-001"
    assert len(replay.events) == 9
    assert len(replay.frames) == 9
    assert replay.duration_ms == 6000
    assert replay.score is None
    assert replay.events[0].event_id == "EVT-001"
    assert replay.events[0].type == EventType.SESSION_STARTED


def test_build_replay_of_an_empty_log_is_empty_but_valid() -> None:
    replay = build_replay("SES-1", "TRAIN-001", _scenario(), [])
    assert replay.events == []
    assert replay.frames == []
    assert replay.duration_ms == 0


def test_state_at_returns_the_frame_state_at_or_before_the_timestamp() -> None:
    scenario = _scenario()
    frames = build_frames(scenario, _full_log())
    before = state_at(scenario, frames, 1999)
    assert all(state.stage == STAGE_PENDING for state in before)
    at_spawn = state_at(scenario, frames, 2000)
    assert next(s for s in at_spawn if s.threat_id == "T-1").stage == STAGE_SPAWNED
    after_end = state_at(scenario, frames, 99_999)
    assert next(s for s in after_end if s.threat_id == "T-1").stage == STAGE_RESPONDED


def test_state_at_before_the_first_event_is_all_pending() -> None:
    scenario = _scenario()
    frames = build_frames(scenario, _full_log())
    states = state_at(scenario, frames, -1)
    assert [state.stage for state in states] == [STAGE_PENDING, STAGE_PENDING]
