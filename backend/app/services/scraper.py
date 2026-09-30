import os
import re
import tempfile
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
import httpx
from bs4 import BeautifulSoup
import trafilatura

from ..config import settings
from ..extractors import count_tokens, extract_document_text

logger = logging.getLogger("academic_processor.scraper")

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)

MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024  # 15 MB cap


def sanitize_filename(name: str) -> str:
    """Removes unsafe characters for file naming."""
    clean = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name)
    return clean.strip('_') or "web_article"


def preprocess_html_math(html_content: str) -> str:
    """
    Pre-processes HTML to convert MathJax, KaTeX, and MathML formulas into
    standard LaTeX delimiters ($...$ and $$...$$) before feeding into Trafilatura.
    """
    try:
        soup = BeautifulSoup(html_content, "html.parser")

        # 1. Handle MathJax script tags
        for script in soup.find_all("script", attrs={"type": re.compile(r"^math/tex")}):
            script_type = script.get("type", "")
            tex_code = script.string or script.get_text() or ""
            tex_code = tex_code.strip()
            if not tex_code:
                continue

            if "mode=display" in script_type:
                script.replace_with(f"\n\n$${tex_code}$$\n\n")
            else:
                script.replace_with(f" ${tex_code}$ ")

        # 2. Handle KaTeX display containers
        for display_block in soup.find_all(class_=re.compile(r"\bkatex-display\b")):
            tex_annot = display_block.find("annotation", attrs={"encoding": "application/x-tex"})
            if tex_annot and tex_annot.get_text().strip():
                display_block.replace_with(f"\n\n$${tex_annot.get_text().strip()}$$\n\n")

        # 3. Handle inline KaTeX
        for inline_katex in soup.find_all(class_=re.compile(r"\bkatex\b")):
            tex_annot = inline_katex.find("annotation", attrs={"encoding": "application/x-tex"})
            if tex_annot and tex_annot.get_text().strip():
                inline_katex.replace_with(f" ${tex_annot.get_text().strip()}$ ")

        # 4. Handle remaining MathML tags
        for math_tag in soup.find_all("math"):
            tex_annot = math_tag.find("annotation", attrs={"encoding": "application/x-tex"})
            if tex_annot and tex_annot.get_text().strip():
                is_display = math_tag.get("display") == "block"
                code = tex_annot.get_text().strip()
                math_tag.replace_with(f"\n\n$${code}$$\n\n" if is_display else f" ${code}$ ")
            elif math_tag.get("alt"):
                alt_text = math_tag.get("alt").strip()
                math_tag.replace_with(f" ${alt_text}$ ")

        return str(soup)
    except Exception as e:
        logger.warning(f"Error during HTML math pre-processing: {e}")
        return html_content


