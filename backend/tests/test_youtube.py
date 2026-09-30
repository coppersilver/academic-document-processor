import pytest
import os
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.services.youtube import (
    extract_youtube_video_id,
    format_timestamp,
    format_transcript_paragraphs,
    extract_youtube_transcript,
)
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    IpBlocked,
    AgeRestricted,
)
from app.main import app


def test_extract_youtube_video_id():
    valid_urls = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ?si=abcdef12345", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/live/dQw4w9WgXcQ?feature=share", "dQw4w9WgXcQ"),
        ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ]
    for url, expected_id in valid_urls:
        assert extract_youtube_video_id(url) == expected_id

    invalid_urls = [
        "https://www.youtube.com/",
        "https://www.google.com",
        "https://vimeo.com/123456",
        "short",
    ]
    for url in invalid_urls:
        assert extract_youtube_video_id(url) is None


def test_format_timestamp():
    assert format_timestamp(0) == "00:00"
    assert format_timestamp(45) == "00:45"
    assert format_timestamp(75) == "01:15"
    assert format_timestamp(3600) == "01:00:00"
    assert format_timestamp(3675) == "01:01:15"


def test_format_transcript_paragraphs():
    snippets = [
        {"text": "Hello world.", "start": 0.0, "duration": 5.0},
        {"text": "This is a lecture.", "start": 5.0, "duration": 10.0},
        {"text": "We are discussing mathematics.", "start": 35.0, "duration": 15.0},
        {"text": "Linear algebra is fundamental.", "start": 50.0, "duration": 20.0},
    ]
    formatted = format_transcript_paragraphs(snippets, paragraph_interval=30.0)
    assert "**[00:00]** Hello world. This is a lecture. We are discussing mathematics." in formatted
    assert "**[00:50]** Linear algebra is fundamental." in formatted


@pytest.mark.asyncio
async def test_extract_youtube_transcript_success(tmp_path):
    mock_snippets = [
        {"text": "Welcome to Linear Algebra Lecture 1.", "start": 0.0, "duration": 4.0},
        {"text": "Today we cover vector spaces and linear equations.", "start": 4.0, "duration": 5.0},
    ]

    mock_transcript_obj = MagicMock()
    mock_transcript_obj.fetch.return_value = MagicMock(to_raw_data=lambda: mock_snippets)

    mock_list = MagicMock()
    mock_list.find_transcript.return_value = mock_transcript_obj

    with patch.object(YouTubeTranscriptApi, "list", return_value=mock_list), \
         patch("app.services.youtube.fetch_video_metadata", new_callable=AsyncMock) as mock_meta:
        mock_meta.return_value = {
            "title": "MIT 18.06 Linear Algebra Lecture 1",
            "author_name": "MIT OpenCourseWare"
        }

        result = await extract_youtube_transcript(
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            target_output_dir=str(tmp_path)
        )

        assert result["video_id"] == "dQw4w9WgXcQ"
        assert result["title"] == "MIT 18.06 Linear Algebra Lecture 1"
        assert result["channel"] == "MIT OpenCourseWare"
        assert os.path.exists(result["output_path"])

        content = Path(result["output_path"]).read_text(encoding="utf-8")
        assert "# MIT 18.06 Linear Algebra Lecture 1" in content
        assert "Welcome to Linear Algebra Lecture 1." in content


@pytest.mark.asyncio
@pytest.mark.parametrize("error_cls,expected_message_fragment", [
    (TranscriptsDisabled("dQw4w9WgXcQ"), "disabled by the creator"),
    (NoTranscriptFound("dQw4w9WgXcQ", [], None), "No transcript could be found"),
    (VideoUnavailable("dQw4w9WgXcQ"), "private, deleted, or unavailable"),
    (AgeRestricted("dQw4w9WgXcQ"), "age-restricted"),
    (IpBlocked("dQw4w9WgXcQ"), "rate-limited"),
])
async def test_extract_youtube_transcript_errors(error_cls, expected_message_fragment):
    with patch.object(YouTubeTranscriptApi, "list", side_effect=error_cls), \
         patch("app.services.youtube.fetch_video_metadata", new_callable=AsyncMock) as mock_meta:
        mock_meta.return_value = {"title": "Test Video", "author_name": "Test"}

        with pytest.raises(RuntimeError) as exc_info:
            await extract_youtube_transcript("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

        assert expected_message_fragment.lower() in str(exc_info.value).lower()


def test_api_youtube_transcript_validation():
    client = TestClient(app)

    # 1. Missing URL
    resp = client.post("/api/tasks", json={
        "filenames": [],
        "file_paths": [],
        "action_type": "youtube_transcript",
        "url": ""
    })
    assert resp.status_code == 400
    assert "url" in resp.json()["detail"].lower()

    # 2. Invalid YouTube URL
    resp = client.post("/api/tasks", json={
        "filenames": [],
        "file_paths": [],
        "action_type": "youtube_transcript",
        "url": "https://www.not-youtube.com/page"
    })
    assert resp.status_code == 400
    assert "video id" in resp.json()["detail"].lower()

    # 3. Valid YouTube URL succeeds
    with patch("app.queues.manager.queue_manager.enqueue_task", new_callable=AsyncMock) as mock_enqueue:
        mock_enqueue.return_value = {
            "id": "mock-yt-task",
            "filenames": ["youtube_dQw4w9WgXcQ"],
            "file_paths": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
            "action_type": "youtube_transcript",
            "status": "PENDING"
        }
        resp = client.post("/api/tasks", json={
            "filenames": [],
            "file_paths": [],
            "action_type": "youtube_transcript",
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        })
        assert resp.status_code == 200
        assert resp.json()["id"] == "mock-yt-task"
