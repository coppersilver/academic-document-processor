import pytest
import sqlite3
from pathlib import Path
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import SCHEMA
from app.prompts.polish import build_polish_prompt
from app.services.openrouter import get_action_messages

@pytest.fixture(autouse=True)
def setup_api_db(tmp_path: Path, monkeypatch):
    test_db = tmp_path / "polish_test.db"
    monkeypatch.setattr("app.config.DB_PATH", test_db)
    monkeypatch.setattr("app.db.database.DB_PATH", test_db)
    monkeypatch.setattr("app.config.SESSION_TOKEN", "test-secret-token")
    monkeypatch.setattr("app.main.SESSION_TOKEN", "test-secret-token")

    with sqlite3.connect(test_db) as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    yield

def test_build_polish_prompt():
    raw_notes = "intro to dyn prog. memoization vs tabulaton. fib sequence."
    fn = "lecture7_notes.txt"

    prompt = build_polish_prompt(raw_notes, fn)
    assert len(prompt) == 2
    assert prompt[0]["role"] == "system"
    assert "note-taking specialist" in prompt[0]["content"]

    user_content = prompt[1]["content"]
    assert "lecture7_notes.txt" in user_content
    assert "Illustrative Examples" in user_content
    assert "LaTeX delimiters" in user_content
    assert "High-Yield Summary & Review Checklist" in user_content
    assert raw_notes in user_content

def test_get_action_messages_polish():
    msgs = get_action_messages(
        action_type="polish",
        document_text="Raw lecture notes",
        filenames=["notes.docx"],
        custom_instructions="Include 2 Python code snippets."
    )
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert "Mathematical & Scientific Notation" in msgs[0]["content"]
    assert "Include 2 Python code snippets." in msgs[1]["content"]

@pytest.mark.asyncio
async def test_api_accepts_polish_action(tmp_path: Path):
    doc_file = tmp_path / "notes.txt"
    doc_file.write_text("Linear algebra notes", encoding="utf-8")

    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer test-secret-token"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/tasks",
            json={
                "filenames": ["notes.txt"],
                "file_paths": [str(doc_file)],
                "action_type": "polish",
                "custom_instructions": "Focus on eigenvalues"
            },
            headers=headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["action_type"] == "polish"
        assert data["status"] in ("PENDING", "PROCESSING")
