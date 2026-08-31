"""定期维护任务：回收孤儿上传文件 + 数据库备份。"""

import logging
import os
import shutil
import threading
import time
from datetime import datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import (
    BACKUP_DIR,
    DATA_DIR,
    DB_PATH,
    UPLOAD_DIR,
    SessionLocal,
    engine,
)
from .models import Image, Setting

logger = logging.getLogger(__name__)

BACKUP_KEEP = 7
# 刚落盘的文件先不动，避免误删正在上传、尚未入库的文件
ORPHAN_GRACE_SECONDS = 3600
# 孤儿文件默认只隔离不删除：uploads 里可能有用户手动放置的素材，
# 判断失误会造成不可逆丢失，需要显式开启回收
CLEANUP_ORPHAN_ENABLED = os.getenv("CLEANUP_ORPHAN_UPLOADS", "0").lower() in ("1", "true", "yes")
TRASH_DIR = DATA_DIR / "trash"
TRASH_KEEP_DAYS = int(os.getenv("TRASH_KEEP_DAYS", "30"))

SETTING_FILE_KEYS = ("logo_filename", "qr_filename", "welcome_image_filename")


def referenced_filenames(db: Session) -> set[str]:
    """汇总所有仍在使用的上传文件名。"""
    names = {row[0] for row in db.query(Image.filename).all() if row[0]}
    for key in SETTING_FILE_KEYS:
        row = db.get(Setting, key)
        if row and row.value:
            names.add(row.value)
    return names


def find_orphan_uploads(db: Session) -> list[Path]:
    """找出 uploads 中未被任何记录引用、且已过期静置的文件。"""
    if not UPLOAD_DIR.exists():
        return []
    used = referenced_filenames(db)
    now = time.time()
    orphans = []
    for path in UPLOAD_DIR.iterdir():
        # 跳过隐藏文件（.DS_Store 等系统文件永远不会被引用，不必反复告警）
        if path.name.startswith(".") or not path.is_file() or path.name in used:
            continue
        try:
            if now - path.stat().st_mtime < ORPHAN_GRACE_SECONDS:
                continue
        except OSError:
            continue
        orphans.append(path)
    return orphans


def cleanup_orphan_uploads(db: Session) -> int:
    """把孤儿文件移入回收目录（默认不执行，需显式开启）。

    上传流程中落盘与入库不是原子的，异常时会残留文件。
    只在明确开启 CLEANUP_ORPHAN_UPLOADS 时才回收，且移动而非删除，
    避免误伤用户手动放入 uploads 的素材。
    """
    orphans = find_orphan_uploads(db)
    if not orphans:
        return 0

    if not CLEANUP_ORPHAN_ENABLED:
        logger.warning(
            "检测到 %s 个未被引用的上传文件，未自动回收（设置 CLEANUP_ORPHAN_UPLOADS=1 开启）：%s",
            len(orphans),
            ", ".join(p.name for p in orphans[:5]),
        )
        return 0

    if not TRASH_DIR.exists():
        TRASH_DIR.mkdir(parents=True)
    moved = 0
    for path in orphans:
        target = TRASH_DIR / path.name
        if target.exists():
            target = TRASH_DIR / f"{int(time.time())}-{path.name}"
        try:
            shutil.move(str(path), str(target))
            moved += 1
            logger.info("孤儿文件已移入回收目录: %s", path.name)
        except OSError:
            logger.warning("孤儿文件隔离失败: %s", path.name, exc_info=True)
    return moved


def _prune_trash() -> None:
    if not TRASH_DIR.exists():
        return
    deadline = time.time() - TRASH_KEEP_DAYS * 86400
    for path in TRASH_DIR.iterdir():
        if path.name.startswith(".") or not path.is_file():
            continue
        try:
            if path.stat().st_mtime < deadline:
                path.unlink()
        except OSError:
            logger.warning("回收目录清理失败: %s", path, exc_info=True)


def _prune_backups() -> None:
    files = sorted(BACKUP_DIR.glob("hotel-*.db"), key=lambda p: p.name)
    for old in files[:-BACKUP_KEEP]:
        try:
            old.unlink()
        except OSError:
            logger.warning("旧备份删除失败: %s", old, exc_info=True)


def backup_database() -> Path | None:
    """备份 SQLite 数据库。

    使用 VACUUM INTO 而非直接复制文件：WAL 模式下直接复制主库
    会丢掉尚未合并的事务，备份可能不完整。
    """
    if not DB_PATH.exists():
        return None
    if not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = BACKUP_DIR / f"hotel-{stamp}.db"
    # 路径由时间戳生成，无外部输入，直接拼接安全
    try:
        with engine.connect() as conn:
            conn.execute(text(f"VACUUM INTO '{target.as_posix()}'"))
    except Exception:
        logger.exception("数据库备份失败")
        return None
    _prune_backups()
    logger.info("数据库已备份: %s", target.name)
    return target


def run_maintenance() -> None:
    db = SessionLocal()
    try:
        cleanup_orphan_uploads(db)
    finally:
        db.close()
    _prune_trash()
    backup_database()


def start_maintenance_worker(interval_hours: float = 24) -> threading.Thread:
    """启动后台维护线程，容器退出时随主进程结束。"""
    interval = max(1.0, interval_hours) * 3600

    def loop() -> None:
        while True:
            time.sleep(interval)
            try:
                run_maintenance()
            except Exception:
                logger.exception("定期维护任务执行失败")

    thread = threading.Thread(target=loop, name="maintenance", daemon=True)
    thread.start()
    logger.info("定期维护任务已启动，间隔 %s 小时", interval_hours)
    return thread
