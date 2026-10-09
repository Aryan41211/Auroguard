from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.schemas.events import EventCreateRequest
from app.schemas.scenario import Scenario
from app.services.scoring import score

GOLDEN = Path(__file__).parent / "golden" / "scoring_cases.json"
CASES = json.loads(GOLDEN.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_golden_scoring_case(case: dict) -> None:
    scenario = Scenario(**case["scenario"])
    events = [EventCreateRequest(**event) for event in case["events"]]
    result = score("SES-TEST", scenario, events)
    assert result.model_dump(exclude={"session_id"}) == case["expected"]
