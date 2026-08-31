"""维护任务测试：重点确认不会误删用户文件。"""

import os
import time

import pytest

from app import maintenance
from app.database import UPLOAD_DIR, SessionLocal

_SAMPLE_NAMES = ("orphan-disabled.jpg", "orphan-enabled.jpg", "just-uploaded.jpg")


@pytest.fixture(autouse=True)
def _isolated_uploads():
    """逐个测试清理残留文件，避免用例之间互相污染。"""
    yield
    for name in _SAMPLE_NAMES:
        for base in (UPLOAD_DIR, maintenance.TRASH_DIR):
            path = base / name
            if path.exists():
                path.unlink()

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00"
    b"\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _age(path, hours=5):
    """把文件时间改旧，绕过孤儿判定的静置保护期。"""
    stamp = time.time() - hours * 3600
    os.utime(path, (stamp, stamp))


def test_orphan_untouched_when_cleanup_disabled(monkeypatch):
    """默认必须不回收任何文件，只记录告警。"""
    orphan = UPLOAD_DIR / "orphan-disabled.jpg"
    orphan.write_bytes(b"not really an image")
    _age(orphan)

    monkeypatch.setattr(maintenance, "CLEANUP_ORPHAN_ENABLED", False)
    db = SessionLocal()
    try:
        assert maintenance.cleanup_orphan_uploads(db) == 0
    finally:
        db.close()
    assert orphan.exists(), "未开启回收时文件必须原地保留"


def test_orphan_moved_to_trash_when_enabled(monkeypatch):
    """开启后只隔离到回收目录，不直接删除。"""
    orphan = UPLOAD_DIR / "orphan-enabled.jpg"
    orphan.write_bytes(b"not really an image")
    _age(orphan)

    monkeypatch.setattr(maintenance, "CLEANUP_ORPHAN_ENABLED", True)
    db = SessionLocal()
    try:
        assert maintenance.cleanup_orphan_uploads(db) == 1
    finally:
        db.close()
    assert not orphan.exists()
    assert (maintenance.TRASH_DIR / "orphan-enabled.jpg").exists()


def test_referenced_upload_never_recycled(monkeypatch, client, auth_headers):
    """数据库里仍在使用的图片，即使文件很旧也不能被回收。"""
    files = {"file": ("in-use.png", PNG_BYTES, "image/png")}
    res = client.post("/api/images", files=files, headers=auth_headers)
    assert res.status_code == 200
    filename = res.json()["url"].rsplit("/", 1)[-1]
    path = UPLOAD_DIR / filename
    _age(path, hours=24)

    monkeypatch.setattr(maintenance, "CLEANUP_ORPHAN_ENABLED", True)
    db = SessionLocal()
    try:
        maintenance.cleanup_orphan_uploads(db)
    finally:
        db.close()
    assert path.exists(), "被引用的图片不能被回收"


def test_fresh_file_protected_by_grace_period(monkeypatch):
    """刚落盘的文件处于保护期内，不能因异步入库延迟被误判。"""
    fresh = UPLOAD_DIR / "just-uploaded.jpg"
    fresh.write_bytes(b"x")

    monkeypatch.setattr(maintenance, "CLEANUP_ORPHAN_ENABLED", True)
    db = SessionLocal()
    try:
        assert maintenance.cleanup_orphan_uploads(db) == 0
    finally:
        db.close()
    assert fresh.exists()


def test_backup_creates_file():
    target = maintenance.backup_database()
    assert target is not None
    assert target.exists()
    assert target.stat().st_size > 0
