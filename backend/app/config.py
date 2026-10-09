"""Runtime configuration (offline-first, env-overridable)."""

from __future__ import annotations

import os

DATABASE_URL: str = os.environ.get(
    "AEROVIGIL_DATABASE_URL", "sqlite:///./aerovigil.db"
)
