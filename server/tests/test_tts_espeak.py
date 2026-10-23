"""espeak-ng exits the whole process when its data folder path is too long; tts.py copies the folder to a short path."""
from __future__ import annotations

import shutil

import espeakng_loader
import pytest

from server import config, tts


@pytest.fixture
def fake_data(tmp_path, monkeypatch):
    source = tmp_path / "deep" / "espeak-ng-data"
    (source / "voices").mkdir(parents=True)
    (source / "phontab").write_text("tab")
    (source / "voices" / "en").write_text("v")
    monkeypatch.setattr(espeakng_loader, "get_data_path", lambda: str(source))
    return source


def test_short_path_is_used_as_is(fake_data, monkeypatch):
    monkeypatch.setattr(tts, "ESPEAK_PATH_LIMIT", len(str(fake_data)))
    assert tts.espeak_data_path() == (None, True)


def test_long_path_is_copied_under_data_dir(fake_data, monkeypatch, tmp_path):
    short = tmp_path / "s"
    short.mkdir()
    monkeypatch.setattr(config, "data_dir", lambda: short)
    monkeypatch.setattr(tts, "ESPEAK_PATH_LIMIT", len(str(fake_data)) - 1)
    target = short / tts.ESPEAK_DATA_NAME
    assert len(str(target)) <= tts.ESPEAK_PATH_LIMIT
    assert tts.espeak_data_path() == (str(target), True)
    assert (target / "phontab").read_text() == "tab" and (target / "voices" / "en").exists()
    assert not list(short.glob("*.tmp-*"))


def test_existing_copy_is_reused_and_broken_copy_is_redone(fake_data, monkeypatch, tmp_path):
    short = tmp_path / "s"
    short.mkdir()
    monkeypatch.setattr(config, "data_dir", lambda: short)
    monkeypatch.setattr(tts, "ESPEAK_PATH_LIMIT", len(str(fake_data)) - 1)
    folder, _ = tts.espeak_data_path()
    marker = short / tts.ESPEAK_DATA_NAME / "marker"
    marker.write_text("x")
    tts.espeak_data_path()
    assert marker.exists()                                   # complete copy: not touched
    (short / tts.ESPEAK_DATA_NAME / "phontab").unlink()      # incomplete copy: replaced
    tts.espeak_data_path()
    assert (short / tts.ESPEAK_DATA_NAME / "phontab").exists() and not marker.exists()


def test_falls_back_to_temp_dir_then_gives_up(fake_data, monkeypatch, tmp_path):
    long_data = tmp_path / ("x" * 40)
    long_data.mkdir()
    monkeypatch.setattr(config, "data_dir", lambda: long_data)
    temp_root = tmp_path / "t"
    temp_root.mkdir()
    monkeypatch.setattr(tts.tempfile, "gettempdir", lambda: str(temp_root))
    target = temp_root / f"vukoli-{tts.ESPEAK_DATA_NAME}"
    monkeypatch.setattr(tts, "ESPEAK_PATH_LIMIT", len(str(target)))
    deeper = tmp_path / "deeper" / "deeper" / "deeper" / tts.ESPEAK_DATA_NAME
    shutil.copytree(fake_data, deeper)
    monkeypatch.setattr(espeakng_loader, "get_data_path", lambda: str(deeper))
    assert len(str(long_data / tts.ESPEAK_DATA_NAME)) > tts.ESPEAK_PATH_LIMIT
    assert tts.espeak_data_path() == (str(target), True)
    assert (target / "phontab").exists()
    monkeypatch.setattr(tts, "ESPEAK_PATH_LIMIT", 5)          # nothing fits
    assert tts.espeak_data_path() == (None, False)


def test_unusable_espeak_path_means_tts_unavailable(fake_data, monkeypatch, tmp_path):
    folder = tmp_path / "kokoro"
    folder.mkdir()
    (folder / tts.MODEL_FILE).write_bytes(b"m")
    (folder / tts.VOICES_FILE).write_bytes(b"v")
    monkeypatch.setenv("KOKORO_MODEL_DIR", str(folder))
    monkeypatch.setattr(tts, "espeak_data_path", lambda: (None, False))
    state = tts.status()
    assert state["available"] is False and "too long" in state["hint"]
    assert tts.kokoro_model() is None                          # never reaches Kokoro(), which would kill the process
