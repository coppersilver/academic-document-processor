def build_anonymize_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an academic privacy officer and document redaction specialist. "
        "Your task is to sanitize the provided academic document or student notes so they can be "
        "shared publicly or among peers 100% anonymously, removing all personally identifiable information (PII) "
        "while completely preserving all educational content, lecture notes, formulas, diagrams, and study materials."
    )
    user_message = f"""Document: {filename}

Please sanitize and anonymize this document so it can be safely shared without revealing the identity of the student, instructors, or specific institution.

Specific Redaction Guidelines:
1. **Student Personal Information**:
   - Replace student names with `[STUDENT NAME]`
   - Replace student ID numbers or matriculation codes with `[STUDENT ID]`
   - Replace email addresses with `[EMAIL REDACTED]`
   - Replace usernames, NetIDs, or portal logins with `[USERNAME]`
2. **Institutional & Instructor Details**:
   - Replace university, college, high school, or campus names with `[UNIVERSITY]`
   - Replace specific professor, instructor, or teaching assistant names with `[PROFESSOR]` or `[TA]`
   - Replace specific private course section codes or semester-specific registration numbers with `[COURSE CODE]`
   - Remove private Google Drive / OneDrive links or institutional URLs, replacing them with `[PORTAL LINK]`
3. **Academic Content Preservation**:
   - Retain 100% of the actual lecture notes, formulas, concepts, summaries, definitions, assignments, and questions completely intact, maintaining all LaTeX mathematical notation (`$...$` and `$$...$$`).

Structure the output as:
1. **Redaction Audit Log**:
   A concise table or summary of all detected and anonymized entities (e.g. Student Names: 1 redacted, University: 1 redacted, Emails: 2 redacted).
2. **Anonymized Document Text**:
   The full sanitized document text formatted in clean Markdown.

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
