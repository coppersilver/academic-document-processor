import sqlite3
import aiosqlite
from pathlib import Path
from ..config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    filenames TEXT NOT NULL,
    file_paths TEXT NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL,
    output_path TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    token_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT DEFAULT '',
    duration_ms INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

CREATE TABLE IF NOT EXISTS document_cache (
    file_hash TEXT PRIMARY KEY,
    file_size INTEGER NOT NULL,
    extracted_text TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    char_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    last_accessed TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS instruction_presets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presets_created_at ON instruction_presets(created_at ASC);
"""

DEFAULT_PRESETS = [
    {
        "id": "preset_proofs",
        "title": "Focus on Proofs & Derivations",
        "instructions": "Focus heavily on mathematical proofs, derivations, and step-by-step logic. Preserve all equations and highlight key theorem statements.",
        "is_default": 1,
    },
    {
        "id": "preset_exam_prep",
        "title": "Exam Preparation & High-Yield",
        "instructions": "Emphasize high-yield concepts, potential exam questions, core definitions, and formula sheets.",
        "is_default": 1,
    },
    {
        "id": "preset_eli5",
        "title": "Intuitive Conceptual Explanation (ELI5)",
        "instructions": "Explain complex theoretical concepts in intuitive, plain language using concrete analogies and practical examples.",
        "is_default": 1,
    },
    {
        "id": "preset_medical",
        "title": "Clinical & Medical Relevance",
        "instructions": "Highlight clinical applications, pathophysiology, diagnostic criteria, and mechanisms of action.",
        "is_default": 1,
    },
]

async def init_db() -> None:
    """Initialize SQLite database schema and seed default presets if empty."""
    from datetime import datetime, timezone
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()

        # Check if presets table is empty
        cursor = await db.execute("SELECT COUNT(*) FROM instruction_presets")
        count = (await cursor.fetchone())[0]
        if count == 0:
            now = datetime.now(timezone.utc).isoformat()
            for p in DEFAULT_PRESETS:
                await db.execute(
                    """
                    INSERT INTO instruction_presets (id, title, instructions, is_default, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (p["id"], p["title"], p["instructions"], p["is_default"], now)
                )
            await db.commit()

async def get_db_connection():
    """Get an async database connection."""
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    return conn

def get_sync_db_connection() -> sqlite3.Connection:
    """Get a synchronous SQLite connection for worker threads."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
