"""Tests for the end-to-end demo validation script.

The script normally talks HTTP; here it is driven through FastAPI's TestClient
so the whole demo sequence and all five validation questions are covered
without a live server.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from scripts.validate_demo import DemoValidationError, Api, run


class _TestClientApi(Api):
    """Adapter that satisfies the script's Api protocol via TestClient."""

    def __init__(self, client: TestClient) -> None:
        self.base_url = "testclient"
        self.timeout = 10.0
        self._client = client

    def get(self, path: str) -> dict[str, Any]:
        response = self._client.get(path)
        assert response.status_code == 200, response.text
        return response.json()

    def post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        response = self._client.post(path, json=body)
        assert response.status_code < 400, response.text
        return response.json()


def test_validate_demo_answers_all_five_questions(client: TestClient) -> None:
    evidence = run(_TestClientApi(client), "DEMO-TEST", 4242)

    assert [check["passed"] for check in evidence.checks] == [True] * 5
    assert evidence.scenario_a["seed"] == 4242
    assert evidence.performance["session_count"] >= 2
    assert evidence.recommendation["reason"].strip()
    assert len(evidence.session_a["aar"]["mistakes"]) >= 1


def test_validate_demo_reports_unreachable_api() -> None:
    api = Api("http://127.0.0.1:9", timeout=0.5)
    try:
        run(api, "DEMO-TEST", 4242)
    except DemoValidationError as exc:
        assert "cannot reach" in str(exc)
    else:  # pragma: no cover - only on an unexpectedly open port
        raise AssertionError("expected DemoValidationError")
