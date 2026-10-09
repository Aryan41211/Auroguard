"""Runtime configuration (offline-first, env-overridable)."""

from __future__ import annotations

import os

DATABASE_URL: str = os.environ.get(
    "AEROGUARD_DATABASE_URL", "sqlite:///./aeroguard.db"
)

# Optional OpenAI-compatible narrator for AAR summary/recommendation.
# Unset => deterministic templated text (offline default).
LLM_BASE_URL: str | None = os.environ.get("AEROGUARD_LLM_BASE_URL")
LLM_API_KEY: str | None = os.environ.get("AEROGUARD_LLM_API_KEY")
LLM_MODEL: str | None = os.environ.get("AEROGUARD_LLM_MODEL")
LLM_TIMEOUT_S: float = float(os.environ.get("AEROGUARD_LLM_TIMEOUT_S", "5"))
