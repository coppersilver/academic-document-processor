import asyncio
import time
import logging
import json
import re
from typing import Any, Callable, Coroutine
from ..config import settings
from ..db.repository import save_new_task, update_task_progress, get_all_tasks_history
from ..extractors import is_binary_format, extract_document_text, count_tokens, get_cached_or_extract
from ..services.openrouter import call_openrouter, get_action_messages, OpenRouterError
from ..services.markdown_writer import write_markdown_output
from ..services.calendar_writer import write_calendar_file
from ..services.scraper import fetch_and_extract_article
from ..services.youtube import extract_youtube_transcript
from .base_worker import TypedFIFOQueue

logger = logging.getLogger("academic_processor.manager")

class QueueManager:
    """Coordinates typed concurrent FIFO worker queues and manages task lifecycles."""

    def __init__(self):
        # Converter queue: for local CPU/IO extraction (concurrency: 2)
        self.doc_converter_queue = TypedFIFOQueue("doc_converter", concurrency=2)
        # AI queue: for cloud LLM API calls (concurrency: 1 to prevent rate limits)
        self.ai_worker_queue = TypedFIFOQueue("cloud_llm", concurrency=1)

        self.subscribers: set[asyncio.Queue] = set()
        self.cancel_events: dict[str, asyncio.Event] = {}
        self.active_tasks: dict[str, dict[str, Any]] = {}

    def start(self) -> None:
        """Starts worker loops for all queues."""
        self.doc_converter_queue.start(self._handle_doc_conversion)
        self.ai_worker_queue.start(self._handle_ai_execution)
        logger.info("QueueManager worker queues started.")

    async def stop(self) -> None:
        """Stops all worker queues."""
        await self.doc_converter_queue.stop()
        await self.ai_worker_queue.stop()

    def subscribe_events(self) -> asyncio.Queue:
        """Registers a new SSE listener queue."""
        q = asyncio.Queue()
        self.subscribers.add(q)
        return q

    def unsubscribe_events(self, q: asyncio.Queue) -> None:
        """Unregisters an SSE listener queue."""
        self.subscribers.discard(q)

    async def emit_event(self, event_type: str, data: dict[str, Any]) -> None:
        """Broadcasts an event to all connected SSE clients."""
        payload = {"event": event_type, "data": data}
        dead_queues = []
        for q in self.subscribers:
            try:
                q.put_nowait(payload)
            except Exception:
                dead_queues.append(q)
        for dead in dead_queues:
            self.subscribers.discard(dead)

    async def enqueue_task(
        self,
        task_id: str,
        filenames: list[str],
        file_paths: list[str],
        action_type: str,
        output_dir: str | None = None,
        custom_instructions: str | None = None,
        url: str | None = None
    ) -> dict[str, Any]:
        """Validates input, records task to SQLite, and routes to the appropriate queue."""
        cancel_event = asyncio.Event()
        self.cancel_events[task_id] = cancel_event

        task_data = {
            "id": task_id,
            "filenames": filenames,
            "file_paths": file_paths,
            "action_type": action_type,
            "output_dir": output_dir or settings.default_output_dir,
            "custom_instructions": custom_instructions,
            "url": url,
            "status": "PENDING",
            "queue_type": "doc_converter",
            "cancel_event": cancel_event,
            "start_time": time.time(),
            "extracted_text": "",
            "token_count": 0,
        }

        # Save initial state to database
        saved = await save_new_task(
            task_id=task_id,
            filenames=filenames,
            file_paths=file_paths,
            action_type=action_type,
            status="PENDING"
        )
        self.active_tasks[task_id] = task_data
        await self.emit_event("task_queued", {**saved, "queue_type": "doc_converter"})

        if action_type in ("extract_article", "youtube_transcript"):
            logger.info(f"Routing web/video extraction task {task_id} ({action_type}) to ConverterWorker queue")
            await self.doc_converter_queue.put(task_data)
            return saved

        # Check if binary extraction is needed
        requires_binary_extraction = any(is_binary_format(fp) for fp in file_paths)

        if requires_binary_extraction:
            # Route to doc_converter queue
            logger.info(f"Routing task {task_id} to ConverterWorker queue")
            await self.doc_converter_queue.put(task_data)
        else:
            # Plaintext bypass: read instantly and route straight to AI worker queue
            logger.info(f"Bypassing ConverterWorker for plaintext task {task_id}")
            task_data["queue_type"] = "cloud_llm"
            # Read plaintext files directly using cache
            text_blocks = []
            for fp, fn in zip(file_paths, filenames):
                t, _ = get_cached_or_extract(fp)
                text_blocks.append(f"--- Document: {fn} ---\n{t}" if len(file_paths) > 1 else t)
            combined_text = "\n\n".join(text_blocks)
            task_data["extracted_text"] = combined_text
            task_data["token_count"] = count_tokens(combined_text)

            # Update token count in DB
            await update_task_progress(task_id, "PENDING", token_count=task_data["token_count"])
            await self.ai_worker_queue.put(task_data)

        return saved

    async def cancel_task(self, task_id: str) -> bool:
        """Cancels an active or pending task."""
        if task_id in self.cancel_events:
            self.cancel_events[task_id].set()
            await update_task_progress(task_id, status="CANCELLED", error_message="Cancelled by user.")
            await self.emit_event("task_cancelled", {"id": task_id, "status": "CANCELLED"})
            self.active_tasks.pop(task_id, None)
            return True
        return False

    async def _handle_doc_conversion(self, task_data: dict[str, Any]) -> None:
        """Worker handler for ConverterWorker: extracts text from binary documents, web articles, or YouTube transcripts."""
        task_id = task_data["id"]
        cancel_event: asyncio.Event = task_data["cancel_event"]

        if cancel_event.is_set():
            return

        # Case A: Web article scraping
        if task_data.get("action_type") == "extract_article":
            target_url = task_data.get("url") or (task_data["file_paths"][0] if task_data.get("file_paths") else "")
            logger.info(f"[ConverterWorker] Scraping web article for task {task_id}: {target_url}")
            await update_task_progress(task_id, status="PROCESSING")
            await self.emit_event("task_processing", {
                "id": task_id,
                "status": "PROCESSING",
                "stage": "extracting",
                "queue_type": "doc_converter",
                "message": f"Fetching and extracting web article from {target_url}..."
            })

            try:
                result = await fetch_and_extract_article(
                    url=target_url,
                    target_output_dir=task_data.get("output_dir")
                )

                if cancel_event.is_set():
                    return

                duration_ms = int((time.time() - task_data["start_time"]) * 1000)

                await update_task_progress(
                    task_id=task_id,
                    status="COMPLETED",
                    output_path=result["output_path"],
                    duration_ms=duration_ms,
                    token_count=result["token_count"]
                )

                await self.emit_event("task_completed", {
                    "id": task_id,
                    "status": "COMPLETED",
                    "queue_type": "doc_converter",
                    "output_path": result["output_path"],
                    "duration_ms": duration_ms,
                    "token_count": result["token_count"],
                    "message": f"Article extracted and saved as {result['filename']}"
                })
            except Exception as e:
                logger.error(f"[ConverterWorker] Web scraping failed for {task_id}: {e}", exc_info=True)
                err_msg = str(e)
                await update_task_progress(task_id, status="FAILED", error_message=err_msg)
                await self.emit_event("task_failed", {
                    "id": task_id,
                    "status": "FAILED",
                    "queue_type": "doc_converter",
                    "error_message": err_msg
                })
            finally:
                self.active_tasks.pop(task_id, None)
            return

        # Case B: YouTube transcript extraction
        if task_data.get("action_type") == "youtube_transcript":
            target_url = task_data.get("url") or (task_data["file_paths"][0] if task_data.get("file_paths") else "")
            logger.info(f"[ConverterWorker] Extracting YouTube transcript for task {task_id}: {target_url}")
            await update_task_progress(task_id, status="PROCESSING")
            await self.emit_event("task_processing", {
                "id": task_id,
                "status": "PROCESSING",
                "stage": "extracting",
                "queue_type": "doc_converter",
                "message": f"Fetching and formatting YouTube transcript from {target_url}..."
            })

            try:
                result = await extract_youtube_transcript(
                    url=target_url,
                    target_output_dir=task_data.get("output_dir")
                )

                if cancel_event.is_set():
                    return

                duration_ms = int((time.time() - task_data["start_time"]) * 1000)

                await update_task_progress(
                    task_id=task_id,
                    status="COMPLETED",
                    output_path=result["output_path"],
                    duration_ms=duration_ms,
                    token_count=result["token_count"]
                )

                await self.emit_event("task_completed", {
                    "id": task_id,
                    "status": "COMPLETED",
                    "queue_type": "doc_converter",
                    "output_path": result["output_path"],
                    "duration_ms": duration_ms,
                    "token_count": result["token_count"],
                    "message": f"Transcript extracted ({result['duration']}) and saved as {result['filename']}"
                })
            except Exception as e:
                logger.error(f"[ConverterWorker] YouTube extraction failed for {task_id}: {e}", exc_info=True)
                err_msg = str(e)
                await update_task_progress(task_id, status="FAILED", error_message=err_msg)
                await self.emit_event("task_failed", {
                    "id": task_id,
                    "status": "FAILED",
                    "error_message": err_msg
                })
            finally:
                self.active_tasks.pop(task_id, None)
            return

        # Case C: Document text extraction
        logger.info(f"[ConverterWorker] Processing document extraction for task {task_id}")
        await update_task_progress(task_id, status="PROCESSING")
        await self.emit_event("task_processing", {
            "id": task_id,
            "status": "PROCESSING",
            "stage": "extracting",
            "queue_type": "doc_converter",
            "message": "Extracting text and tables from document(s)..."
        })

        try:
            # Offload synchronous parsing to worker thread to avoid blocking asyncio event loop
            def _extract_all():
                parts = []
                for fp, fn in zip(task_data["file_paths"], task_data["filenames"]):
                    text, _ = get_cached_or_extract(fp)
                    parts.append(f"--- Document: {fn} ---\n{text}" if len(task_data["file_paths"]) > 1 else text)
                return "\n\n".join(parts)

            combined_text = await asyncio.to_thread(_extract_all)

            if cancel_event.is_set():
                return

            task_data["extracted_text"] = combined_text
            task_data["token_count"] = count_tokens(combined_text)
            task_data["queue_type"] = "cloud_llm"

            await update_task_progress(task_id, status="PENDING", token_count=task_data["token_count"])
            await self.emit_event("task_stage_changed", {
                "id": task_id,
                "status": "PENDING",
                "stage": "extracted",
                "queue_type": "cloud_llm",
                "token_count": task_data["token_count"],
                "message": f"Extracted ({task_data['token_count']} tokens). Queued for AI inference..."
            })

            # Enqueue into AI queue
            await self.ai_worker_queue.put(task_data)

        except Exception as e:
            logger.error(f"[ConverterWorker] Failed extraction for {task_id}: {e}", exc_info=True)
            err_msg = f"Extraction failed: {str(e)}"
            await update_task_progress(task_id, status="FAILED", error_message=err_msg)
            await self.emit_event("task_failed", {
                "id": task_id,
                "status": "FAILED",
                "error_message": err_msg
            })
            self.active_tasks.pop(task_id, None)

    async def _handle_ai_execution(self, task_data: dict[str, Any]) -> None:
        """Worker handler for AIWorker: queries OpenRouter and writes Markdown output."""
        task_id = task_data["id"]
        cancel_event: asyncio.Event = task_data["cancel_event"]

        if cancel_event.is_set():
            return

        logger.info(f"[AIWorker] Running AI inference for task {task_id}")
        await update_task_progress(task_id, status="PROCESSING")
        model_display = settings.selected_model.split("/")[-1] if "/" in settings.selected_model else settings.selected_model
        await self.emit_event("task_processing", {
            "id": task_id,
            "status": "PROCESSING",
            "stage": "calling_openrouter",
            "queue_type": "cloud_llm",
            "token_count": task_data.get("token_count", 0),
            "model_name": settings.selected_model,
            "message": f"Waiting for {model_display} to generate response from OpenRouter..."
        })

        try:
            messages = get_action_messages(
                action_type=task_data["action_type"],
                document_text=task_data["extracted_text"],
                filenames=task_data["filenames"],
                custom_instructions=task_data.get("custom_instructions")
            )

            # Query OpenRouter
            llm_result = await call_openrouter(
                messages=messages,
                api_key=settings.openrouter_api_key,
                model=settings.selected_model,
                cancel_event=cancel_event
            )

            if cancel_event.is_set():
                return

            await self.emit_event("task_stage_changed", {
                "id": task_id,
                "status": "PROCESSING",
                "stage": "writing_output",
                "queue_type": "cloud_llm",
                "token_count": task_data.get("token_count", 0),
                "message": "Response received! Formatting & saving Markdown file..."
            })

            out_file = None
            action = task_data["action_type"].lower()

            if action == "calendar_export":
                # Attempt to parse events JSON
                events = []
                md_summary = llm_result
                try:
                    match_code = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", llm_result)
                    raw_json = match_code.group(1) if match_code else llm_result
                    parsed_data = json.loads(raw_json)
                    events = parsed_data.get("events", [])
                    md_summary = parsed_data.get("markdown_summary", llm_result)
                except Exception:
                    # Fallback regex search for json block
                    match_obj = re.search(r"(\{[\s\S]*\"events\"[\s\S]*\})", llm_result)
                    if match_obj:
                        try:
                            parsed_data = json.loads(match_obj.group(1))
                            events = parsed_data.get("events", [])
                            md_summary = parsed_data.get("markdown_summary", llm_result)
                        except Exception:
                            pass

                # Write markdown companion
                md_file = write_markdown_output(
                    content=md_summary,
                    action_type="calendar_export",
                    filenames=task_data["filenames"],
                    source_file_paths=task_data["file_paths"],
                    target_output_dir=task_data["output_dir"],
                    model_name=settings.selected_model
                )

                if events:
                    # Write .ics calendar file
                    ics_dir = md_file.parent
                    first_fn = task_data["filenames"][0] if task_data["filenames"] else "academic"
                    ics_file = write_calendar_file(
                        events=events,
                        filename_base=first_fn,
                        target_output_dir=ics_dir
                    )
                    out_file = ics_file
                else:
                    out_file = md_file
            else:
                # Standard markdown output
                out_file = write_markdown_output(
                    content=llm_result,
                    action_type=task_data["action_type"],
                    filenames=task_data["filenames"],
                    source_file_paths=task_data["file_paths"],
                    target_output_dir=task_data["output_dir"],
                    model_name=settings.selected_model
                )

            duration_ms = int((time.time() - task_data["start_time"]) * 1000)

            await update_task_progress(
                task_id=task_id,
                status="COMPLETED",
                output_path=str(out_file.resolve()),
                duration_ms=duration_ms,
                token_count=task_data["token_count"]
            )

            await self.emit_event("task_completed", {
                "id": task_id,
                "status": "COMPLETED",
                "output_path": str(out_file.resolve()),
                "duration_ms": duration_ms,
                "token_count": task_data["token_count"],
                "message": f"Saved output to {out_file.name}"
            })

        except asyncio.CancelledError:
            logger.info(f"[AIWorker] Task {task_id} was cancelled.")
            await update_task_progress(task_id, status="CANCELLED", error_message="Cancelled by user.")
            await self.emit_event("task_cancelled", {"id": task_id, "status": "CANCELLED"})
        except OpenRouterError as ore:
            logger.warning(f"[AIWorker] OpenRouter error for {task_id}: {ore}")
            await update_task_progress(task_id, status="FAILED", error_message=str(ore))
            await self.emit_event("task_failed", {
                "id": task_id,
                "status": "FAILED",
                "error_message": str(ore),
                "is_terminal": ore.is_terminal
            })
        except Exception as e:
            logger.error(f"[AIWorker] Unexpected error for {task_id}: {e}", exc_info=True)
            err_msg = f"Unexpected processing error: {str(e)}"
            await update_task_progress(task_id, status="FAILED", error_message=err_msg)
            await self.emit_event("task_failed", {
                "id": task_id,
                "status": "FAILED",
                "error_message": err_msg
            })
        finally:
            self.active_tasks.pop(task_id, None)
            self.cancel_events.pop(task_id, None)

queue_manager = QueueManager()
