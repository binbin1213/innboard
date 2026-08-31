import logging
import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
# 允许通过环境变量改数据目录，便于测试与自定义部署路径
DATA_DIR = Path(os.getenv("INNBOARD_DATA_DIR") or (BASE_DIR / "data"))
UPLOAD_DIR = Path(os.getenv("INNBOARD_UPLOAD_DIR") or (BASE_DIR / "uploads"))
BACKUP_DIR = DATA_DIR / "backups"
for _dir in (DATA_DIR, UPLOAD_DIR, BACKUP_DIR):
    if not _dir.exists():
        _dir.mkdir(parents=True)

DB_PATH = DATA_DIR / "hotel.db"

logger = logging.getLogger(__name__)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@event.listens_for(Engine, "connect")
def _apply_sqlite_pragmas(dbapi_conn, _connection_record):
    """SQLite 出厂配置偏单进程低并发，这里调整为更适合服务端长期运行的模式。

    - WAL：读写互不阻塞，避免 "database is locked"
    - busy_timeout：并发写时先等待 5 秒而不是立即报错
    - foreign_keys：SQLite 默认不启用外键，必须逐连接显式开启
    """
    cursor = dbapi_conn.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA foreign_keys=ON")
    except Exception:  # pragma: no cover - 非 SQLite 引擎时忽略
        logger.debug("当前数据库不支持 SQLite PRAGMA，已跳过", exc_info=True)
    finally:
        cursor.close()


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
