import pytest
from pathlib import Path
from app.services.calendar_writer import generate_ics_content, write_calendar_file
from app.prompts.calendar_export import build_calendar_export_prompt
from app.prompts.bibtex import build_bibtex_prompt
from app.prompts.practice_exam import build_practice_exam_prompt
from app.prompts.anonymize import build_anonymize_prompt
from app.services.openrouter import get_action_messages

def test_generate_ics_content():
    events = [
        {
            "summary": "Midterm Exam",
            "start_date": "2026-10-15T10:00:00",
            "end_date": "2026-10-15T12:00:00",
            "description": "Covers chapters 1-5",
            "location": "Room 101"
        },
        {
            "summary": "Project Submission",
            "start_date": "2026-11-20",
            "end_date": "2026-11-20",
            "description": "Final PDF submission",
            "location": "Canvas"
        }
    ]
    ics_text = generate_ics_content(events, cal_name="Course Deadlines")
    assert "BEGIN:VCALENDAR" in ics_text
    assert "VERSION:2.0" in ics_text
    assert "BEGIN:VEVENT" in ics_text
    assert "SUMMARY:Midterm Exam" in ics_text
    assert "LOCATION:Room 101" in ics_text
    assert "SUMMARY:Project Submission" in ics_text
    assert "END:VCALENDAR" in ics_text

def test_write_calendar_file(tmp_path: Path):
    events = [
        {
            "summary": "Final Paper Due",
            "start_date": "2026-12-10",
            "description": "Hard deadline",
            "location": "Portal"
        }
    ]
    out_file = write_calendar_file(events, "syllabus.pdf", tmp_path)
    assert out_file.exists()
    assert out_file.suffix == ".ics"
    content = out_file.read_text(encoding="utf-8")
    assert "SUMMARY:Final Paper Due" in content

def test_prompt_generators():
    text = "Machine learning course syllabus. Midterm on Oct 15th."
    fn = "syllabus.pdf"

    p_cal = build_calendar_export_prompt(text, fn)
    assert len(p_cal) == 2
    assert "JSON" in p_cal[1]["content"]

    p_bib = build_bibtex_prompt(text, fn)
    assert len(p_bib) == 2
    assert "BibTeX" in p_bib[1]["content"]

    p_exam = build_practice_exam_prompt(text, fn)
    assert len(p_exam) == 2
    assert "Multiple Choice" in p_exam[1]["content"]
    assert "Answer Key" in p_exam[1]["content"]

    p_anon = build_anonymize_prompt(text, fn)
    assert len(p_anon) == 2
    assert "STUDENT NAME" in p_anon[1]["content"]

def test_get_action_messages_routing():
    text = "Academic text"
    for action in ["calendar_export", "bibtex", "practice_exam", "anonymize"]:
        msgs = get_action_messages(action, text, ["doc.pdf"])
        assert len(msgs) == 2
        assert msgs[0]["role"] == "system"
        assert msgs[1]["role"] == "user"

def test_get_action_messages_custom_instructions():
    text = "Academic text about quantum mechanics"
    msgs = get_action_messages(
        action_type="summary",
        document_text=text,
        filenames=["quantum.pdf"],
        custom_instructions="Focus specifically on Schrödinger equation derivations."
    )
    assert len(msgs) == 2
    assert "ADDITIONAL USER INSTRUCTIONS & FOCUS" in msgs[1]["content"]
    assert "Focus specifically on Schrödinger equation derivations." in msgs[1]["content"]
