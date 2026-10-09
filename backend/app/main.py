from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.scenarios import router as scenarios_router
from app.db.database import init_db
from app.services.anti_repetition import RecentConfigTracker


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="AEROVIGIL API", version="1.0.0", lifespan=lifespan)
app.state.recent_configs = RecentConfigTracker()

app.include_router(scenarios_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