async def fetch_and_extract_article(
    url: str,
    target_output_dir: str | None = None
) -> dict[str, Any]:
    """
    Fetches a web page or academic link, extracts article content with boilerplate
    removal, preserves LaTeX math, and writes clean Markdown to target_output_dir.
    """
    clean_url = url.strip()
    if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        clean_url = f"https://{clean_url}"

    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
    }

    logger.info(f"Fetching URL for article extraction: {clean_url}")

    async with httpx.AsyncClient(timeout=12.0, follow_redirects=True, headers=headers) as client:
        try:
            # Check headers first via streaming or GET
            resp = await client.get(clean_url)
        except httpx.TimeoutException:
            raise RuntimeError(f"Request timed out while connecting to {clean_url}. The server took longer than 12 seconds to respond.")
        except httpx.ConnectError:
            raise RuntimeError(f"Could not connect to {clean_url}. Please check your internet connection or the URL.")
        except Exception as e:
            raise RuntimeError(f"Network error while fetching {clean_url}: {str(e)}")

        if resp.status_code in (401, 403):
            raise RuntimeError(
                f"Access denied ({resp.status_code} Forbidden/Unauthorized). "
                "This website is protected by a paywall, institutional login, or anti-bot verification. "
                "You can print/save the page as a PDF or copy-paste it into a document to process it in the app."
            )
        elif resp.status_code >= 400:
            raise RuntimeError(f"Failed to fetch {clean_url}: HTTP error {resp.status_code} ({resp.reason_phrase}).")

        # Content length check
        content_bytes = resp.content
        if len(content_bytes) > MAX_DOWNLOAD_BYTES:
            raise RuntimeError(
                f"Page payload exceeds safe size limit ({len(content_bytes) / (1024 * 1024):.1f} MB > 15 MB cap)."
            )

        content_type = resp.headers.get("content-type", "").lower()
        is_pdf = "application/pdf" in content_type or clean_url.lower().endswith(".pdf")

    # Determine destination directory
    if target_output_dir and target_output_dir.strip():
        out_dir = Path(target_output_dir.strip())
    elif settings.default_output_dir and settings.default_output_dir.strip():
        out_dir = Path(settings.default_output_dir.strip())
    else:
        out_dir = Path.home() / "Documents" / "AcademicProcessorOutputs"

    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    now_human = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # --- Case 1: PDF Document ---
    if is_pdf:
        logger.info(f"URL resolved to a PDF document: {clean_url}")
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_file.write(content_bytes)
            tmp_pdf_path = tmp_file.name

        try:
            pdf_text = extract_document_text(tmp_pdf_path)
            extracted_tokens = count_tokens(pdf_text)
            url_stem = Path(clean_url.split("?")[0]).stem or "document"
            file_title = f"{sanitize_filename(url_stem)}_pdf"
            filename = f"{file_title}_{timestamp}.md"
            out_file = out_dir / filename

            doc_content = f"""---
title: "{file_title}"
source_url: "{clean_url}"
extracted_at: "{now_human}"
content_type: "pdf"
tokens: {extracted_tokens}
---

# {file_title}

> **Source**: [{clean_url}]({clean_url})  
> **Type**: PDF Document (Direct Download) | **Extracted**: {now_human}

---

{pdf_text}
"""
            out_file.write_text(doc_content, encoding="utf-8")
            return {
                "title": file_title,
                "url": clean_url,
                "output_path": str(out_file.resolve()),
                "filename": filename,
                "token_count": extracted_tokens,
                "markdown": doc_content,
            }
        finally:
            if os.path.exists(tmp_pdf_path):
                os.remove(tmp_pdf_path)

    # --- Case 2: Web Article (HTML) ---
    raw_html = resp.text
    processed_html = preprocess_html_math(raw_html)

    # Extract metadata using Trafilatura
    metadata = trafilatura.extract_metadata(raw_html)
    article_title = (metadata.title if metadata and metadata.title else "").strip()
    article_author = (metadata.author if metadata and metadata.author else "Unknown").strip()
    article_date = (metadata.date if metadata and metadata.date else "N/A").strip()
    site_name = (metadata.sitename if metadata and metadata.sitename else "").strip()

    # Fallback title if trafilatura metadata didn't detect one
    if not article_title:
        title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.IGNORECASE | re.DOTALL)
        if title_match:
            article_title = title_match.group(1).strip()
        else:
            url_stem = Path(clean_url.split("?")[0]).stem or "web_article"
            article_title = url_stem.replace("-", " ").replace("_", " ").title()

    # Extract clean markdown body
    extracted_md = trafilatura.extract(
        processed_html,
        output_format="markdown",
        include_links=True,
        include_images=False,
        favor_recall=True,
    )

    if not extracted_md or len(extracted_md.strip()) < 100:
        logger.warning(f"Trafilatura extracted minimal text from {clean_url}. Adding fallback note.")
        extracted_md = (
            f"The main article body could not be automatically separated from this page.\n\n"
            f"- This often happens if the website requires client-side JavaScript rendering (Single-Page App) "
            f"or uses interactive canvas/iframe viewers.\n"
            f"- You can view the original page directly here: [{clean_url}]({clean_url})\n\n"
            f"> *Tip*: To process this content in the app, you can copy the article text into a notes file "
            f"or save the webpage as a PDF, then add it to your Target Documents."
        )

    clean_title_slug = sanitize_filename(article_title[:60])
    filename = f"{clean_title_slug}_{timestamp}.md"
    out_file = out_dir / filename

    full_markdown = f"""---
title: "{article_title.replace('"', '')}"
source_url: "{clean_url}"
author: "{article_author.replace('"', '')}"
published: "{article_date}"
site_name: "{site_name.replace('"', '')}"
extracted_at: "{now_human}"
---

# {article_title}

> **Source**: [{clean_url}]({clean_url})  
> **Author**: {article_author} | **Published**: {article_date} | **Extracted**: {now_human}

---

{extracted_md}
"""

    out_file.write_text(full_markdown, encoding="utf-8")
    tokens = count_tokens(full_markdown)

    logger.info(f"Article extracted successfully: {filename} ({tokens} tokens) -> {out_file}")

    return {
        "title": article_title,
        "url": clean_url,
        "output_path": str(out_file.resolve()),
        "filename": filename,
        "token_count": tokens,
        "markdown": full_markdown,
    }
