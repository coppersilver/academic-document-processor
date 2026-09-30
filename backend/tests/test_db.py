import pytest
import sqlite3
from pathlib import Path
from app.db.database import SCHEMA
from app.db import repository

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path: Path, monkeypatch):
    test_db = tmp_path / "test.db"
    monkeypatch.setattr("app.config.DB_PATH", test_db)
    monkeypatch.setattr("app.db.database.DB_PATH", test_db)

    with sqlite3.connect(test_db) as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    yield

@pytest.mark.asyncio
async def test_task_crud():
    task_id = "test-task-123"
    saved = await repository.save_new_task(
        task_id=task_id,
        filenames=["paper.pdf"],
        file_paths=["/path/to/paper.pdf"],
        action_type="summary",
        status="PENDING",
        token_count=1200
    )
    assert saved["id"] == task_id
    assert saved["status"] == "PENDING"

    # Update progress
    await repository.update_task_progress(
        task_id=task_id,
        status="COMPLETED",
        output_path="/path/to/outputs/summary.md",
        duration_ms=450
    )

    retrieved = await repository.get_task_by_id(task_id)
    assert retrieved is not None
    assert retrieved["status"] == "COMPLETED"
    assert retrieved["output_path"] == "/path/to/outputs/summary.md"
    assert retrieved["duration_ms"] == 450

    all_tasks = await repository.get_all_tasks_history()
    assert len(all_tasks) >= 1
