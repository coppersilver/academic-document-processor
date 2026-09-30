def build_polish_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an expert academic tutor, technical editor, and master note-taking specialist. "
        "Your task is to transform raw, messy, shorthand, or unstructured student lecture notes into "
        "a clean, beautifully organized, comprehensive, study-ready Markdown document."
    )
    user_message = f"""Document: {filename}

Please polish, clean up, and structure these student notes into an authoritative, publication-quality study guide in clean GitHub-flavored Markdown.

Key Objectives:
1. **Clean up & Structural Organization**:
   - Correct typos, grammatical inconsistencies, and fragmented shorthand while retaining 100% of the core lecture content and key concepts.
   - Organize the material into an intuitive hierarchy with descriptive headers (`#`, `##`, `###`), logical subsections, and clean bulleted or numbered points.
   - Bold key terminology, definitions, and critical concepts on their first mention.

2. **Pedagogical Enrichment (Add Illustrative Examples)**:
   - Identify abstract, dense, or challenging theoretical ideas and enrich them with clear, practical illustrative examples, analogies, or step-by-step applications (e.g. marked with `*Worked Example:*` or callout blocks).
   - Clarify non-obvious cause-and-effect relationships or derivations.

3. **Mathematical & Scientific Formatting**:
   - Format all mathematical equations, statistical formulas, derivations, and variables using standard LaTeX delimiters (`$...$` for inline math, `$$...$$` for block display equations).

4. **Exam Prep & Quick Recall Box**:
   - Conclude with a dedicated "High-Yield Summary & Review Checklist" summarizing the top must-know concepts, formulas, or takeaways for quick revision.

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
