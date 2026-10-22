"""Run the local server: python -m server [--host 127.0.0.1] [--port 8000]."""
from __future__ import annotations

import argparse

import uvicorn

from . import config


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m server", description="Vukoli local server")
    parser.add_argument("--host", default=config.HOST, help="default 127.0.0.1 (this computer only)")
    parser.add_argument("--port", type=int, default=config.PORT)
    parser.add_argument("--reload", action="store_true", help="auto-reload for development")
    args = parser.parse_args()
    if args.host not in ("127.0.0.1", "localhost", "::1"):
        print("Warning: the server will be reachable from other devices on your network.")
    print(f"Vukoli: http://{args.host}:{args.port}  (data: {config.data_dir()})")
    uvicorn.run("server.main:app", host=args.host, port=args.port, reload=args.reload, log_level="info",
                ws_max_size=1_048_576)


if __name__ == "__main__":
    main()
