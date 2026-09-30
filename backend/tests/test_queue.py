import pytest
import sqlite3
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch
from app.db.database import SCHEMA
from app.queues.manager import queue_manager

@pytest.fixture(autouse=True)
def setup_queue_db(tmp_path: Path, monkeypatch):
    test_db = tmp_path / "queue_test.db"
    monkeypatch.setattr("app.config.DB_PATH", test_db)
    monkeypatch.setattr("app.db.database.DB_PATH", test_db)

    with sqlite3.connect(test_db) as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    yield

@pytest.mark.asyncio
async def test_plaintext_bypass(tmp_path: Path):
    text_file = tmp_path / "notes.md"
    text_file.write_text("# Academic Notes\nDeep Learning architectures.", encoding="utf-8")

    task = await queue_manager.enqueue_task(
        task_id="test-pt-1",
        filenames=["notes.md"],
        file_paths=[str(text_file)],
        action_type="summary",
        output_dir=str(tmp_path)
    )

    assert task["id"] == "test-pt-1"
    active = queue_manager.active_tasks.get("test-pt-1")
    assert active is not None
    # Verify plaintext bypass assigned queue_type to cloud_llm directly
    assert active["queue_type"] == "cloud_llm"
    assert "Deep Learning architectures" in active["extracted_text"]
    assert active["token_count"] > 0

@pytest.mark.asyncio
async def test_binary_routing(tmp_path: Path):
    fake_pdf = tmp_path / "paper.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 ...")

    task = await queue_manager.enqueue_task(
        task_id="test-bin-1",
        filenames=["paper.pdf"],
        file_paths=[str(fake_pdf)],
        action_type="summary",
        output_dir=str(tmp_path)
    )

    assert task["id"] == "test-bin-1"
    active = queue_manager.active_tasks.get("test-bin-1")
    assert active is not None
    assert active["queue_type"] == "doc_converter"
