"""Find a program the user already installed, also outside this process's PATH (D83).

An app started from the Dock or a launcher often gets a short PATH (/usr/bin:/bin), so an installed `ollama` or
`claude` looked "not installed". Homebrew, npm and the installers' own folders are checked too.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path

COMMON_DIRS = ("/opt/homebrew/bin", "/usr/local/bin", "~/.local/bin", "~/bin", "~/.npm-global/bin", "~/.bun/bin",
               "~/.volta/bin")


def find_program(name: str, extra: tuple[str, ...] = ()) -> str | None:
    """PATH first, then `extra` (full paths), then the common install folders."""
    found = shutil.which(name)
    if found:
        return found
    for candidate in (*extra, *(f"{d}/{name}" for d in COMMON_DIRS)):
        path = Path(candidate).expanduser()
        if path.is_file() and os.access(path, os.X_OK):
            return str(path)
    return None
