"""Find a program the user already installed, also outside this process's PATH (D83).

An app started from the Dock or a launcher often gets a short PATH (/usr/bin:/bin), so an installed `ollama` or
`claude` looked "not installed". Homebrew, npm and the installers' own folders are checked too.
"""
from __future__ import annotations

import os
import re
import shutil
import sys
from pathlib import Path

COMMON_DIRS = ("/opt/homebrew/bin", "/usr/local/bin", "~/.local/bin", "~/bin", "~/.npm-global/bin", "~/.bun/bin",
               "~/.volta/bin", "~/AppData/Roaming/npm", "~/AppData/Local/Programs/Ollama")
WINDOWS_SUFFIXES = (".exe", ".cmd")


def find_program(name: str, extra: tuple[str, ...] = ()) -> str | None:
    """PATH first, then `extra` (full paths), then the common install folders."""
    found = shutil.which(name)
    if found:
        return found
    suffixes = ("", *WINDOWS_SUFFIXES) if sys.platform == "win32" else ("",)
    for candidate in (*extra, *(f"{d}/{name}" for d in COMMON_DIRS)):
        for suffix in suffixes:
            path = Path(candidate + suffix).expanduser()
            if path.is_file() and os.access(path, os.X_OK):
                return str(path)
    return None


# npm's Windows wrapper ends with: "%_prog%"  "%dp0%\node_modules\pkg\cli.js" %*   (or a native .exe target)
SHIM_TARGET = re.compile(r'"%~?dp0%?\\?([^"]+)"\s+%\*')


def command(binary: str) -> list[str]:
    """How to start `binary`. An npm `.cmd` wrapper on Windows runs through cmd.exe, which cuts arguments at a line
    break and reads `&`, `|`, `>` and `%` in them, so the wrapper is skipped: its target runs directly (node + the
    script, or the package's own .exe). Anything else, or a wrapper we can't read, runs as it is."""
    path = Path(binary)
    if path.suffix.lower() not in (".cmd", ".bat"):
        return [binary]
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return [binary]
    found = SHIM_TARGET.findall(text)
    if not found:
        return [binary]
    target = path.parent / found[-1].replace("\\", os.sep).replace("/", os.sep)
    if not target.is_file():
        return [binary]
    if target.suffix.lower() == ".exe":
        return [str(target)]
    node = path.parent / "node.exe"
    node_cmd = str(node) if node.is_file() else (shutil.which("node") or find_program("node"))
    return [node_cmd, str(target)] if node_cmd else [binary]
