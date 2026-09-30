import asyncio
import logging
from typing import Any, Callable, Coroutine

logger = logging.getLogger("academic_processor.worker")

class TypedFIFOQueue:
    """A typed FIFO worker queue with configurable worker concurrency."""

    def __init__(self, name: str, concurrency: int = 1):
        self.name = name
        self.concurrency = concurrency
        self.queue: asyncio.Queue = asyncio.Queue()
        self.workers: list[asyncio.Task] = []
        self._running = False

    def start(self, handler: Callable[[Any], Coroutine[Any, Any, None]]) -> None:
        """Starts worker tasks for this queue."""
        if self._running:
            return
        self._running = True
        for i in range(self.concurrency):
            worker_task = asyncio.create_task(
                self._worker_loop(f"{self.name}-worker-{i + 1}", handler)
            )
            self.workers.append(worker_task)
        logger.info(f"Started queue '{self.name}' with {self.concurrency} worker(s)")

    async def _worker_loop(self, worker_id: str, handler: Callable[[Any], Coroutine[Any, Any, None]]):
        while self._running:
            try:
                item = await self.queue.get()
                logger.debug(f"[{worker_id}] Dequeued item: {item.get('id', 'unknown')}")
                try:
                    await handler(item)
                except Exception as e:
                    logger.error(f"[{worker_id}] Error handling item {item.get('id', 'unknown')}: {e}", exc_info=True)
                finally:
                    self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[{worker_id}] Worker loop error: {e}", exc_info=True)

    async def put(self, item: Any) -> None:
        """Enqueues an item FIFO."""
        await self.queue.put(item)

    async def stop(self) -> None:
        """Stops all workers in this queue."""
        self._running = False
        for w in self.workers:
            w.cancel()
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
        logger.info(f"Stopped queue '{self.name}'")
