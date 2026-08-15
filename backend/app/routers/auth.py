import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import authenticate, require_auth
from ..database import get_db
from ..models import AuthSession, Setting
from ..settings import get_setting, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str
    password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    token = authenticate(db, body.username, body.password)
    if not token:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
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
    return {"ok": True}
