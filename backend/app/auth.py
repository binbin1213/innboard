import secrets
from datetime import datetime, timedelta

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuthSession
from .settings import get_setting, verify_password

SESSION_DAYS = 7


def authenticate(db: Session, username: str, password: str) -> str | None:
    if username != "admin":
        return None
    stored = get_setting(db, "admin_password")
    if not stored or not verify_password(password, stored):
        return None
    token = secrets.token_hex(32)
    db.add(AuthSession(token=token, expires_at=datetime.now() + timedelta(days=SESSION_DAYS)))
    db.commit()
    return token


def require_auth(
    authorization: str = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        row = db.get(AuthSession, token)
        if row and row.expires_at > datetime.now():
            return token
    raise HTTPException(status_code=401, detail="未登录或登录已过期")
