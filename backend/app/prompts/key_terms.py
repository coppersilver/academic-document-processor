def build_key_terms_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an academic researcher and educator. Your task is to identify and extract "
        "key terms, specialized vocabulary, foundational concepts, equations, and definitions "
        "from the provided academic text, formatting them into an authoritative study glossary."
    )
    user_message = f"""Document: {filename}

Extract the core terminology, theoretical concepts, models, and specialized definitions from this document.

Format the output as:
1. **Core Terminology Glossary**:
   Alphabetical or thematic list where each entry includes:
   - **`Term / Concept Name`**: Clear definition in context.
   - *Significance*: Why this term matters in the context of the paper/course.
   - *Example / Application*: How it is applied or calculated in the document (if mentioned).
2. **Key Acronyms & Abbreviations**: Table mapping acronyms to full names and explanations.
3. **Key Mathematical Notations / Formulas** (if applicable): Use standard LaTeX delimiters (`$...$` for inline variables and `$$...$$` for standalone display equations) with variable definitions.

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
