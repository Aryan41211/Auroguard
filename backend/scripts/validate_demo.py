"""End-to-end demonstration validator.

Runs the full demo sequence against a live Aeroguard API and proves the five
validation questions in ``docs/project-management/demo_validation.md``:

1. Same seed reproduces the same scenario.
2. Same events reproduce the same score.
3. A missed threat is visible in the AAR.
4. Performance is comparable across sessions.
5. Adaptive difficulty explains why it changed.

Usage (backend must be running)::

    python backend/scripts/validate_demo.py
    python backend/scripts/validate_demo.py --base-url http://127.0.0.1:8000 \
        --trainee-id DEMO-TRAINEE --seed 20261021 --json evidence.json

Exit code is 0 only when every check passes. The script uses the public HTTP
API for the workflow and imports the pure services directly to recompute
determinism and scoring independently of the server.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.schemas.events import EventCreateRequest, EventType  # noqa: E402
from app.schemas.scenario import Scenario, ScenarioGenerateRequest  # noqa: E402
from app.services.scenario_generator import generate_scenario  # noqa: E402
from app.services.scoring import score  # noqa: E402


class DemoValidationError(AssertionError):
    """Raised when an observed result contradicts the validation question."""


@dataclass
class Evidence:
    """Collected evidence, printed and optionally written as JSON."""

    scenario_a: dict[str, Any] = field(default_factory=dict)
    session_a: dict[str, Any] = field(default_factory=dict)
    scenario_b: dict[str, Any] = field(default_factory=dict)
    session_b: dict[str, Any] = field(default_factory=dict)
    performance: dict[str, Any] = field(default_factory=dict)
    history: list[dict[str, Any]] = field(default_factory=list)
    recommendation: dict[str, Any] = field(default_factory=dict)
    checks: list[dict[str, Any]] = field(default_factory=list)

    def check(self, question: str, passed: bool, detail: str) -> None:
        self.checks.append({"question": question, "passed": passed, "detail": detail})
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {question}\n       {detail}")


class Api:
    """Minimal JSON HTTP client built on the standard library."""

    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def request(
        self, method: str, path: str, body: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise DemoValidationError(
                f"{method} {path} failed with {exc.code}: {detail}"
            ) from exc
        except urllib.error.URLError as exc:
            raise DemoValidationError(
                f"cannot reach {self.base_url}{path}: {exc.reason}. Is the API running?"
            ) from exc
        return json.loads(payload) if payload else {}

    def get(self, path: str) -> dict[str, Any]:
        return self.request("GET", path)

    def post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        return self.request("POST", path, body)


def _now_ms(spawn_seconds: float, offset_ms: int) -> int:
    return int(round(spawn_seconds * 1000)) + offset_ms


def _start_session(
    api: Api,
    trainee_id: str,
    scenario: dict[str, Any],
    scenario_request: dict[str, Any],
) -> str:
    created = api.post(
        "/api/v1/sessions",
        {"trainee_id": trainee_id, "scenario_id": scenario["scenario_id"]},
    )
    session_id = created["session_id"]
    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.SESSION_STARTED.value,
            "timestamp_ms": 0,
            "payload": {"trainee_id": trainee_id},
        },
    )
    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.SCENARIO_LOADED.value,
            "timestamp_ms": 0,
            "payload": {"scenario_id": scenario["scenario_id"], **scenario_request},
        },
    )
    return session_id


def _handle_threat(
    api: Api,
    session_id: str,
    threat: dict[str, Any],
    *,
    correct: bool = True,
) -> None:
    """Record a full decision chain for one threat."""

    spawn = float(threat["spawn_time"])
    detection_ms = _now_ms(spawn, 1_800)
    classification_ms = detection_ms + 1_200
    response_ms = classification_ms + 900

    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.THREAT_SPAWNED.value,
            "timestamp_ms": _now_ms(spawn, 0),
            "threat_id": threat["id"],
            "payload": {"spawn_time": spawn},
        },
    )
    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.THREAT_DETECTED.value,
            "timestamp_ms": detection_ms,
            "threat_id": threat["id"],
            "payload": {"confidence": 0.92},
        },
    )
    label = threat["classification_label"] if correct else "unknown"
    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.CLASSIFICATION_SUBMITTED.value,
            "timestamp_ms": classification_ms,
            "threat_id": threat["id"],
            "payload": {"label": label},
        },
    )
    response = threat["expected_response"] if correct else "monitor"
    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.RESPONSE_SUBMITTED.value,
            "timestamp_ms": response_ms,
            "threat_id": threat["id"],
            "payload": {"response": response},
        },
    )


def _miss_threat(api: Api, session_id: str, threat: dict[str, Any]) -> None:
    """Record only the spawn: no detection, classification or response."""

    spawn = float(threat["spawn_time"])
    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.THREAT_SPAWNED.value,
            "timestamp_ms": _now_ms(spawn, 0),
            "threat_id": threat["id"],
            "payload": {"spawn_time": spawn},
        },
    )


def _finish_session(api: Api, session_id: str) -> dict[str, Any]:
    api.post(
        f"/api/v1/sessions/{session_id}/events",
        {
            "type": EventType.SESSION_COMPLETED.value,
            "timestamp_ms": 200_000,
            "payload": {},
        },
    )
    return api.post(f"/api/v1/sessions/{session_id}/complete", {})


def run(api: Api, trainee_id: str, seed: int) -> Evidence:
    """Execute the demo sequence through ``api`` and return the evidence."""

    evidence = Evidence()

    health = api.get("/health")
    if health.get("status") != "ok":
        raise DemoValidationError(f"unhealthy API: {health}")
    print(f"API {api.base_url} is healthy; trainee={trainee_id} seed={seed}\n")

    scenario_request = {
        "difficulty": 4,
        "environment": "urban",
        "time_of_day": "day",
        "threat_count": 2,
        "seed": seed,
    }

    # --- Q1: same seed reproduces the same scenario -------------------------
    scenario_a = api.post("/api/v1/scenarios/generate", scenario_request)
    scenario_again = api.post("/api/v1/scenarios/generate", scenario_request)
    local = generate_scenario(
        ScenarioGenerateRequest.model_validate(scenario_request), seed
    ).model_dump(mode="json")
    same_seed = scenario_a == scenario_again == local
    evidence.scenario_a = scenario_a
    print("Scenario A:", json.dumps(scenario_a, indent=2), "\n")
    evidence.check(
        "Can the same seed reproduce the same scenario?",
        same_seed,
        f"seed {seed} -> {scenario_a['scenario_id']}; repeated API call and local "
        f"generator both produced an identical scenario "
        f"(difficulty={scenario_a['difficulty']}, threats={len(scenario_a['threats'])}).",
    )

    # --- Session A: first threat handled, second deliberately missed --------
    session_a = _start_session(api, trainee_id, scenario_a, scenario_request)
    _handle_threat(api, session_a, scenario_a["threats"][0])
    missed_threat = scenario_a["threats"][1]
    _miss_threat(api, session_a, missed_threat)
    completed_a = _finish_session(api, session_a)

    aar_a = api.get(f"/api/v1/sessions/{session_a}/aar")
    scenario_model = Scenario.model_validate(scenario_a)
    events_a = [EventCreateRequest.model_validate(e) for e in aar_a["timeline"]]
    recomputed = score(session_a, scenario_model, events_a).model_dump()
    repeat_complete = api.post(f"/api/v1/sessions/{session_a}/complete", {})

    evidence.session_a = {
        "session_id": session_a,
        "scenario_id": scenario_a["scenario_id"],
        "completed": completed_a,
        "aar": aar_a,
    }
    print("AAR A:", json.dumps(aar_a, indent=2), "\n")

    # --- Q2: same events reproduce the same score ---------------------------
    score_matches = (
        recomputed["final_score"] == completed_a["final_score"]
        and repeat_complete == completed_a
    )
    evidence.check(
        "Can the same events reproduce the same score?",
        score_matches,
        f"events of {session_a} rescored to {recomputed['final_score']} "
        f"(API: {completed_a['final_score']}); a repeated complete call returned the "
        "identical score.",
    )

    # --- Q3: missed threat visible in the AAR -------------------------------
    missed = [
        mistake
        for mistake in aar_a["mistakes"]
        if mistake["kind"] == "missed_threat"
        and mistake["threat_id"] == missed_threat["id"]
    ]
    evidence.check(
        "Can a missed threat be detected in the AAR?",
        bool(missed),
        f"AAR lists {len(aar_a['mistakes'])} mistake(s), including missed_threat "
        f"for {missed_threat['id']} (spawn at {missed_threat['spawn_time']}s).",
    )

    # --- Session B: a second, cleaner run for cross-session comparison ------
    scenario_b_request = {
        **scenario_request,
        "seed": seed + 1,
        "difficulty": 3,
        "threat_count": 1,
    }
    scenario_b = api.post("/api/v1/scenarios/generate", scenario_b_request)
    session_b = _start_session(api, trainee_id, scenario_b, scenario_b_request)
    _handle_threat(api, session_b, scenario_b["threats"][0])
    completed_b = _finish_session(api, session_b)
    evidence.scenario_b = scenario_b
    evidence.session_b = {
        "session_id": session_b,
        "scenario_id": scenario_b["scenario_id"],
        "completed": completed_b,
    }
    print(
        "Scenario B:",
        json.dumps(
            {
                "scenario_id": scenario_b["scenario_id"],
                "seed": scenario_b["seed"],
                "difficulty": scenario_b["difficulty"],
                "threats": len(scenario_b["threats"]),
            },
            indent=2,
        ),
        "\n",
    )

    # --- Q4: performance is comparable across sessions ----------------------
    performance = api.get(f"/api/v1/trainees/{trainee_id}/performance")
    history = api.get(f"/api/v1/sessions?trainee_id={trainee_id}")["sessions"]
    mine = {
        entry["session_id"]: entry
        for entry in history
        if entry["session_id"] in {session_a, session_b}
    }
    comparable = (
        performance["session_count"] >= 2
        and set(mine) == {session_a, session_b}
        and all(entry["final_score"] is not None for entry in mine.values())
    )
    evidence.performance = performance
    evidence.history = history
    print("Performance:", json.dumps(performance, indent=2), "\n")
    evidence.check(
        "Can performance be compared across sessions?",
        comparable,
        f"performance aggregates {performance['session_count']} completed session(s); "
        f"{session_a} scored {mine[session_a]['final_score']} and {session_b} scored "
        f"{mine[session_b]['final_score']} in the session history.",
    )

    # --- Q5: adaptive difficulty explains why it changed --------------------
    recommendation = api.post(
        "/api/v1/training/recommend", {"trainee_id": trainee_id}
    )
    evidence.recommendation = recommendation
    print("Recommendation:", json.dumps(recommendation, indent=2), "\n")
    explained = (
        1 <= recommendation["recommended_difficulty"] <= 10
        and bool(recommendation["reason"].strip())
    )
    evidence.check(
        "Can adaptive difficulty explain why it changed?",
        explained,
        f"next session targets difficulty {recommendation['recommended_difficulty']} "
        f"({recommendation['environment']}, {recommendation['time_of_day']}, "
        f"{recommendation['threat_count']} threat(s)) because: {recommendation['reason']}",
    )

    # --- Bonus evidence: the replay of the missed-threat session ------------
    replay = api.get(f"/api/v1/sessions/{session_a}/replay")
    final_states = replay["frames"][-1]["threats"] if replay["frames"] else []
    missed_state = next(
        (state for state in final_states if state["threat_id"] == missed_threat["id"]),
        None,
    )
    print(
        "Replay:",
        json.dumps(
            {
                "session_id": replay["session_id"],
                "duration_ms": replay["duration_ms"],
                "events": len(replay["events"]),
                "frames": len(replay["frames"]),
                "missed_threat_state": missed_state,
            },
            indent=2,
        ),
        "\n",
    )

    return evidence


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--trainee-id", default="DEMO-TRAINEE")
    parser.add_argument("--seed", type=int, default=20261021)
    parser.add_argument(
        "--json",
        type=Path,
        default=None,
        help="optional path to write the collected evidence as JSON",
    )
    args = parser.parse_args(argv)

    try:
        evidence = run(Api(args.base_url), args.trainee_id, args.seed)
    except DemoValidationError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    failures = [check for check in evidence.checks if not check["passed"]]
    if args.json is not None:
        payload = {
            "base_url": args.base_url,
            "trainee_id": args.trainee_id,
            "seed": args.seed,
            "checks": evidence.checks,
            "scenario_a": evidence.scenario_a,
            "session_a": evidence.session_a,
            "scenario_b": evidence.scenario_b,
            "session_b": evidence.session_b,
            "performance": evidence.performance,
            "history": evidence.history,
            "recommendation": evidence.recommendation,
        }
        args.json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"Evidence written to {args.json}")

    print(
        f"\n{len(evidence.checks) - len(failures)}/{len(evidence.checks)} "
        "validation questions passed."
    )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
