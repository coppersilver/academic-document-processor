import pytest
import sqlite3
from pathlib import Path
from app.extractors.checksum import compute_file_hash
from app.extractors import get_cached_or_extract, inspect_document
from app.db.database import SCHEMA

@pytest.fixture(autouse=True)
def setup_cache_db(tmp_path: Path, monkeypatch):
    test_db = tmp_path / "cache_test.db"
    monkeypatch.setattr("app.config.DB_PATH", test_db)
    monkeypatch.setattr("app.db.database.DB_PATH", test_db)

    with sqlite3.connect(test_db) as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    yield

def test_compute_file_hash(tmp_path: Path):
    f = tmp_path / "sample.txt"
    f.write_text("Hello, academic caching!", encoding="utf-8")

    h1 = compute_file_hash(f)
    assert len(h1) == 64
    assert isinstance(h1, str)

    # Identical content yields identical hash
    f2 = tmp_path / "sample2.txt"
    f2.write_text("Hello, academic caching!", encoding="utf-8")
    assert compute_file_hash(f2) == h1

    # Modified content yields different hash
    f.write_text("Modified content", encoding="utf-8")
    assert compute_file_hash(f) != h1

def test_tier_1_caching_and_invalidation(tmp_path: Path):
    f = tmp_path / "paper.txt"
    f.write_text("This is an academic research document on neural network architectures.", encoding="utf-8")

    # 1. First inspection: Cache Miss
    info1 = inspect_document(f)
    assert info1["cached"] is False
    assert info1["token_count"] > 0
    assert info1["char_count"] == len(f.read_text())

    # 2. Second inspection: Cache Hit
    info2 = inspect_document(f)
    assert info2["cached"] is True
    assert info2["token_count"] == info1["token_count"]
    assert info2["char_count"] == info1["char_count"]

    # 3. get_cached_or_extract: Cache Hit
    text, tokens = get_cached_or_extract(f)
    assert text == f.read_text()
    assert tokens == info1["token_count"]

    # 4. Modifying file on disk invalidates cache
    f.write_text("Completely updated content with different length and words.", encoding="utf-8")
    info3 = inspect_document(f)
    assert info3["cached"] is False
    assert info3["token_count"] != info1["token_count"]
    assert info3["char_count"] == len(f.read_text())
