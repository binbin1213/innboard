import logging
import secrets
import threading
import time
from datetime import datetime, timedelta

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import AuthSession
from .settings import get_setting, verify_password

logger = logging.getLogger(__name__)

SESSION_DAYS = 7

# 登录限流：同一来源在窗口期内连续失败达到上限后临时锁定
LOGIN_MAX_FAILURES = 5
LOGIN_WINDOW_SECONDS = 300
LOGIN_LOCK_SECONDS = 300

_lock = threading.Lock()
_failures: dict[str, list[float]] = {}
_locked_until: dict[str, float] = {}


def client_ip(request: Request) -> str:
    """取真实客户端 IP，兼容 Cloudflare 与常见反代头。"""
    forwarded = request.headers.get("cf-connecting-ip")
    if not forwarded:
        forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune(history: list[float], now: float) -> list[float]:
    return [t for t in history if now - t < LOGIN_WINDOW_SECONDS]


def check_login_allowed(ip: str) -> bool:
    now = time.time()
    with _lock:
        until = _locked_until.get(ip, 0)
        if until > now:
            return False
        if until and until <= now:
            _locked_until.pop(ip, None)
        return True


def record_login_failure(ip: str) -> None:
    now = time.time()
    with _lock:
        history = _prune(_failures.get(ip, []), now)
        history.append(now)
        _failures[ip] = history
        if len(history) >= LOGIN_MAX_FAILURES:
            _locked_until[ip] = now + LOGIN_LOCK_SECONDS
            logger.warning("来源 %s 登录失败次数过多，已锁定 %s 秒", ip, LOGIN_LOCK_SECONDS)


def reset_login_failures(ip: str) -> None:
    with _lock:
        _failures.pop(ip, None)
        _locked_until.pop(ip, None)


def purge_expired_sessions(db: Session) -> int:
    """清理过期会话，避免 sessions 表长期只增不减。"""
    removed = (
        db.query(AuthSession)
        .filter(AuthSession.expires_at <= datetime.now())
        .delete(synchronize_session=False)
    )
    if removed:
        db.commit()
    return removed


def authenticate(db: Session, username: str, password: str) -> str | None:
    if username != "admin":
        return None
    stored = get_setting(db, "admin_password")
    if not stored or not verify_password(password, stored):
        return None
    token = secrets.token_hex(32)
    db.add(AuthSession(token=token, expires_at=datetime.now() + timedelta(days=SESSION_DAYS)))
    purge_expired_sessions(db)
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
