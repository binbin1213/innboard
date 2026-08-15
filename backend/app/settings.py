import hashlib
import secrets

from sqlalchemy.orm import Session

from .models import Setting

DEFAULT_SETTINGS = {
    "hotel_name": "欢迎光临",
    "carousel_interval": "5",
    "weather_api_key": "",
    "weather_city": "",
    "logo_filename": "",
    "logo_size": "96",
    "qr_filename": "",
}


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


def ensure_defaults(db: Session) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        if db.get(Setting, key) is None:
            db.add(Setting(key=key, value=value))
    if not get_setting(db, "admin_password"):
        salt = secrets.token_hex(16)
        hashed = hash_password("admin123", salt)
        db.add(Setting(key="admin_password", value=f"{salt}:{hashed}"))
    db.commit()
