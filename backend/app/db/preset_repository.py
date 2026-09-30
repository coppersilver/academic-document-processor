import uuid
from datetime import datetime, timezone
from typing import Any
from .database import get_db_connection, DEFAULT_PRESETS

def _format_preset_row(row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "instructions": row["instructions"],
        "is_default": bool(row["is_default"]),
        "created_at": row["created_at"],
    }

async def get_all_presets() -> list[dict[str, Any]]:
    """Retrieve all instruction presets ordered by created_at."""
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, title, instructions, is_default, created_at FROM instruction_presets ORDER BY is_default DESC, created_at ASC"
        )
        rows = await cursor.fetchall()
        return [_format_preset_row(r) for r in rows]
    finally:
        await conn.close()

async def create_preset(title: str, instructions: str, is_default: int = 0) -> dict[str, Any]:
    """Create and persist a new instruction preset."""
    preset_id = f"preset_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()
    conn = await get_db_connection()
    try:
        await conn.execute(
            """
            INSERT INTO instruction_presets (id, title, instructions, is_default, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (preset_id, title.strip(), instructions.strip(), is_default, now)
        )
        await conn.commit()
    finally:
        await conn.close()

    return {
        "id": preset_id,
        "title": title.strip(),
        "instructions": instructions.strip(),
        "is_default": bool(is_default),
        "created_at": now,
    }

async def update_preset(preset_id: str, title: str, instructions: str) -> dict[str, Any] | None:
    """Update an existing instruction preset."""
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "SELECT id, title, instructions, is_default, created_at FROM instruction_presets WHERE id = ?",
            (preset_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None

        await conn.execute(
            """
            UPDATE instruction_presets
            SET title = ?, instructions = ?
            WHERE id = ?
            """,
            (title.strip(), instructions.strip(), preset_id)
        )
        await conn.commit()

        return {
            "id": preset_id,
            "title": title.strip(),
            "instructions": instructions.strip(),
            "is_default": bool(row["is_default"]),
            "created_at": row["created_at"],
        }
    finally:
        await conn.close()

async def delete_preset(preset_id: str) -> bool:
    """Delete an instruction preset by ID."""
    conn = await get_db_connection()
    try:
        cursor = await conn.execute(
            "DELETE FROM instruction_presets WHERE id = ?",
            (preset_id,)
        )
        await conn.commit()
        return cursor.rowcount > 0
    finally:
        await conn.close()

async def reset_to_default_presets() -> list[dict[str, Any]]:
    """Clear all presets and re-seed the default academic presets."""
    now = datetime.now(timezone.utc).isoformat()
    conn = await get_db_connection()
    try:
        await conn.execute("DELETE FROM instruction_presets")
        for p in DEFAULT_PRESETS:
            await conn.execute(
                """
                INSERT INTO instruction_presets (id, title, instructions, is_default, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (p["id"], p["title"], p["instructions"], p["is_default"], now)
            )
        await conn.commit()
    finally:
        await conn.close()

    return await get_all_presets()
