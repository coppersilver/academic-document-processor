def build_syllabus_strategy_prompt(document_text: str, filename: str) -> list[dict[str, str]]:
    system_message = (
        "You are an elite academic strategist, pedagogical coach, and university learning advisor. "
        "Your task is to analyze course syllabi, outlines, schedules, and grading schemes to construct "
        "a master course strategy guide. Your recommendations must be deeply analytical, actionable, and "
        "meticulously designed to help a student achieve both deep conceptual comprehension of the material "
        "and an optimal final grade (A/A*)."
    )

    user_message = f"""Document: {filename}

Analyze this course syllabus / course outline and construct a comprehensive, rigorous **Course Strategy Guide**. 
Synthesize the document into the following 6 core strategic pillars, using clear GitHub-flavored Markdown formatting:

---

## 1. Course Architecture & Intellectual Map
- **Core Pillars & Epistemic Goals**: Identify the foundational themes, core questions, and learning objectives of the course.
- **Conceptual Dependency Chain**: Map out which early topics form non-negotiable prerequisites for downstream advanced modules (e.g., "Mastering Week 2–3 theory is essential for understanding the model in Week 8").
- **Progression & Rigor Curve**: Note where the difficulty transitions from foundational terminology to advanced synthesis, proofs, or complex project execution.

---

## 2. Assessment Breakdown & Grade Optimization ROI
- **Grade Weighting Matrix**: Present a clear Markdown table detailing each assessment component, its percentage weight, frequency, and submission format.
- **Point-Leverage & Effort Allocation (ROI)**: 
  - Classify components into **High-Leverage Core** (where exams/major projects require disproportionate, high-depth focus) versus **Consistent Baseline Drivers** (quizzes, problem sets, participation that provide high ROI for steady effort).
  - Highlight the "Margin of Safety": How many points can be lost before dropping below target thresholds (e.g., A/A- range).

---

## 3. Weekly Study Cadence & Active Learning Workflow
Provide a concrete weekly operating routine tailored specifically to this course's structure:
- **Pre-Lecture Preparation (30–60 mins)**: High-yield skimming techniques, formula familiarity, and formulating 2–3 framing questions before each class.
- **Lecture Engagement Strategy**: Active note-taking approach suited to the discipline (e.g., focusing on conceptual rationales, derivation steps, professor emphases, or live code demonstrations).
- **Post-Lecture Synthesis (24–48 Hour Review)**: Converting raw lecture notes into self-testing flashcards, summary sheets, or mind maps; identifying immediate points of confusion.
- **Weekly Problem Set / Assignment Turnaround**: Recommended timeline for starting, drafting, verifying, and submitting recurring assignments well ahead of deadlines.

---

## 4. Subject-Specific Comprehension & Retention Blueprint
- **Tailored Study Methodologies**: Provide specific mastery tactics tailored to the subject matter reflected in the syllabus (e.g., mathematical derivation vs. code implementation vs. case study analysis vs. heavy literature readings).
- **Active Recall & Self-Testing Protocols**: Concrete ways to test understanding beyond passive reading (e.g., closed-book Feynman technique, reconstructing proofs from scratch, creating mock test problems).
- **Core Formula / Framework Mastery**: How to build a cumulative reference sheet for equations, theorems, algorithms, or theoretical paradigms as the semester progresses.

---

## 5. Milestone Exam & Deliverable Gameplan
- **Multi-Week Exam Countdown**:
  - **3–4 Weeks Out**: Content synthesis, identifying knowledge gaps, compiling comprehensive formula/concept sheets.
  - **1–2 Weeks Out**: High-intensity problem solving under timed, closed-book conditions using past exams or end-of-chapter problems.
  - **Final 48–72 Hours**: Low-stress review of high-yield summary sheets, error logs, and resting cognitive stamina.
- **Major Projects / Papers Milestones**: Deconstruct term papers or group projects into bite-sized internal deadlines.
- **Strategic Office Hours Playbook**: Specific guidelines on when and how to leverage professor and TA office hours for maximum conceptual clarity and grading rubric alignment.

---

## 6. Critical Bottlenecks, Risk Management & Grade Recovery
- **Collision & Crunch Weeks**: Identify specific calendar weeks where major exams, heavy assignments, and projects collide (or standard midterm crunch periods).
- **Course Policy Pitfalls**: Flag strict syllabus policies (late submission penalties, attendance or participation gates, minimum passing scores on exams regardless of homework grade, academic integrity requirements).
- **Early Warning Indicators & Recovery Protocol**: Concrete red flags signaling that a student is falling behind, paired with a rapid recovery protocol to regain momentum and protect their grade.

---

Formatting Requirements:
- Use clean GitHub-flavored Markdown with bolding, tables, and structured bullet points.
- Conceptual Dependency Diagrams: When providing visual flows or topic dependency chains, format them using standard ```mermaid fenced code blocks (e.g. ````mermaid\ngraph TD\n...````).
- Rendering Guardrail: Do NOT wrap study outlines, templates, cheat sheets, or tables in markdown code fences (` ```markdown `). Render all headings, outlines, tables, and notes directly as standard Markdown so they render seamlessly.
- Mathematical Delimiters: Always use single `$ ... $` for all inline formulas, variables, and table cell expressions (e.g., `$\\chi^2$`, `$X = F^{-1}(U)$`, `$L = \\lambda W$`). Reserve double `$$ ... $$` strictly for standalone display equations placed on their own separate lines.

--- SYLLABUS / COURSE OUTLINE CONTENT ---
{document_text}
"""
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": user_message},
    ]
