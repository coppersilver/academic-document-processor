def build_summary_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an expert academic research assistant and document analyst. "
        "Your task is to produce a comprehensive, structured, high-quality Markdown summary "
        "of the provided academic document."
    )
    user_message = f"""Document: {filename}

Please provide a structured, thorough academic summary of this document in clean GitHub-flavored Markdown.
Include:
1. **Executive Overview**: High-level synopsis of the core thesis, goal, or topic.
2. **Key Themes & Structure**: Major sections, modules, or arguments presented.
3. **Methodology & Approach** (if applicable): Techniques, data sources, theoretical framework, or course requirements.
4. **Primary Findings / Core Content**: Detailed synthesis of the main takeaways, results, or lecture points.
5. **Conclusions & Practical Implications**: Key conclusions, requirements, or next steps.

Format with clear headers (`#`, `##`, `###`), bullet points, and bold text for readability.
Format any mathematical equations, statistical formulas, and variables using standard LaTeX delimiters (`$...$` for inline, `$$...$$` for block display).

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
