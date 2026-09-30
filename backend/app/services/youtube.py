import os
import re
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
import httpx

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    VideoUnplayable,
    InvalidVideoId,
    RequestBlocked,
    IpBlocked,
    AgeRestricted,
    CouldNotRetrieveTranscript,
)

from ..config import settings
from ..extractors import count_tokens

logger = logging.getLogger("academic_processor.youtube")


def extract_youtube_video_id(url: str) -> str | None:
    """Extracts the 11-character YouTube video ID from various URL formats."""
    clean = url.strip()
    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, clean)
        if match:
            return match.group(1)
    return None


def format_timestamp(seconds: float) -> str:
    """Formats seconds into readable MM:SS or HH:MM:SS."""
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def sanitize_filename(name: str) -> str:
    """Removes unsafe characters for file naming."""
    clean = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name)
    return clean.strip('_') or "youtube_transcript"


async def fetch_video_metadata(video_id: str) -> dict[str, str]:
    """
    Fetches video title and author from YouTube's public oEmbed API without needing an API key.
    """
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/128.0.0.0 Safari/537.36"
        )
    }

    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True, headers=headers) as client:
            resp = await client.get(oembed_url)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "title": data.get("title", "").strip(),
                    "author_name": data.get("author_name", "").strip(),
                }
    except Exception as e:
        logger.warning(f"Could not fetch oEmbed metadata for {video_id}: {e}")

    return {
        "title": f"YouTube Video ({video_id})",
        "author_name": "YouTube",
    }


def format_transcript_paragraphs(snippets: list[dict[str, Any]], paragraph_interval: float = 45.0) -> str:
    """
    Consolidates fine-grained subtitle fragments into readable paragraphs
    grouped roughly every 30-45 seconds or sentence boundaries with timestamp anchors.
    """
    paragraphs = []
    current_block_start = None
    current_texts = []

    for item in snippets:
        text = item.get("text", "").strip()
        if not text:
            continue
        start = float(item.get("start", 0.0))

        if current_block_start is None:
            current_block_start = start

        current_texts.append(text)

        elapsed = start - current_block_start
        ends_sentence = text.endswith((".", "!", "?"))

        if elapsed >= paragraph_interval or (elapsed >= 25.0 and ends_sentence):
            ts_str = format_timestamp(current_block_start)
            para_text = " ".join(current_texts)
            paragraphs.append(f"**[{ts_str}]** {para_text}")
            current_texts = []
            current_block_start = None

    if current_texts:
        ts_str = format_timestamp(current_block_start if current_block_start is not None else 0.0)
        para_text = " ".join(current_texts)
        paragraphs.append(f"**[{ts_str}]** {para_text}")

    return "\n\n".join(paragraphs)


