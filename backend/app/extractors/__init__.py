from pathlib import Path
import tiktoken
from ..config import TOKEN_WARNING_THRESHOLD
from .text_extractor import extract_text_file
from .pdf_extractor import extract_pdf_text
from .docx_extractor import extract_docx_text
from .pptx_extractor import extract_pptx_text
from .checksum import compute_file_hash
from ..db.cache_repository import get_cached_extraction_sync, save_cached_extraction_sync

# Initialize tokenizer once
try:
    _encoder = tiktoken.get_encoding("cl100k_base")
except Exception:
    _encoder = None

def is_binary_format(file_path: str | Path) -> bool:
    """Returns True if the document requires binary parsing (PDF, DOCX, PPTX)."""
    ext = Path(file_path).suffix.lower()
    return ext in {".pdf", ".docx", ".pptx"}

def extract_document_text(file_path: str | Path) -> str:
    """Extracts text from any supported document format."""
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext in {".txt", ".md"}:
        return extract_text_file(path)
    elif ext == ".pdf":
        return extract_pdf_text(path)
    elif ext == ".docx":
        return extract_docx_text(path)
    elif ext == ".pptx":
        return extract_pptx_text(path)
    else:
        # Attempt plaintext fallback
        return extract_text_file(path)

def count_tokens(text: str) -> int:
    """Accurately and instantly counts tokens using tiktoken (cl100k_base)."""
    if not text:
        return 0
    if _encoder is not None:
        try:
            return len(_encoder.encode(text, disallowed_special=()))
        except Exception:
            pass
    # Fast fallback: ~4 characters per token in English
    return max(1, len(text) // 4)

def get_cached_or_extract(file_path: str | Path) -> tuple[str, int]:
    """Retrieves extracted text and token count from Tier 1 SQLite cache, or extracts and caches it."""
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found or not a regular file: {file_path}")

    file_hash = compute_file_hash(path)
    cached = get_cached_extraction_sync(file_hash)
    if cached is not None:
        return cached["extracted_text"], cached["token_count"]

    # Cache miss: extract fresh
    text = extract_document_text(path)
    tok_cnt = count_tokens(text)
    file_size = path.stat().st_size
    save_cached_extraction_sync(
        file_hash=file_hash,
        file_size=file_size,
        extracted_text=text,
        token_count=tok_cnt,
        char_count=len(text)
    )
    return text, tok_cnt

def inspect_document(file_path: str | Path) -> dict:
    """Performs instant pre-flight inspection of a document, using Tier 1 cache when available."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    file_hash = compute_file_hash(path)
    cached = get_cached_extraction_sync(file_hash)
    if cached is not None:
        return {
            "file_name": path.name,
            "file_path": str(path.resolve()),
            "file_size": cached["file_size"],
            "char_count": cached["char_count"],
            "token_count": cached["token_count"],
            "is_binary": is_binary_format(path),
            "cached": True,
        }

    size_bytes = path.stat().st_size
    text = extract_document_text(path)
    token_cnt = count_tokens(text)
    char_cnt = len(text)

    save_cached_extraction_sync(
        file_hash=file_hash,
        file_size=size_bytes,
        extracted_text=text,
        token_count=token_cnt,
        char_count=char_cnt
    )

    return {
        "file_name": path.name,
        "file_path": str(path.resolve()),
        "file_size": size_bytes,
        "char_count": char_cnt,
        "token_count": token_cnt,
        "is_binary": is_binary_format(path),
        "cached": False,
    }

def inspect_documents(file_paths: list[str]) -> dict:
    """Inspects one or multiple documents and returns combined statistics."""
    files_info = []
    total_tokens = 0
    total_chars = 0
    total_size = 0

    for fp in file_paths:
        info = inspect_document(fp)
        files_info.append(info)
        total_tokens += info["token_count"]
        total_chars += info["char_count"]
        total_size += info["file_size"]

    is_large = total_tokens > TOKEN_WARNING_THRESHOLD

    return {
        "files": files_info,
        "total_files": len(files_info),
        "total_tokens": total_tokens,
        "total_chars": total_chars,
        "total_size": total_size,
        "is_large": is_large,
        "warning_threshold": TOKEN_WARNING_THRESHOLD,
    }
