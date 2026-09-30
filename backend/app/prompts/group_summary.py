def build_group_summary_prompt(combined_docs_text: str, filenames: list[str]) -> list[dict[str, str]]:
    system_message = (
        "You are an expert academic literature review specialist and research director. "
        "Your task is to analyze multiple academic documents and produce a synthesized, "
        "comparative cross-document review in structured Markdown."
    )
    files_str = ", ".join(filenames)
    user_message = f"""Documents analyzed ({len(filenames)} files): {files_str}

Please generate a comprehensive, comparative synthesis across these documents in clean GitHub-flavored Markdown:

1. **Executive Synthesis**: Unified summary of what these combined documents represent as a collection.
2. **Comparative Matrix / Table**:
   | Document | Primary Focus / Topic | Key Findings / Themes | Unique Contribution |
3. **Common Themes & Overlapping Arguments**: Points of consensus, shared methodology, or shared course topics.
4. **Contrasts & Divergences**: Differences in findings, competing viewpoints, conflicting dates, or distinct approaches.
5. **Integrated Conclusions & Unified Takeaways**: Actionable insights or consolidated summary drawn from all sources together.

Format with clear headers (`#`, `##`, `###`), tables, and bold text.
Format any mathematical equations, theoretical models, or statistical variables using standard LaTeX delimiters (`$...$` for inline, `$$...$$` for block display).

--- COMBINED DOCUMENTS CONTENT ---
{combined_docs_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
