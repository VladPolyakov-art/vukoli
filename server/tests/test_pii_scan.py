"""Release gate G1 script: the built-in checks work without a denylist (that is how CI runs it)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "pii_scan.py"


def run_scan(root: Path, *args: str, patterns: str = "") -> subprocess.CompletedProcess:
    env = {**os.environ, "IC_PII_DENYLIST_FILE": str(root / "no-denylist.txt"), "IC_PII_PATTERNS": patterns}
    return subprocess.run([sys.executable, str(SCRIPT), *args, str(root)], env=env,
                          capture_output=True, text=True, timeout=30)


def test_clean_tree_passes_without_denylist(tmp_path):
    (tmp_path / "notes.md").write_text("Mike asks about a project you led. Contact: someone@example.com\n")
    result = run_scan(tmp_path)
    assert result.returncode == 0, result.stdout
    assert "built-in checks only" in result.stdout


def test_cyrillic_and_email_fail_without_denylist(tmp_path):
    (tmp_path / "cv.txt").write_text("\u043f\u0440\u0438\u0432\u0435\u0442\n")
    (tmp_path / "contact.txt").write_text("write to " + "jane.doe" + "@" + "acme-corp.io" + "\n")
    (tmp_path / "package-lock.json").write_text('{"deprecated": "contact ' + "dev" + "@" + "lib.me" + '"}\n')
    result = run_scan(tmp_path)
    assert result.returncode == 1
    assert "cv.txt:1  cyrillic text" in result.stdout
    assert "contact.txt:1  e-mail address" in result.stdout
    assert "package-lock.json" not in result.stdout


def test_require_denylist_and_patterns_are_not_printed(tmp_path):
    assert run_scan(tmp_path, "--require-denylist").returncode == 2
    (tmp_path / "a.txt").write_text("Fictional Person was here\n")
    result = run_scan(tmp_path, "--require-denylist", patterns="fictional person")
    assert result.returncode == 1
    assert "denylist pattern #1" in result.stdout
    assert "fictional person" not in result.stdout.lower()


def test_cyrillic_is_allowed_only_under_top_level_design(tmp_path):
    (tmp_path / "design" / "docs").mkdir(parents=True)
    (tmp_path / "design" / "docs" / "ui.md").write_text("\u043f\u0440\u0438\u0432\u0435\u0442\n")
    assert run_scan(tmp_path).returncode == 0
    (tmp_path / "design" / "docs" / "mail.md").write_text("write to " + "jane.doe" + "@" + "acme-corp.io" + "\n")
    (tmp_path / "web").mkdir()
    (tmp_path / "web" / "design").mkdir()
    (tmp_path / "web" / "design" / "x.ts").write_text("// \u043f\u0440\u0438\u0432\u0435\u0442\n")
    result = run_scan(tmp_path)
    assert result.returncode == 1
    assert "design/docs/mail.md:1  e-mail address" in result.stdout
    assert "web/design/x.ts:1  cyrillic text" in result.stdout
    assert "ui.md" not in result.stdout
