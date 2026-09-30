import re
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

def _escape_ics_text(text: str) -> str:
    """Escapes text according to RFC 5545 formatting."""
    if not text:
        return ""
    text = text.replace("\\", "\\\\")
    text = text.replace(";", "\\;")
    text = text.replace(",", "\\,")
    text = text.replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")
    return text

def _format_date(date_str: str) -> str:
    """Converts ISO date strings like '2026-10-15' or '2026-10-15T14:30:00' to ICS format."""
    clean = date_str.strip()
    # Match YYYY-MM-DDTHH:MM:SS or YYYY-MM-DDTHH:MM
    match_dt = re.match(r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?", clean)
    if match_dt:
        y, m, d, hh, mm = match_dt.group(1), match_dt.group(2), match_dt.group(3), match_dt.group(4), match_dt.group(5)
        ss = match_dt.group(6) or "00"
        return f":{y}{m}{d}T{hh}{mm}{ss}"

    # Match YYYY-MM-DD (all-day event)
    match_d = re.match(r"^(\d{4})-(\d{2})-(\d{2})", clean)
    if match_d:
        y, m, d = match_d.group(1), match_d.group(2), match_d.group(3)
        return f";VALUE=DATE:{y}{m}{d}"

    # Fallback to current date
    now = datetime.now(timezone.utc)
    return f";VALUE=DATE:{now.strftime('%Y%m%d')}"

def generate_ics_content(events: list[dict[str, Any]], cal_name: str = "Academic Deadlines") -> str:
    """Generates valid RFC 5545 iCalendar (.ics) content from event dictionaries."""
    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Academic Document Processor//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape_ics_text(cal_name)}",
    ]

    for ev in events:
        summary = ev.get("summary") or "Academic Deadline"
        start_date = ev.get("start_date") or ""
        end_date = ev.get("end_date") or start_date
        description = ev.get("description") or ""
        location = ev.get("location") or ""
        event_uid = str(uuid.uuid4())

        dtstart_formatted = _format_date(start_date)
        dtend_formatted = _format_date(end_date)

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{event_uid}@academic-processor.local")
        lines.append(f"DTSTAMP:{now_stamp}")
        lines.append(f"DTSTART{dtstart_formatted}")
        lines.append(f"DTEND{dtend_formatted}")
        lines.append(f"SUMMARY:{_escape_ics_text(summary)}")
        if description:
            lines.append(f"DESCRIPTION:{_escape_ics_text(description)}")
        if location:
            lines.append(f"LOCATION:{_escape_ics_text(location)}")
        lines.append("STATUS:CONFIRMED")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"

def write_calendar_file(
    events: list[dict[str, Any]],
    filename_base: str,
    target_output_dir: str | Path
) -> Path:
    """Writes an .ics file to the target output directory."""
    out_dir = Path(target_output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_base = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename_base)
    ics_filename = f"{safe_base}_deadlines_{timestamp}.ics"
    out_file = out_dir / ics_filename

    ics_content = generate_ics_content(events, cal_name=f"{filename_base} Deadlines")
    out_file.write_text(ics_content, encoding="utf-8")
    return out_file
