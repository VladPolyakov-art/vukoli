#!/usr/bin/env python3
"""Build the Vukoli release archive: <out>/vukoli.zip + <out>/SHA256SUMS.

    python3 install/build_release.py [--src <repo root>] [--out <dir>] [--skip-web-build] [--version X.Y.Z]

Archive layout (one archive for all OSes), top folder `vukoli/`:
    server/   the Python package (server/server), server/content, requirements.txt, pyproject.toml
    web/dist/ the prebuilt web app (users need no Node)
    install/  installer scripts and launchers (without this builder)
    LICENSE, README.md, VERSION

Python standard library only. The archive is reproducible (sorted entries, fixed timestamps), and
shell scripts and macOS launcher files keep their executable bit.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

TOP = "vukoli"
STAMP = (2026, 1, 1, 0, 0, 0)          # fixed timestamp: identical input gives an identical archive
SKIP_DIRS = {"__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".venv", "node_modules", ".git"}
SKIP_SUFFIX = {".pyc", ".pyo"}
SKIP_NAMES = {".DS_Store", ".env"}


def is_exec(rel: str) -> bool:
    """Files that must keep their exec bit inside the archive."""
    parts = rel.split("/")
    if rel.endswith(".sh"):
        return True
    if len(parts) >= 3 and parts[0] == "install" and parts[1] == "macos":
        # the launcher `vukoli` and everything under Vukoli.app/Contents/MacOS
        return parts[2] == "vukoli" or "MacOS" in parts
    return False


def walk(base: Path, rel_root: str):
    """Yield (archive path, file path) for files below base, sorted, skipping caches."""
    if not base.is_dir():
        return
    for path in sorted(base.rglob("*")):
        if not path.is_file() and not path.is_symlink():
            continue
        parts = path.relative_to(base).parts
        if any(p in SKIP_DIRS for p in parts) or path.name in SKIP_NAMES or path.suffix in SKIP_SUFFIX:
            continue
        yield f"{rel_root}/{'/'.join(parts)}", path


def read_version(src: Path) -> str:
    text = (src / "server" / "server" / "__init__.py").read_text(encoding="utf-8")
    m = re.search(r'__version__\s*=\s*"([^"]+)"', text)
    return m.group(1) if m else "0.0.0"


def build_web(src: Path) -> None:
    web = src / "web"
    npm = shutil.which("npm")
    if not npm:
        sys.exit("npm not found. Install Node (LTS) or pass --skip-web-build to use an existing web/dist.")
    for cmd in ([npm, "ci"], [npm, "run", "build"]):
        print("+", " ".join(cmd), f"(in {web})", flush=True)
        subprocess.run(cmd, cwd=web, check=True)


def collect(src: Path) -> list[tuple[str, Path]]:
    entries: list[tuple[str, Path]] = []
    server = src / "server"
    for name in ("requirements.txt", "pyproject.toml"):
        entries.append((f"server/{name}", server / name))
    entries += list(walk(server / "server", "server/server"))
    entries += list(walk(server / "content", "server/content"))
    entries += list(walk(src / "web" / "dist", "web/dist"))
    for rel, path in walk(src / "install", "install"):
        if rel == "install/build_release.py":
            continue
        entries.append((rel, path))
    for name in ("LICENSE", "README.md"):
        if (src / name).is_file():
            entries.append((name, src / name))
    return entries


def main() -> int:
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description="Build vukoli.zip and SHA256SUMS")
    ap.add_argument("--src", type=Path, default=here.parent, help="repo root (default: parent of install/)")
    ap.add_argument("--out", type=Path, default=None, help="output folder (default: <src>/dist-release)")
    ap.add_argument("--skip-web-build", action="store_true", help="use the existing web/dist")
    ap.add_argument("--version", default="", help="written to VERSION (default: server __version__)")
    args = ap.parse_args()

    src = args.src.resolve()
    out = (args.out or src / "dist-release").resolve()
    if not (src / "server" / "server").is_dir():
        sys.exit(f"{src} does not look like the Vukoli repo (no server/server).")
    if not args.skip_web_build:
        build_web(src)
    if not (src / "web" / "dist" / "index.html").is_file():
        sys.exit("web/dist/index.html is missing. Build the web app first (cd web && npm ci && npm run build).")

    version = args.version.strip().lstrip("v") or read_version(src)
    entries = collect(src)
    out.mkdir(parents=True, exist_ok=True)
    zpath = out / "vukoli.zip"
    if zpath.exists():
        zpath.unlink()

    def add(zf: zipfile.ZipFile, arcname: str, data: bytes, executable: bool) -> None:
        info = zipfile.ZipInfo(f"{TOP}/{arcname}", date_time=STAMP)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.create_system = 3                                   # unix: so external_attr carries the mode
        info.external_attr = ((0o100755 if executable else 0o100644) << 16)
        zf.writestr(info, data)

    with zipfile.ZipFile(zpath, "w") as zf:
        add(zf, "VERSION", (version + "\n").encode(), False)
        for rel, path in sorted(entries):
            add(zf, rel, path.read_bytes(), is_exec(rel))

    digest = hashlib.sha256(zpath.read_bytes()).hexdigest()
    (out / "SHA256SUMS").write_text(f"{digest}  vukoli.zip\n", encoding="utf-8")
    size = zpath.stat().st_size / 1_048_576
    print(f"Built {zpath} ({size:.1f} MB, {len(entries) + 1} files, version {version})")
    print(f"SHA256 {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
