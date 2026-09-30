import logging
from datetime import datetime, timezone
from typing import Any
from .database import get_db_connection, get_sync_db_connection

logger = logging.getLogger("academic_processor.cache_repository")

def get_cached_extraction_sync(file_hash: str) -> dict[str, Any] | None:
    """Synchronously retrieves cached document extraction by SHA-256 file hash."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        with get_sync_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT file_hash, file_size, extracted_text, token_count, char_count FROM document_cache WHERE file_hash = ?",
                (file_hash,)
            )
            row = cursor.fetchone()
            if row:
                # Update last_accessed timestamp
                cursor.execute(
                    "UPDATE document_cache SET last_accessed = ? WHERE file_hash = ?",
                    (now_iso, file_hash)
                )
                conn.commit()
                return {
                    "file_hash": row["file_hash"],
                    "file_size": row["file_size"],
                    "extracted_text": row["extracted_text"],
                    "token_count": row["token_count"],
                    "char_count": row["char_count"],
                }
            return None
    except Exception as e:
        logger.warning(f"Error reading extraction cache for {file_hash[:8]}: {e}")
        return None

def save_cached_extraction_sync(
    file_hash: str,
    file_size: int,
    extracted_text: str,
    token_count: int,
    char_count: int
) -> None:
    """Synchronously saves or updates document extraction in the SQLite cache."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        with get_sync_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO document_cache (file_hash, file_size, extracted_text, token_count, char_count, created_at, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_hash) DO UPDATE SET
                    file_size = excluded.file_size,
                    extracted_text = excluded.extracted_text,
                    token_count = excluded.token_count,
                    char_count = excluded.char_count,
                    last_accessed = excluded.last_accessed
                """,
                (file_hash, file_size, extracted_text, token_count, char_count, now_iso, now_iso)
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"Error saving extraction cache for {file_hash[:8]}: {e}")

async def get_cached_extraction(file_hash: str) -> dict[str, Any] | None:
    """Asynchronously retrieves cached document extraction by SHA-256 file hash."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        async with await get_db_connection() as conn:
            async with conn.execute(
                "SELECT file_hash, file_size, extracted_text, token_count, char_count FROM document_cache WHERE file_hash = ?",
                (file_hash,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    await conn.execute(
                        "UPDATE document_cache SET last_accessed = ? WHERE file_hash = ?",
                        (now_iso, file_hash)
                    )
                    await conn.commit()
                    return {
                        "file_hash": row["file_hash"],
                        "file_size": row["file_size"],
                        "extracted_text": row["extracted_text"],
                        "token_count": row["token_count"],
                        "char_count": row["char_count"],
                    }
                return None
    except Exception as e:
        logger.warning(f"Error async reading extraction cache for {file_hash[:8]}: {e}")
        return None

async def save_cached_extraction(
    file_hash: str,
    file_size: int,
    extracted_text: str,
    token_count: int,
    char_count: int
) -> None:
    """Asynchronously saves document extraction in the SQLite cache."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        async with await get_db_connection() as conn:
            await conn.execute(
                """
                INSERT INTO document_cache (file_hash, file_size, extracted_text, token_count, char_count, created_at, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(file_hash) DO UPDATE SET
                    file_size = excluded.file_size,
                    extracted_text = excluded.extracted_text,
                    token_count = excluded.token_count,
                    char_count = excluded.char_count,
                    last_accessed = excluded.last_accessed
                """,
                (file_hash, file_size, extracted_text, token_count, char_count, now_iso, now_iso)
            )
            await conn.commit()
    except Exception as e:
        logger.warning(f"Error async saving extraction cache for {file_hash[:8]}: {e}")
