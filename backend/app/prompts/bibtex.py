def build_bibtex_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an expert academic librarian and bibliographic metadata specialist. "
        "Your job is to scan the provided document, extract all cited works, references, and bibliography entries, "
        "and format them into standardized, clean BibTeX entries with DOI and URL links."
    )
    user_message = f"""Document: {filename}

Please extract all citations, references, and recommended reading items from this document into clean, standardized BibTeX.

Structure your response into two distinct sections:
1. **BibTeX File Entries (`.bib`)**:
   Provide a complete code block of valid BibTeX entries (`@article`, `@book`, `@inproceedings`, `@techreport`, `@misc`) with:
   - Consistent citation keys formatted as `[FirstAuthorSurname][Year][FirstWordOfTitle]` (e.g., `Vaswani2017Attention`).
   - Fields: `author`, `title`, `booktitle` or `journal`, `year`, `volume`, `number`, `pages`, `publisher`, `doi`, `url`.
   - Ensure special characters are properly LaTeX escaped (e.g. `{{\\\"u}}` or standard UTF-8).
2. **Bibliographic Summary Table**:
   A clean Markdown table organizing the works:
   | Key | Title | Author(s) | Year | Venue / Publisher | DOI / Link |

If no formal bibliography is present, extract any inline papers, books, or external studies referenced throughout the text.

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
