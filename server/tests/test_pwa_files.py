"""The files that make Vukoli installable as a Chrome / Edge app: the right type, and never served from a stale cache."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text('<div id="root"></div>')
    (dist / "manifest.webmanifest").write_text('{"name": "Vukoli"}')
    (dist / "sw.js").write_text("// worker")
    (dist / "offline.html").write_text("<h1>offline</h1>")
    (dist / "robots.txt").write_text("User-agent: *")
    monkeypatch.setenv("IC_WEB_DIST", str(dist))
    from server.main import create_app
    with TestClient(create_app()) as c:
        yield c


def test_manifest_has_the_manifest_type(client):
    r = client.get("/manifest.webmanifest")
    assert r.status_code == 200
    assert r.headers["content-type"].split(";")[0] == "application/manifest+json"


@pytest.mark.parametrize("path", ["/manifest.webmanifest", "/sw.js", "/offline.html", "/"])
def test_install_files_are_revalidated(client, path):
    # A stale worker or manifest would keep an old app shell; Chrome re-checks both on its own schedule.
    assert client.get(path).headers["cache-control"] == "no-cache"


def test_other_static_files_keep_default_caching(client):
    r = client.get("/robots.txt")
    assert r.status_code == 200
    assert "cache-control" not in r.headers
