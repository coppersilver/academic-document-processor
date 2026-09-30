def build_practice_exam_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an academic course instructor and examination author. "
        "Your task is to generate a comprehensive, rigorous practice examination based strictly on the provided "
        "academic document, syllabus, or lecture notes. Focus solely on creating a realistic practice exam with a full answer key."
    )
    user_message = f"""Document: {filename}

Create a rigorous academic practice exam based on this document to test student comprehension, application, and critical thinking.

Please structure the exam into the following sections:

## Part I: Multiple Choice Questions (6–10 Questions)
- Provide challenging questions testing fundamental concepts, definitions, and applications.
- Include 4 distinct options (A, B, C, D) with realistic distractors for each question.
- Do NOT include the answers in this section.

## Part II: Short Answer & Conceptual Questions (4–6 Questions)
- Questions requiring 2–4 sentence responses testing core mechanisms, distinctions between key concepts, or explanations of specific principles found in the text.

## Part III: Applied Problem-Solving & Essay Prompts (2–3 Prompts)
- In-depth, analytical prompts requiring multi-paragraph answers, case analysis, or mathematical derivation/problem-solving based on the material.

---
## Part IV: Complete Answer Key & Scoring Guide
*(Separated with horizontal rules for self-testing)*
- **Part I Answers**: For each multiple choice question, provide the correct letter, along with an explanation of why it is correct and why other options are incorrect.
- **Part II Solutions**: Model short answers highlighting the key concepts and grading criteria required for full credit.
- **Part III Rubric & Model Responses**: Detailed solution guidelines and grading rubric for the analytical/essay prompts.

Format everything in clean GitHub-flavored Markdown.
Format all mathematical expressions, statistical notation, variables, and calculations using standard LaTeX delimiters (`$...$` for inline, `$$...$$` for block display).

--- DOCUMENT CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
