from pathlib import Path

def extract_text_file(file_path: str | Path) -> str:
    """Reads plaintext and markdown files with encoding fallbacks."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    for enc in encodings:
        try:
            return path.read_text(encoding=enc)
        except (UnicodeDecodeError, UnicodeError):
            continue

    # Final binary fallback with error replacement
    return path.read_bytes().decode("utf-8", errors="replace")
