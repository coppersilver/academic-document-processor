import pytest
import os
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.services.scraper import preprocess_html_math, fetch_and_extract_article
from app.main import app


def test_preprocess_html_math():
    html = """
    <html>
        <body>
            <p>Here is an inline MathJax equation: <script type="math/tex">x^2 + y^2 = r^2</script></p>
            <div class="katex-display">
                <span class="katex">
                    <annotation encoding="application/x-tex">\\int_0^1 f(x) dx = F(1) - F(0)</annotation>
                </span>
            </div>
            <p>And inline KaTeX: <span class="katex"><annotation encoding="application/x-tex">E = mc^2</annotation></span></p>
        </body>
    </html>
    """
    processed = preprocess_html_math(html)
    assert "$x^2 + y^2 = r^2$" in processed
    assert "$$\\int_0^1 f(x) dx = F(1) - F(0)$$" in processed
    assert "$E = mc^2$" in processed


@pytest.mark.asyncio
async def test_fetch_and_extract_article_html(tmp_path):
    mock_html = """
    <!DOCTYPE html>
    <html>
        <head>
            <title>The Geometry of Deep Learning</title>
            <meta name="author" content="Dr. Jane Doe">
        </head>
        <body>
            <article>
                <h1>The Geometry of Deep Learning</h1>
                <p>Deep learning models exhibit rich geometric properties. Consider the optimization landscape with respect to parameter vectors.</p>
                <p>We analyze the loss surface where <script type="math/tex">\\mathcal{L}(\\theta) = \\frac{1}{N} \\sum_{i=1}^N \\ell(f(x_i), y_i)</script>.</p>
                <p>Empirical evidence shows high-dimensional convergence is guaranteed under mild regularities.</p>
            </article>
        </body>
    </html>
    """

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = mock_html
    mock_resp.content = mock_html.encode("utf-8")
    mock_resp.headers = {"content-type": "text/html; charset=utf-8"}

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        result = await fetch_and_extract_article("https://example.edu/geometry-dl", target_output_dir=str(tmp_path))

        assert result["url"] == "https://example.edu/geometry-dl"
        assert os.path.exists(result["output_path"])
        assert result["token_count"] > 0

        content = Path(result["output_path"]).read_text(encoding="utf-8")
        assert "The Geometry of Deep Learning" in content
        assert "Deep learning models exhibit rich geometric properties" in content


@pytest.mark.asyncio
async def test_fetch_and_extract_article_403_paywall():
    mock_resp = MagicMock()
    mock_resp.status_code = 403
    mock_resp.reason_phrase = "Forbidden"

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        with pytest.raises(RuntimeError) as exc_info:
            await fetch_and_extract_article("https://paywalled-journal.com/article")
        assert "paywall" in str(exc_info.value).lower() or "forbidden" in str(exc_info.value).lower()


def test_api_extract_article_validation():
    client = TestClient(app)

    # 1. Missing URL should fail with 400
    resp = client.post("/api/tasks", json={
        "filenames": [],
        "file_paths": [],
        "action_type": "extract_article",
        "url": ""
    })
    assert resp.status_code == 400
    assert "url" in resp.json()["detail"].lower()

    # 2. Valid URL should succeed
    with patch("app.queues.manager.queue_manager.enqueue_task", new_callable=AsyncMock) as mock_enqueue:
        mock_enqueue.return_value = {
            "id": "mock-task-id",
            "filenames": ["https://example.com/test"],
            "file_paths": ["https://example.com/test"],
            "action_type": "extract_article",
            "status": "PENDING"
        }
        resp = client.post("/api/tasks", json={
            "filenames": [],
            "file_paths": [],
            "action_type": "extract_article",
            "url": "https://example.com/test"
        })
        assert resp.status_code == 200
        assert resp.json()["id"] == "mock-task-id"
