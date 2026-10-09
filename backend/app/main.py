from fastapi import FastAPI

from app.api.scenarios import router as scenarios_router
from app.services.anti_repetition import RecentConfigTracker

app = FastAPI(title="AEROVIGIL API", version="1.0.0")
app.state.recent_configs = RecentConfigTracker()

app.include_router(scenarios_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
