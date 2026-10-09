from pathlib import Path

import yaml
from fastapi.routing import APIRoute

from app.main import app

CONTRACT = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.yaml"
NON_CONTRACT_ROUTES = {"/health"}


def _contract_paths() -> set[str]:
    spec = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return set(spec["paths"])


def _app_paths() -> set[str]:
    return {route.path for route in app.routes if isinstance(route, APIRoute)}


def test_every_implemented_route_is_in_the_contract() -> None:
    undocumented = (_app_paths() - NON_CONTRACT_ROUTES) - _contract_paths()
    assert undocumented == set(), f"routes missing from contract: {sorted(undocumented)}"


def test_health_is_the_only_non_v1_route() -> None:
    non_v1 = {path for path in _app_paths() if not path.startswith("/api/v1")}
    assert non_v1 == NON_CONTRACT_ROUTES
