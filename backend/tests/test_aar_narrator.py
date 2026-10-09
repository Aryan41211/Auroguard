from __future__ import annotations

from app.schemas.aar import TimingMetrics
from app.services import aar_narrator
from app.services.aar import AarFacts
from app.services.aar_narrator import (
    AarNarrative,
    LlmNarrator,
    TemplateNarrator,
    get_narrator,
)


def _facts() -> AarFacts:
    return AarFacts(
        session_id="SES-1", scenario_id="SCN-1", final_score=85.0, detected=1, total=1,
        classified_correct=1, responded_correct=1, false_alarms=0, timing=TimingMetrics(),
        mistakes=(), strengths=(), weaknesses=(), weakest_dimension="response",
    )


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_template_narrator_is_deterministic_and_cites_metrics() -> None:
    narrative = TemplateNarrator().narrate(_facts())
    assert isinstance(narrative, AarNarrative)
    assert "85.0" in narrative.summary
    assert "1/1" in narrative.summary
    assert "response" in narrative.recommendation


def test_llm_narrator_returns_parsed_json() -> None:
    calls: list[dict] = []

    def fake_post(url, json, headers, timeout):
        calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        content = '{"summary": "Nice work.", "recommendation": "Push timing."}'
        return _FakeResponse({"choices": [{"message": {"content": content}}]})

    narrator = LlmNarrator("http://llm.local/v1", "test-model", api_key="secret", post=fake_post)
    narrative = narrator.narrate(_facts())
    assert narrative == AarNarrative(summary="Nice work.", recommendation="Push timing.")
    assert calls[0]["url"] == "http://llm.local/v1/chat/completions"
    assert calls[0]["headers"]["Authorization"] == "Bearer secret"
    assert calls[0]["json"]["model"] == "test-model"


def test_llm_narrator_falls_back_on_error() -> None:
    def boom(url, json, headers, timeout):
        raise RuntimeError("network down")

    narrator = LlmNarrator("http://llm.local/v1", "m", post=boom)
    narrative = narrator.narrate(_facts())
    assert narrative == TemplateNarrator().narrate(_facts())


def test_llm_narrator_falls_back_on_json_null() -> None:
    def fake_post(url, json, headers, timeout):
        content = '{"summary": null, "recommendation": null}'
        return _FakeResponse({"choices": [{"message": {"content": content}}]})

    narrator = LlmNarrator("http://llm.local/v1", "m", post=fake_post)
    assert narrator.narrate(_facts()) == TemplateNarrator().narrate(_facts())


def test_llm_narrator_falls_back_on_bad_json() -> None:
    def bad(url, json, headers, timeout):
        return _FakeResponse({"choices": [{"message": {"content": "not json"}}]})

    narrator = LlmNarrator("http://llm.local/v1", "m", post=bad)
    assert narrator.narrate(_facts()) == TemplateNarrator().narrate(_facts())


def test_get_narrator_defaults_to_template(monkeypatch) -> None:
    monkeypatch.setattr(aar_narrator.config, "LLM_BASE_URL", None)
    monkeypatch.setattr(aar_narrator.config, "LLM_MODEL", None)
    assert isinstance(get_narrator(), TemplateNarrator)


def test_get_narrator_uses_llm_when_configured(monkeypatch) -> None:
    monkeypatch.setattr(aar_narrator.config, "LLM_BASE_URL", "http://llm.local/v1")
    monkeypatch.setattr(aar_narrator.config, "LLM_MODEL", "m")
    monkeypatch.setattr(aar_narrator.config, "LLM_API_KEY", None)
    assert isinstance(get_narrator(), LlmNarrator)
