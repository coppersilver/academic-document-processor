def build_deadlines_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an academic workflow coordinator. Your job is to extract all dates, deadlines, "
        "milestones, exam schedules, and deliverables from academic documents (such as syllabi, CFPs, "
        "assignment prompts, and conference schedules) into structured, chronological Markdown."
    )
    user_message = f"""Document: {filename}

Extract all dates, deadlines, office hours, exam dates, submission cutoffs, and scheduled events found in the document.

Structure the output as follows:
1. **Chronological Deadlines & Schedule**:
   A Markdown table with columns:
   | Date / Time | Event / Milestone | Deliverable / Details | Notes / Weight |
2. **Upcoming Immediate Priorities**: Bullet list of the earliest or highest-weight tasks/dates.
3. **Recurring Events**: (e.g. Weekly lecture slots, lab sessions, office hours).
4. **Tentative / Unscheduled Items**: Any assignments or items mentioned without fixed dates.

If no specific dates are found in the text, clearly state that no explicit dates were detected and list any sequential phases or relative timelines mentioned.

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