async def extract_youtube_transcript(
    url: str,
    target_output_dir: str | None = None
) -> dict[str, Any]:
    """
    Fetches the transcript for a YouTube video, formats with timestamps and metadata,
    and writes a Markdown document to target_output_dir.
    """
    video_id = extract_youtube_video_id(url)
    if not video_id:
        raise RuntimeError(
            "Could not find a valid YouTube video ID in this URL. "
            "Please provide a link formatted like 'https://www.youtube.com/watch?v=...' or 'https://youtu.be/...'"
        )

    clean_url = f"https://www.youtube.com/watch?v={video_id}"
    logger.info(f"Extracting YouTube transcript for video ID: {video_id}")

    # 1. Fetch metadata (Title & Channel)
    meta = await fetch_video_metadata(video_id)
    video_title = meta.get("title") or f"YouTube Video ({video_id})"
    channel_name = meta.get("author_name") or "YouTube Channel"

    # 2. Fetch transcript using YouTubeTranscriptApi
    try:
        api = YouTubeTranscriptApi()
        snippets = None

        try:
            transcript_list = api.list(video_id)
            transcript_obj = None
            try:
                transcript_obj = transcript_list.find_transcript(["en", "en-US", "en-GB"])
            except Exception:
                try:
                    transcript_obj = transcript_list.find_generated_transcript(["en", "en-US", "en-GB"])
                except Exception:
                    for t in transcript_list:
                        transcript_obj = t
                        break

            if transcript_obj:
                fetched = transcript_obj.fetch()
                snippets = fetched.to_raw_data() if hasattr(fetched, "to_raw_data") else [
                    {"text": s.text, "start": s.start, "duration": s.duration} for s in fetched
                ]
        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable, VideoUnplayable, AgeRestricted, IpBlocked, RequestBlocked, InvalidVideoId):
            raise
        except Exception as list_err:
            logger.debug(f"api.list failed for {video_id}: {list_err}, falling back to api.fetch")

        if snippets is None:
            fetched = api.fetch(video_id, languages=["en", "en-US", "en-GB"])
            snippets = fetched.to_raw_data() if hasattr(fetched, "to_raw_data") else [
                {"text": s.text, "start": s.start, "duration": s.duration} for s in fetched
            ]

    except TranscriptsDisabled:
        raise RuntimeError(
            "Transcripts are disabled by the creator for this video. "
            "You can try a different lecture or video with subtitles enabled."
        )
    except NoTranscriptFound:
        raise RuntimeError(
            "No transcript could be found for this video in the requested language. "
            "Auto-generated captions may still be processing by YouTube."
        )
    except (VideoUnavailable, VideoUnplayable):
        raise RuntimeError(
            "This YouTube video is private, deleted, or unavailable. Please verify the URL."
        )
    except AgeRestricted:
        raise RuntimeError(
            "This video is age-restricted and requires sign-in, so its transcript cannot be accessed publicly."
        )
    except (IpBlocked, RequestBlocked):
        raise RuntimeError(
            "YouTube temporarily rate-limited transcript requests from this IP. "
            "Please wait a few moments before trying again."
        )
    except InvalidVideoId:
        raise RuntimeError(
            f"The video ID '{video_id}' is invalid or malformed."
        )
    except CouldNotRetrieveTranscript as e:
        err_lower = str(e).lower()
        if "rate" in err_lower or "too many" in err_lower or "block" in err_lower:
            raise RuntimeError(
                "YouTube temporarily rate-limited transcript requests from this IP. "
                "Please wait a moment before trying again."
            )
        raise RuntimeError(f"Could not retrieve transcript from YouTube: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error fetching transcript for {video_id}: {e}", exc_info=True)
        raise RuntimeError(f"Failed to fetch YouTube transcript: {str(e)}")

    if not snippets:
        raise RuntimeError("The transcript returned by YouTube contained no text content.")

    # 3. Format into structured paragraphs
    formatted_body = format_transcript_paragraphs(snippets)

    # Calculate total duration from last snippet
    last_item = snippets[-1]
    total_seconds = float(last_item.get("start", 0)) + float(last_item.get("duration", 0))
    duration_str = format_timestamp(total_seconds)

    # 4. Prepare Markdown document
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    now_human = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Destination directory
    if target_output_dir and target_output_dir.strip():
        out_dir = Path(target_output_dir.strip())
    elif settings.default_output_dir and settings.default_output_dir.strip():
        out_dir = Path(settings.default_output_dir.strip())
    else:
        out_dir = Path.home() / "Documents" / "AcademicProcessorOutputs"

    out_dir.mkdir(parents=True, exist_ok=True)

    title_slug = sanitize_filename(video_title[:60])
    filename = f"{title_slug}_transcript_{timestamp}.md"
    out_file = out_dir / filename

    full_markdown = f"""---
title: "{video_title.replace('"', '')}"
source_url: "{clean_url}"
channel: "{channel_name.replace('"', '')}"
duration: "{duration_str}"
video_id: "{video_id}"
extracted_at: "{now_human}"
action: "youtube_transcript"
---

# {video_title}

> **Source Video**: [{clean_url}]({clean_url})  
> **Channel**: {channel_name} | **Duration**: {duration_str} | **Extracted**: {now_human}

---

## Video Transcript

{formatted_body}
"""

    out_file.write_text(full_markdown, encoding="utf-8")
    tokens = count_tokens(full_markdown)

    logger.info(f"YouTube transcript extracted: {filename} ({tokens} tokens) -> {out_file}")

    return {
        "title": video_title,
        "url": clean_url,
        "channel": channel_name,
        "video_id": video_id,
        "duration": duration_str,
        "output_path": str(out_file.resolve()),
        "filename": filename,
        "token_count": tokens,
        "markdown": full_markdown,
    }
