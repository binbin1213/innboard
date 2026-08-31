import hashlib
import logging
import secrets

from sqlalchemy.orm import Session

from .database import DATA_DIR
from .models import Setting

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "hotel_name": "欢迎光临",
    "hotel_name_en": "",
    "carousel_interval": "5",
    "weather_api_key": "",
    "weather_city": "",
    "logo_filename": "",
    "logo_size": "96",
    "qr_filename": "",
    "theme": "navy",
    "festival": "",
}

INITIAL_PASSWORD_FILE = DATA_DIR / "initial_password.txt"


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()


def verify_password(password: str, stored: str) -> bool:
    salt, _, hashed = stored.partition(":")
    return secrets.compare_digest(hash_password(password, salt), hashed)


def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.get(Setting, key)
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row:
        row.value = value
    else:
        db.add(Setting(key=key, value=value))


def _persist_initial_password(password: str) -> None:
    """把首次生成的随机密码落到 data 目录，避免只在日志里一闪而过。"""
    content = (
        "管理员初始密码（首次启动自动生成）\n"
        f"用户名: admin\n"
        f"密　码: {password}\n\n"
        "请登录后立即在系统设置中修改密码，确认无误后可删除本文件。\n"
    )
    try:
        INITIAL_PASSWORD_FILE.write_text(content, encoding="utf-8")
    except OSError:
        logger.warning("初始密码文件写入失败: %s", INITIAL_PASSWORD_FILE, exc_info=True)


def ensure_defaults(db: Session) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        if db.get(Setting, key) is None:
            db.add(Setting(key=key, value=value))
    db.commit()

    if not get_setting(db, "admin_password"):
        # 不再使用硬编码默认密码，避免部署后忘记修改而形成公开后门
        password = secrets.token_urlsafe(12)
        salt = secrets.token_hex(16)
        db.add(Setting(key="admin_password", value=f"{salt}:{hash_password(password, salt)}"))
        db.commit()
        _persist_initial_password(password)
        logger.warning("=" * 60)
        logger.warning("已生成管理员初始密码，请查看 %s 后登录并修改", INITIAL_PASSWORD_FILE)
        logger.warning("=" * 60)
