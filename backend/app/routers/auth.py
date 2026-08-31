import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import (
    authenticate,
    check_login_allowed,
    client_ip,
    purge_expired_sessions,
    record_login_failure,
    require_auth,
    reset_login_failures,
)
from ..database import get_db
from ..models import AuthSession, Setting
from ..settings import (
    INITIAL_PASSWORD_FILE,
    get_setting,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str
    password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
def login(body: LoginBody, request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    if not check_login_allowed(ip):
        raise HTTPException(status_code=429, detail="登录失败次数过多，请稍后再试")

    token = authenticate(db, body.username, body.password)
    if not token:
        record_login_failure(ip)
        logger.warning("登录失败，来源 %s，用户名 %s", ip, body.username)
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    reset_login_failures(ip)
    logger.info("登录成功，来源 %s", ip)
    return {"token": token}


@router.get("/me")
def me(_: str = Depends(require_auth)):
    return {"ok": True}


@router.post("/change-password")
def change_password(
    body: ChangePasswordBody,
    db: Session = Depends(get_db),
    _: str = Depends(require_auth),
):
    stored = get_setting(db, "admin_password")
    if not stored or not verify_password(body.old_password, stored):
        raise HTTPException(status_code=400, detail="原密码错误")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    salt = secrets.token_hex(16)
    db.query(AuthSession).delete()
    row = db.get(Setting, "admin_password")
    row.value = f"{salt}:{hash_password(body.new_password, salt)}"
    db.commit()
    purge_expired_sessions(db)

    # 密码已改为用户自定义，初始密码文件不再需要
    try:
        if INITIAL_PASSWORD_FILE.exists():
            INITIAL_PASSWORD_FILE.unlink()
    except OSError:
        logger.warning("初始密码文件删除失败: %s", INITIAL_PASSWORD_FILE, exc_info=True)

    logger.info("管理员密码已修改")
    return {"ok": True}
