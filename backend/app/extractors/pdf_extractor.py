from pathlib import Path
import logging

logger = logging.getLogger("academic_processor.pdf_extractor")

def extract_pdf_text(file_path: str | Path) -> str:
    """Extracts text and table content from PDF documents."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    extracted_pages: list[str] = []

    # Primary: Fast pypdf extraction (instantaneous, handles text stream across all pages)
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                extracted_pages.append(f"--- Page {i + 1} ---\n{page_text.strip()}")
        if extracted_pages:
            return "\n\n".join(extracted_pages)
    except Exception as e:
        logger.warning(f"pypdf extraction failed for {file_path} ({e}), falling back to pdfplumber...")

    # Secondary: pdfplumber fallback (e.g. for scanned or complex tabular layouts)
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if text.strip():
                    extracted_pages.append(f"--- Page {i + 1} ---\n{text.strip()}")
        if extracted_pages:
            return "\n\n".join(extracted_pages)
    except Exception as e:
        logger.error(f"pdfplumber extraction failed for {file_path}: {e}")
        raise RuntimeError(f"Failed to extract text from PDF {path.name}: {e}")

    return ""
