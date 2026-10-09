"""CLI: populate a database with deterministic demo sessions.

Usage (from ``backend/``)::

    python scripts/seed_demo.py
    python scripts/seed_demo.py --sessions 50 --base-seed 20260101
    python scripts/seed_demo.py --database-url sqlite:///./tmp_seed_demo.db

Creates the schema when missing, runs :func:`app.services.demo_seed.seed_demo_data`
and prints a short, deterministic summary.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.config import DATABASE_URL  # noqa: E402
from app.db import models  # noqa: E402,F401  (register table metadata)
from app.db.database import Base  # noqa: E402
from app.services.demo_seed import (  # noqa: E402
    DEFAULT_BASE_SEED,
    DEFAULT_SESSIONS,
    seed_demo_data,
)


def _connect_args(url: str) -> dict[str, object]:
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Seed deterministic demo sessions.")
    parser.add_argument(
        "--sessions", type=int, default=DEFAULT_SESSIONS, help="number of sessions"
    )
    parser.add_argument(
        "--base-seed", type=int, default=DEFAULT_BASE_SEED, help="deterministic RNG seed"
    )
    parser.add_argument(
        "--database-url", default=DATABASE_URL, help="SQLAlchemy database URL"
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    engine = create_engine(args.database_url, connect_args=_connect_args(args.database_url))
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    db = factory()
    try:
        summary = seed_demo_data(
            db, sessions=args.sessions, base_seed=args.base_seed
        )
    finally:
        db.close()
        engine.dispose()

    print(f"database: {args.database_url}")
    print(f"base_seed: {args.base_seed}")
    print(
        f"sessions: {summary.sessions_completed}/{summary.sessions_requested} completed"
    )
    print(f"trainees: {len(summary.trainee_ids)}")
    for trainee_id, count in summary.per_trainee_counts:
        print(f"  {trainee_id}: {count}")
    if summary.final_scores:
        mean = sum(summary.final_scores) / len(summary.final_scores)
        print(
            f"final_score min/mean/max: "
            f"{min(summary.final_scores):.2f}/{mean:.2f}/{max(summary.final_scores):.2f}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
