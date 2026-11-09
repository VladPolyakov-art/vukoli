"""Sign in to a CLI engine from the app (09.11): open a terminal window that already runs the CLI's own sign-in
command (`claude auth login`, `codex login`). The CLI opens the browser; Vukoli never sees a password or a token.
Only the path of a program we found ourselves goes into the command, never text from a request."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys


def _ps_quote(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def _sh_quote(text: str) -> str:
    return "'" + text.replace("'", "'\\''") + "'"


def command_line(binary: str, args: list[str], platform: str = sys.platform) -> str:
    """What the user sees and what the terminal runs."""
    if platform == "win32":
        return "& " + _ps_quote(binary) + "".join(" " + a for a in args)
    return " ".join([_sh_quote(binary), *args])


def open_terminal(binary: str, args: list[str], env: dict[str, str] | None = None) -> bool:
    """Open a new terminal window running `binary args`. False when this computer has no terminal we know."""
    line = command_line(binary, args)
    try:
        if sys.platform == "win32":
            ps = shutil.which("powershell.exe") or os.path.join(os.environ.get("SystemRoot", r"C:\Windows"),
                                                                 r"System32\WindowsPowerShell\v1.0\powershell.exe")
            subprocess.Popen([ps, "-NoProfile", "-NoExit", "-Command", line], env=env,
                             creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0x10))
            return True
        if sys.platform == "darwin":
            script = line.replace("\\", "\\\\").replace('"', '\\"')
            subprocess.Popen(["osascript", "-e", f'tell application "Terminal" to do script "{script}"',
                              "-e", 'tell application "Terminal" to activate'],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        for term in ("x-terminal-emulator", "gnome-terminal", "konsole", "xterm"):
            if path := shutil.which(term):
                extra = ["--"] if term == "gnome-terminal" else ["-e"]
                subprocess.Popen([path, *extra, "sh", "-c", line + "; exec sh"], env=env,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return True
    except OSError:
        return False
    return False
