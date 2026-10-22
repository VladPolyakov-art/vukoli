#!/usr/bin/env python3
"""Release gate G1: scan the repository for personal data before publishing.

The patterns themselves are personal, so they never live in the repository. They come from:
  1. IC_PII_PATTERNS   environment variable, one pattern per line (or separated by ";;");
  2. IC_PII_DENYLIST_FILE, or by default ~/.config/interview-coach/denylist.txt
     (one pattern per line; "#" comments; a line starting with "re:" is a regular expression,
     any other line is a case-insensitive substring).
Built-in checks (no patterns needed): Cyrillic text (the app ships in English; the top-level design/ folder is exempt), e-mail addresses outside
example/noreply domains (lockfiles excepted), and absolute home-folder paths (reported as warnings, they do not fail the scan).

Without a denylist only the built-in checks run (this is what CI does). Before a release, run it locally
with --require-denylist so a missing denylist is an error instead of a silent pass.

Output never prints a pattern, only its number in the list, so the report is safe to share.
Exit code: 0 clean, 1 hits found, 2 no denylist configured and --require-denylist given.

Usage: python scripts/pii_scan.py [--require-denylist] [root]   (default root: the app/ folder)
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

SKIP_DIRS = {".venv", "venv", "node_modules", "dist", "build", "__pycache__", ".git", ".pytest_cache",
             ".mypy_cache", ".ruff_cache", "storybook-static", ".tmp"}
MAX_BYTES = 5 * 1024 * 1024
CYRILLIC = re.compile(r"[\u0400-\u04FF]")
HOME_PATH = re.compile(r"(/Users/|/home/|C:\\Users\\)[A-Za-z0-9._-]+")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}")
EMAIL_OK = re.compile(r"@(([A-Za-z0-9-]+\.)*example\.(com|org|net)|users\.noreply\.github\.com|noreply\.[A-Za-z0-9.-]+)$",
                      re.I)
CYRILLIC_OK_DIRS = {"design"}  # the owner's design docs are written in Russian; they hold no personal data (other checks still apply)
LOCKFILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "uv.lock", "poetry.lock"}  # third-party metadata


def load_patterns() -> list[re.Pattern]:
    lines: list[str] = []
    env = os.getenv("IC_PII_PATTERNS", "")
    if env.strip():
        lines += [p for chunk in env.split(";;") for p in chunk.splitlines()]
    path = Path(os.getenv("IC_PII_DENYLIST_FILE", "~/.config/interview-coach/denylist.txt")).expanduser()
    if path.is_file():
        lines += path.read_text(encoding="utf-8").splitlines()
    patterns = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("re:"):
            patterns.append(re.compile(line[3:]))
        else:
            patterns.append(re.compile(re.escape(line), re.I))
    return patterns


def iter_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = Path(dirpath) / name
            try:
                if path.stat().st_size > MAX_BYTES:
                    continue
                data = path.read_bytes()
            except OSError:
                continue
            if b"\0" in data[:8192]:
                continue                                   # binary
            yield path, data.decode("utf-8", errors="replace")


def scan(root: Path, patterns: list[re.Pattern]) -> tuple[int, list[str], list[str]]:
    files = 0
    hits: list[str] = []
    warnings: list[str] = []
    this_file = Path(__file__).resolve()
    for path, text in iter_files(root):
        files += 1
        rel = path.relative_to(root)
        for number, line in enumerate(text.splitlines(), 1):
            for index, pattern in enumerate(patterns, 1):
                if pattern.search(line) or pattern.search(rel.as_posix()):
                    hits.append(f"{rel}:{number}  denylist pattern #{index}")
            if path.resolve() == this_file:
                continue
            if CYRILLIC.search(line) and rel.parts[0] not in CYRILLIC_OK_DIRS:
                hits.append(f"{rel}:{number}  cyrillic text")
            if path.name not in LOCKFILES and any(not EMAIL_OK.search(m.group(0)) for m in EMAIL.finditer(line)):
                hits.append(f"{rel}:{number}  e-mail address")
            if HOME_PATH.search(line):
                warnings.append(f"{rel}:{number}  absolute home-folder path")
    return files, hits, warnings


def main() -> int:
    args = sys.argv[1:]
    require_denylist = "--require-denylist" in args
    args = [a for a in args if a != "--require-denylist"]
    root = Path(args[0]).resolve() if args else Path(__file__).resolve().parents[2]
    patterns = load_patterns()
    if not patterns:
        if require_denylist:
            print("No denylist found. Set IC_PII_PATTERNS or create ~/.config/interview-coach/denylist.txt.")
            return 2
        print("No denylist configured: running the built-in checks only.")
    files, hits, warnings = scan(root, patterns)
    for hit in hits:
        print("HIT   ", hit)
    for warning in warnings:
        print("WARN  ", warning)
    print(f"Scanned {files} files under {root.name}/ with {len(patterns)} patterns: "
          f"{len(hits)} hits, {len(warnings)} warnings.")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
