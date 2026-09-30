import os
import time
import threading
import logging

logger = logging.getLogger("academic_processor.watcher")

def start_parent_watcher(parent_pid_str: str | None = None) -> None:
    """Monitors the parent process. If parent terminates, cleanly kills this process.
    Prevents orphaned zombie Python processes when Electron exits or crashes.
    """
    if not parent_pid_str:
        logger.info("No PARENT_PID provided, parent watcher disabled.")
        return

    try:
        parent_pid = int(parent_pid_str)
    except ValueError:
        logger.warning(f"Invalid PARENT_PID: {parent_pid_str}")
        return

    def _watch():
        logger.info(f"Started parent watcher monitoring PID {parent_pid}")
        while True:
            time.sleep(1.0)
            try:
                # Signal 0 does not kill the process, but performs error checking
                os.kill(parent_pid, 0)
            except OSError:
                # Parent process is dead
                logger.info(f"Parent process {parent_pid} terminated. Exiting child...")
                os._exit(0)

    thread = threading.Thread(target=_watch, daemon=True, name="ParentProcessWatcher")
    thread.start()
