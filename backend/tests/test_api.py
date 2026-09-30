import pytest
import sqlite3
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import SCHEMA

@pytest.fixture(autouse=True)
def setup_api_db(tmp_path: Path, monkeypatch):
    test_db = tmp_path / "api_test.db"
    monkeypatch.setattr("app.config.DB_PATH", test_db)
    monkeypatch.setattr("app.db.database.DB_PATH", test_db)
    monkeypatch.setattr("app.config.SESSION_TOKEN", "test-secret-token")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "test-secret-token")

    with sqlite3.connect(test_db) as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    yield

@pytest.mark.asyncio
async def test_health_check_unauthenticated():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "available_models" in data

@pytest.mark.asyncio
async def test_cors_preflight_options():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Preflight OPTIONS request without Authorization header must succeed with 200
        resp = await client.options(
            "/api/documents/inspect",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type"
            }
        )
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers

@pytest.mark.asyncio
async def test_auth_middleware_rejection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Request without token
        resp = await client.get("/api/settings")
        assert resp.status_code == 401

        # Request with invalid token
        resp = await client.get("/api/settings", headers={"Authorization": "Bearer invalid-token"})
        assert resp.status_code == 401

@pytest.mark.asyncio
async def test_authenticated_settings():
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer test-secret-token"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Get settings
        resp = await client.get("/api/settings", headers=headers)
        assert resp.status_code == 200

        # Update settings
        resp = await client.post(
            "/api/settings",
            json={"selected_model": "anthropic/claude-3.7-sonnet"},
            headers=headers
        )
        assert resp.status_code == 200
        assert resp.json()["selected_model"] == "anthropic/claude-3.7-sonnet"
