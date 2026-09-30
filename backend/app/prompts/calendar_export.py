def build_calendar_export_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an expert academic scheduling assistant. Your job is to extract all dates, deadlines, "
        "office hours, lecture events, exam dates, submission cutoffs, and milestones from the document, "
        "and format them into a valid JSON array of events."
    )
    user_message = f"""Document: {filename}

Extract all dates, deadlines, exams, assignments, project milestones, and scheduled academic events from this document.

You MUST respond with a valid JSON object matching this exact schema:
```json
{{
  "events": [
    {{
      "summary": "Short title of event (e.g., Assignment 1 Due)",
      "start_date": "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS (use 2026 if year is unspecified)",
      "end_date": "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS (optional, defaults to start_date)",
      "description": "Details, weight, requirements, or syllabus instructions",
      "location": "Location or platform (e.g. Canvas, Room 204, Online, or empty string)"
    }}
  ],
  "markdown_summary": "Clean Markdown table of all deadlines and events in chronological order"
}}
```

Requirements:
1. Ensure all date strings follow ISO 8601 (e.g. `2026-10-15` or `2026-10-15T23:59:00`).
2. If only a month and day are mentioned (e.g. 'Oct 15'), assume the current academic year 2026.
3. Provide a clear summary and description for each calendar event.
4. Return ONLY the JSON object, enclosed within ```json and ``` code fence.

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
