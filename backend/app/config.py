"""Runtime configuration (offline-first, env-overridable)."""

from __future__ import annotations

import os

DATABASE_URL: str = os.environ.get(
    "AEROGUARD_DATABASE_URL", "sqlite:///./aeroguard.db"
)
