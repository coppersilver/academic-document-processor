import pytest
from app.prompts.summary import build_summary_prompt
from app.prompts.group_summary import build_group_summary_prompt
from app.prompts.key_terms import build_key_terms_prompt
from app.prompts.practice_exam import build_practice_exam_prompt
from app.prompts.anonymize import build_anonymize_prompt
from app.services.openrouter import get_action_messages, MATH_FORMATTING_DIRECTIVE

def test_prompts_contain_latex_guidelines():
    # Summary
    p_sum = build_summary_prompt("Text", "doc.pdf")
    assert "LaTeX delimiters" in p_sum[1]["content"]

    # Group Summary
    p_grp = build_group_summary_prompt("Text", ["doc1.pdf", "doc2.pdf"])
    assert "LaTeX delimiters" in p_grp[1]["content"]

    # Key Terms
    p_terms = build_key_terms_prompt("Text", "doc.pdf")
    assert "LaTeX delimiters" in p_terms[1]["content"]

    # Practice Exam
    p_exam = build_practice_exam_prompt("Text", "doc.pdf")
    assert "LaTeX delimiters" in p_exam[1]["content"]

    # Anonymize
    p_anon = build_anonymize_prompt("Text", "doc.pdf")
    assert "LaTeX mathematical notation" in p_anon[1]["content"]

def test_get_action_messages_injects_math_directive():
    actions = [
        "summary",
        "deadlines",
        "key_terms",
        "group_summary",
        "calendar_export",
        "bibtex",
        "practice_exam",
        "anonymize",
    ]
    for act in actions:
        msgs = get_action_messages(act, "Document text", ["sample.pdf"])
        assert msgs[0]["role"] == "system"
        assert "Mathematical & Scientific Notation" in msgs[0]["content"]
        assert "$ ... $" in msgs[0]["content"]
        assert "$$ ... $$" in msgs[0]["content"]
