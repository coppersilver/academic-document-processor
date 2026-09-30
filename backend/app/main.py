import os
import json
import uuid
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import settings, SESSION_TOKEN, PARENT_PID, AVAILABLE_MODELS, AppSettings
from .watcher import start_parent_watcher
from .db.database import init_db
from .db.repository import get_all_tasks_history, get_task_by_id
from .db.preset_repository import (
    get_all_presets,
    create_preset,
    update_preset,
    delete_preset,
    reset_to_default_presets,
)
from .extractors import inspect_documents
from .queues.manager import queue_manager
from .services.youtube import extract_youtube_video_id

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("academic_processor.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing SQLite database...")
    await init_db()

    logger.info("Starting QueueManager worker queues...")
    queue_manager.start()

    if PARENT_PID:
        logger.info(f"Starting parent watcher for PID {PARENT_PID}...")
        start_parent_watcher(PARENT_PID)

    yield

    # Shutdown
    logger.info("Stopping worker queues...")
    await queue_manager.stop()

app = FastAPI(title="Academic Document Processor Backend", lifespan=lifespan)

# Allow CORS for local Electron renderer
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication middleware for local security
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Allow CORS preflight OPTIONS requests without auth so browser preflight succeeds
    if request.method == "OPTIONS":
        return await call_next(request)

    # Allow health check and root without token
    if request.url.path in ("/health", "/", "/docs", "/openapi.json"):
        return await call_next(request)

    # Check for SSE token in query string if EventSource doesn't support custom headers
    query_token = request.query_params.get("token")

    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    elif query_token:
        token = query_token.strip()

    if SESSION_TOKEN and token != SESSION_TOKEN:
        logger.warning(f"Unauthorized request to {request.url.path} from {request.client.host if request.client else 'unknown'}")
        return Response(
            content=json.dumps({"detail": "Unauthorized: Invalid or missing session token."}),
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json"
        )

    return await call_next(request)

# Request Models
class InspectRequest(BaseModel):
    file_paths: list[str] = Field(..., min_length=1)

class CreateTaskRequest(BaseModel):
    filenames: list[str] = Field(default_factory=list)
    file_paths: list[str] = Field(default_factory=list)
    url: str | None = None
    action_type: str = Field(..., description="summary, deadlines, key_terms, group_summary, calendar_export, bibtex, practice_exam, anonymize, polish, extract_article, youtube_transcript")
    output_dir: str | None = None
    custom_instructions: str | None = None

class UpdateSettingsRequest(BaseModel):
    openrouter_api_key: str | None = None
    selected_model: str | None = None
    default_output_dir: str | None = None

class CreatePresetRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    instructions: str = Field(..., min_length=1)

class UpdatePresetRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    instructions: str = Field(..., min_length=1)

# Routes
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "has_api_key": bool(settings.openrouter_api_key),
        "selected_model": settings.selected_model,
        "available_models": AVAILABLE_MODELS,
    }

@app.get("/api/settings")
async def get_settings():
    return {
        "has_api_key": bool(settings.openrouter_api_key),
        "selected_model": settings.selected_model,
        "default_output_dir": settings.default_output_dir,
        "available_models": AVAILABLE_MODELS,
    }

@app.post("/api/settings")
async def update_settings(req: UpdateSettingsRequest):
    if req.openrouter_api_key is not None:
        settings.openrouter_api_key = req.openrouter_api_key.strip()
    if req.selected_model is not None:
        settings.selected_model = req.selected_model.strip()
    if req.default_output_dir is not None:
        settings.default_output_dir = req.default_output_dir.strip()

    return {
        "status": "updated",
        "has_api_key": bool(settings.openrouter_api_key),
        "selected_model": settings.selected_model,
        "default_output_dir": settings.default_output_dir,
    }

@app.get("/api/presets")
async def list_presets():
    return await get_all_presets()

@app.post("/api/presets", status_code=status.HTTP_201_CREATED)
async def add_preset(req: CreatePresetRequest):
    return await create_preset(req.title, req.instructions)

