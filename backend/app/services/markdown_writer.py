import re
from pathlib import Path
from datetime import datetime, timezone

ACTION_DISPLAY_NAMES = {
    "summary": "Document Summary",
    "deadlines": "Dates and Deadlines",
    "key_terms": "Key Terms and Concepts",
    "group_summary": "Group Summary & Synthesis",
    "calendar_export": "Calendar Deadlines Export",
    "bibtex": "BibTeX Citations & Bibliography",
    "practice_exam": "Academic Practice Exam",
    "anonymize": "Anonymized Document",
}

def sanitize_filename(name: str) -> str:
    """Removes unsafe characters for file naming."""
    return re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name)

def write_markdown_output(
    content: str,
    action_type: str,
    filenames: list[str],
    source_file_paths: list[str],
    target_output_dir: str | None = None,
    model_name: str = ""
) -> Path:
    """Writes generated content to a Markdown file with metadata."""
    # Determine destination directory
    if target_output_dir and target_output_dir.strip():
        out_dir = Path(target_output_dir.strip())
    elif source_file_paths and len(source_file_paths) > 0:
        first_source = Path(source_file_paths[0])
        out_dir = first_source.parent / "outputs"
    else:
        out_dir = Path.home() / "Documents" / "AcademicProcessorOutputs"

    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    now_human = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    action_title = ACTION_DISPLAY_NAMES.get(action_type.lower(), action_type.title())

    if len(filenames) == 1:
        base_name = Path(filenames[0]).stem
        filename = f"{sanitize_filename(base_name)}_{action_type.lower()}_{timestamp}.md"
    else:
        filename = f"group_summary_{len(filenames)}_docs_{timestamp}.md"

    out_file = out_dir / filename

    # Build metadata YAML / front-matter header
    sources_bullets = "\n".join([f"- `{fn}`" for fn in filenames])
    header = f"""---
title: "{action_title}"
generated_at: "{now_human}"
model: "{model_name}"
action: "{action_type}"
sources:
{sources_bullets}
---

# {action_title}

> Generated on {now_human} using `{model_name}`.

{content}
"""

    out_file.write_text(header, encoding="utf-8")
    return out_file
