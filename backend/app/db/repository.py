import json
from datetime import datetime, timezone
from typing import Any
from .database import get_db_connection

def _format_task_row(row) -> dict[str, Any]:
    action_type = row["action_type"]
    queue_type = "doc_converter" if action_type in ("extract_article", "youtube_transcript") else "cloud_llm"
    return {
        "id": row["id"],
        "filenames": json.loads(row["filenames"]),
        "file_paths": json.loads(row["file_paths"]),
        "action_type": action_type,
        "queue_type": queue_type,
        "status": row["status"],
        "output_path": row["output_path"],
        "error_message": row["error_message"],
        "token_count": row["token_count"],
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
        "duration_ms": row["duration_ms"],
    }

async def save_new_task(
    task_id: str,
    filenames: list[str],
    file_paths: list[str],
    action_type: str,
    status: str = "PENDING",
    token_count: int = 0
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    conn = await get_db_connection()
    try:
        await conn.execute(
            """
            INSERT INTO tasks (id, filenames, file_paths, action_type, status, token_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (task_id, json.dumps(filenames), json.dumps(file_paths), action_type, status, token_count, now)
        )
        await conn.commit()
    finally:
        await conn.close()

    queue_type = "doc_converter" if action_type in ("extract_article", "youtube_transcript") else "cloud_llm"
    return {
        "id": task_id,
        "filenames": filenames,
        "file_paths": file_paths,
        "action_type": action_type,
        "queue_type": queue_type,
        "status": status,
        "output_path": "",
        "error_message": "",
        "token_count": token_count,
        "created_at": now,
        "completed_at": "",
        "duration_ms": 0,
    }

async def update_task_progress(
    task_id: str,
    status: str,
    output_path: str = "",
    error_message: str = "",
    duration_ms: int = 0,
    token_count: int | None = None
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn = await get_db_connection()
    try:
        if status in ("COMPLETED", "FAILED", "CANCELLED"):
            if token_count is not None:
                await conn.execute(
                    """
                    UPDATE tasks
                    SET status = ?, output_path = COALESCE(NULLIF(?, ''), output_path),
                        error_message = ?, completed_at = ?, duration_ms = ?, token_count = ?
                    WHERE id = ?
                    """,
                    (status, output_path, error_message, now, duration_ms, token_count, task_id)
                )
            else:
                await conn.execute(
                    """
                    UPDATE tasks
                    SET status = ?, output_path = COALESCE(NULLIF(?, ''), output_path),
                        error_message = ?, completed_at = ?, duration_ms = ?
                    WHERE id = ?
                    """,
                    (status, output_path, error_message, now, duration_ms, task_id)
                )
        else:
            if token_count is not None:
                await conn.execute(
                    "UPDATE tasks SET status = ?, token_count = ? WHERE id = ?",
                    (status, token_count, task_id)
                )
            else:
                await conn.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, task_id))
        await conn.commit()
    finally:
        await conn.close()

async def get_task_by_id(task_id: str) -> dict[str, Any] | None:
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = await cursor.fetchone()
        if row:
            return _format_task_row(row)
        return None
    finally:
        await conn.close()

async def get_all_tasks_history(limit: int = 100) -> list[dict[str, Any]]:
    conn = await get_db_connection()
    try:
        cursor = await conn.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = await cursor.fetchall()
        return [_format_task_row(row) for row in rows]
    finally:
        await conn.close()