@app.put("/api/presets/{preset_id}")
async def edit_preset(preset_id: str, req: UpdatePresetRequest):
    updated = await update_preset(preset_id, req.title, req.instructions)
    if not updated:
        raise HTTPException(status_code=404, detail="Preset not found")
    return updated

@app.delete("/api/presets/{preset_id}")
async def remove_preset(preset_id: str):
    success = await delete_preset(preset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"status": "deleted", "id": preset_id}

@app.post("/api/presets/reset")
async def reset_presets():
    return await reset_to_default_presets()

@app.post("/api/documents/inspect")
async def inspect_docs(req: InspectRequest):
    try:
        data = inspect_documents(req.file_paths)
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error inspecting documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to inspect documents: {str(e)}")

@app.post("/api/tasks")
async def create_task(req: CreateTaskRequest):
    action = req.action_type.lower()
    valid_actions = {
        "summary",
        "deadlines",
        "key_terms",
        "group_summary",
        "calendar_export",
        "bibtex",
        "practice_exam",
        "anonymize",
        "polish",
        "extract_article",
        "youtube_transcript",
    }
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action type: {req.action_type}")

    if action == "extract_article":
        if not req.url or not req.url.strip():
            raise HTTPException(
                status_code=400,
                detail="A valid 'url' is required for the 'extract_article' action."
            )
        filenames = req.filenames if req.filenames else [req.url.strip()]
        file_paths = req.file_paths if req.file_paths else [req.url.strip()]
    elif action == "youtube_transcript":
        if not req.url or not req.url.strip():
            raise HTTPException(
                status_code=400,
                detail="A valid 'url' is required for the 'youtube_transcript' action."
            )
        video_id = extract_youtube_video_id(req.url.strip())
        if not video_id:
            raise HTTPException(
                status_code=400,
                detail="Could not find a valid YouTube video ID in this URL. Please provide a link formatted like 'https://www.youtube.com/watch?v=...' or 'https://youtu.be/...'"
            )
        filenames = req.filenames if req.filenames else [f"youtube_{video_id}"]
        file_paths = req.file_paths if req.file_paths else [req.url.strip()]
    else:
        if not req.file_paths or len(req.file_paths) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one document file path is required."
            )
        if len(req.file_paths) > 1 and action != "group_summary":
            raise HTTPException(
                status_code=400,
                detail=f"Action '{req.action_type}' is only supported for a single document. For multiple documents, use 'group_summary'."
            )
        filenames = req.filenames
        file_paths = req.file_paths

    task_id = str(uuid.uuid4())
    task = await queue_manager.enqueue_task(
        task_id=task_id,
        filenames=filenames,
        file_paths=file_paths,
        action_type=action,
        output_dir=req.output_dir,
        custom_instructions=req.custom_instructions,
        url=req.url.strip() if req.url else None
    )
    return task

@app.get("/api/tasks")
async def list_tasks(limit: int = 100):
    tasks = await get_all_tasks_history(limit=limit)
    return {"tasks": tasks}

@app.get("/api/tasks/{task_id}")
async def get_task(task_id: str):
    task = await get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.post("/api/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    success = await queue_manager.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not active or already finished")
    return {"status": "cancelled", "task_id": task_id}

@app.get("/api/events")
async def sse_events(request: Request):
    """Server-Sent Events endpoint streaming real-time queue and task updates."""
    event_queue = queue_manager.subscribe_events()

    async def event_generator():
        try:
            # Send initial connected ping
            yield f"event: connected\ndata: {json.dumps({'message': 'Connected to queue events'})}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    event_data = await asyncio.wait_for(event_queue.get(), timeout=15.0)
                    yield f"event: {event_data['event']}\ndata: {json.dumps(event_data['data'])}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat ping
                    yield "event: ping\ndata: {}\n\n"
        finally:
            queue_manager.unsubscribe_events(event_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
