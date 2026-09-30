import pytest
from pathlib import Path
from app.extractors import extract_document_text, count_tokens, inspect_documents, is_binary_format

def test_plaintext_extraction(tmp_path: Path):
    sample_file = tmp_path / "sample.txt"
    sample_file.write_text("Introduction to Machine Learning\nLecture 1: Gradient Descent.", encoding="utf-8")

    assert not is_binary_format(sample_file)
    text = extract_document_text(sample_file)
    assert "Gradient Descent" in text

def test_token_counting():
    text = "The quick brown fox jumps over the lazy dog."
    tokens = count_tokens(text)
    assert 5 <= tokens <= 15

def test_inspect_documents(tmp_path: Path):
    doc1 = tmp_path / "doc1.md"
    doc1.write_text("# Chapter 1\nFoundations of Computer Systems.", encoding="utf-8")
    doc2 = tmp_path / "doc2.txt"
    doc2.write_text("Syllabus: Exam on October 15th.", encoding="utf-8")

    res = inspect_documents([str(doc1), str(doc2)])
    assert res["total_files"] == 2
    assert res["total_tokens"] > 0
    assert not res["is_large"]
    assert len(res["files"]) == 2
