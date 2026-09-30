import hashlib
from pathlib import Path

def compute_file_hash(file_path: str | Path, chunk_size: int = 65536) -> str:
    """Computes a SHA-256 hexadecimal hash for the file at file_path.
    Reads in 64KB chunks for high performance and low memory consumption.
    """
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found or not a regular file: {file_path}")

    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            hasher.update(chunk)

    return hasher.hexdigest()
