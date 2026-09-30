import pytest
import sqlite3
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import SCHEMA, DEFAULT_PRESETS

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path: Path, monkeypatch):
    test_db = tmp_path / "presets_test.db"
    monkeypatch.setattr("app.config.DB_PATH", test_db)
    monkeypatch.setattr("app.db.database.DB_PATH", test_db)
    monkeypatch.setattr("app.config.SESSION_TOKEN", "test-token")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "test-token")

    with sqlite3.connect(test_db) as conn:
        conn.executescript(SCHEMA)
        for p in DEFAULT_PRESETS:
            conn.execute(
                "INSERT INTO instruction_presets (id, title, instructions, is_default, created_at) VALUES (?, ?, ?, ?, ?)",
                (p["id"], p["title"], p["instructions"], p["is_default"], "2026-01-01T00:00:00Z")
            )
        conn.commit()
    yield

@pytest.mark.asyncio
async def test_get_presets_returns_seeded_defaults():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/presets", headers={"Authorization": "Bearer test-token"})
        assert resp.status_code == 200
        presets = resp.json()
        assert len(presets) >= 4
        titles = [p["title"] for p in presets]
        assert "Focus on Proofs & Derivations" in titles
        assert "Exam Preparation & High-Yield" in titles
        assert any(p["is_default"] for p in presets)

@pytest.mark.asyncio
async def test_create_and_delete_custom_preset():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create
        create_resp = await client.post(
            "/api/presets",
            headers={"Authorization": "Bearer test-token"},
            json={
                "title": "Quantum Physics Focus",
                "instructions": "Focus on Hamiltonians, wave equations, and matrix mechanics."
            }
        )
        assert create_resp.status_code == 201
        created = create_resp.json()
        assert created["title"] == "Quantum Physics Focus"
        assert created["instructions"] == "Focus on Hamiltonians, wave equations, and matrix mechanics."
        assert created["is_default"] is False
        preset_id = created["id"]

        # Verify listed
        list_resp = await client.get("/api/presets", headers={"Authorization": "Bearer test-token"})
        assert any(p["id"] == preset_id for p in list_resp.json())

        # Update
        update_resp = await client.put(
            f"/api/presets/{preset_id}",
            headers={"Authorization": "Bearer test-token"},
            json={
                "title": "Quantum Physics & Dirac Notation",
                "instructions": "Emphasize bra-ket notation and Hilbert spaces."
            }
        )
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated["title"] == "Quantum Physics & Dirac Notation"

        # Delete
        del_resp = await client.delete(f"/api/presets/{preset_id}", headers={"Authorization": "Bearer test-token"})
        assert del_resp.status_code == 200

        # Verify no longer present
        list_resp2 = await client.get("/api/presets", headers={"Authorization": "Bearer test-token"})
        assert not any(p["id"] == preset_id for p in list_resp2.json())

@pytest.mark.asyncio
async def test_reset_presets_restores_defaults():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Add custom preset
        await client.post(
            "/api/presets",
            headers={"Authorization": "Bearer test-token"},
            json={"title": "Temporary Custom", "instructions": "Temp instruction"}
        )

        # Reset
        reset_resp = await client.post("/api/presets/reset", headers={"Authorization": "Bearer test-token"})
        assert reset_resp.status_code == 200
        presets = reset_resp.json()

        assert len(presets) == 4
        assert not any(p["title"] == "Temporary Custom" for p in presets)
        assert all(p["is_default"] for p in presets)
