from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_preflight_allows_vite_origin() -> None:
    response = client.options(
        "/api/v1/scenarios/generate",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_simple_request_gets_allow_origin_header() -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_preflight_allows_dashboard_origin() -> None:
    response = client.options(
        "/api/v1/scenarios/generate",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5174"


def test_preflight_allows_dashboard_loopback_origin() -> None:
    response = client.options(
        "/api/v1/scenarios/generate",
        headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_simple_request_gets_dashboard_allow_origin_header() -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5174"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5174"
