"""AAR narrative text: deterministic template by default, optional LLM.

The LLM path is provider-agnostic (any OpenAI-compatible /chat/completions
endpoint) and OPTIONAL: when unset, or on any error/timeout, the
deterministic TemplateNarrator is used. This keeps the system offline-first
and the tests network-free (the poster is injected).

Source of truth: docs/modules/aar_and_adaptive_training.md §5.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Protocol

import httpx

from app import config

if TYPE_CHECKING:
    from app.services.aar import AarFacts


@dataclass(frozen=True)
class AarNarrative:
    summary: str
    recommendation: str


class Narrator(Protocol):
    def narrate(self, facts: "AarFacts") -> AarNarrative: ...


class TemplateNarrator:
    """Deterministic, offline narrator built from the measured metrics."""

    def narrate(self, facts: "AarFacts") -> AarNarrative:
        summary = (
            f"Final score {facts.final_score:.1f}/100: detected {facts.detected}/{facts.total}, "
            f"classified {facts.classified_correct}/{facts.total}, "
            f"responded {facts.responded_correct}/{facts.total}"
        )
        if facts.false_alarms:
            summary += f"; {facts.false_alarms} false alarm(s)"
        summary += "."
        recommendation = f"Focus on {facts.weakest_dimension} in the next session."
        return AarNarrative(summary=summary, recommendation=recommendation)


_Post = Callable[..., Any]


class LlmNarrator:
    """Optional OpenAI-compatible narrator; always falls back to the template."""

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
        timeout_s: float = 5.0,
        post: _Post | None = None,
        fallback: Narrator | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._api_key = api_key
        self._timeout_s = timeout_s
        self._post = post or httpx.post
        self._fallback: Narrator = fallback or TemplateNarrator()

    def _prompt(self, facts: "AarFacts") -> str:
        return (
            "You are an airspace-training instructor writing a brief after-action review. "
            "Use ONLY the metrics provided; do not invent facts. Reply with compact JSON "
            'of the form {"summary": string, "recommendation": string}.\n'
            f"final_score={facts.final_score:.1f}/100; detected={facts.detected}/{facts.total}; "
            f"classified={facts.classified_correct}/{facts.total}; "
            f"responded={facts.responded_correct}/{facts.total}; "
            f"false_alarms={facts.false_alarms}; weakest_dimension={facts.weakest_dimension}."
        )

    def narrate(self, facts: "AarFacts") -> AarNarrative:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        try:
            response = self._post(
                f"{self._base_url}/chat/completions",
                json={
                    "model": self._model,
                    "temperature": 0,
                    "messages": [{"role": "user", "content": self._prompt(facts)}],
                },
                headers=headers,
                timeout=self._timeout_s,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            summary_raw = data.get("summary")
            recommendation_raw = data.get("recommendation")
            if not isinstance(summary_raw, str) or not isinstance(recommendation_raw, str):
                raise ValueError("non-string narrative")
            summary = summary_raw.strip()
            recommendation = recommendation_raw.strip()
            if not summary or not recommendation:
                raise ValueError("empty narrative")
        except Exception:  # noqa: BLE001 — intentional resilience boundary: any LLM/transport failure degrades to the template
            return self._fallback.narrate(facts)
        return AarNarrative(summary=summary, recommendation=recommendation)


def get_narrator() -> Narrator:
    if config.LLM_BASE_URL and config.LLM_MODEL:
        return LlmNarrator(
            base_url=config.LLM_BASE_URL,
            model=config.LLM_MODEL,
            api_key=config.LLM_API_KEY,
            timeout_s=config.LLM_TIMEOUT_S,
        )
    return TemplateNarrator()
