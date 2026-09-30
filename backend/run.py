import os
import sys
import json
import socket
from pathlib import Path
import uvicorn

def find_free_port() -> int:
    """Finds an available ephemeral port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port

def main():
    port = find_free_port()

    # Output structured handshake for Electron
    handshake = {"event": "SERVER_READY", "port": port}
    sys.stdout.write(json.dumps(handshake) + "\n")
    sys.stdout.flush()

    app_dir = Path(__file__).resolve().parent / "app"
    is_dev = os.environ.get("NODE_ENV") != "production"

    # Run uvicorn on the assigned port
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
        access_log=False,
        reload=is_dev,
        reload_dirs=[str(app_dir)] if is_dev else None,
    )

if __name__ == "__main__":
    main()
