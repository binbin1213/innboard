import io
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image as PILImage, ImageOps
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..database import UPLOAD_DIR, get_db
from ..models import Announcement, Image, PriceLog, Room, Setting
from ..settings import get_setting, set_setting
from ..uploads import validate_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["admin"])

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
SIZE_LIMIT = 20 * 1024 * 1024
# 图片优化：大屏轮播为 16:9 横条，长边 1920px 足够；超过该尺寸或 500KB 即压缩
OPT_MAX_EDGE = 1920
OPT_MAX_BYTES = 500 * 1024


def _optimize_image(data: bytes, real_ext: str) -> bytes:
    """压缩上传图片（保持原格式）：gif 动画跳过；超过尺寸/体积才处理。

    失败时原样返回，不影响上传流程。
    """
    if real_ext == ".gif":
        return data
    try:
        im = PILImage.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)  # 修正手机照片方向
        w, h = im.size
        need_resize = max(w, h) > OPT_MAX_EDGE
        need_compress = len(data) > OPT_MAX_BYTES
        if not (need_resize or need_compress):
            return data
        if need_resize:
            ratio = OPT_MAX_EDGE / max(w, h)
            im = im.resize((int(w * ratio), int(h * ratio)), PILImage.LANCZOS)
        buf = io.BytesIO()
        if real_ext == ".png":
            im.save(buf, "PNG", optimize=True)  # 保留透明度
        elif real_ext == ".webp":
            im.save(buf, "WEBP", quality=82, method=6)
        else:
            im.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
        out = buf.getvalue()
        return out if len(out) < len(data) else data
    except Exception:
        logger.warning("图片优化失败，保留原文件", exc_info=True)
        return data


def next_sort_order(db: Session, model) -> int:
    """取当前最大排序值 +1。

    不能用 count()：删除记录后 count 会小于最大 sort_order，
    导致新建记录与已有记录撞号，排序结果不稳定。
    """
    current_max = db.query(func.max(model.sort_order)).scalar()
    return (current_max if current_max is not None else -1) + 1


def room_dict(r: Room) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "rack_price": r.rack_price,
        "member_price": r.member_price,
        "description": r.description,
        "remaining_rooms": r.remaining_rooms,
        "sold_out": r.sold_out,
        "sort_order": r.sort_order,
    }


def discard_upload(filename: str) -> None:
    """落盘后数据库写入失败时回收文件，避免留下孤儿文件。"""
    if not filename:
        return
    try:
        (UPLOAD_DIR / filename).unlink()
    except OSError:
        logger.warning("回收上传文件失败: %s", filename, exc_info=True)


def _unlink_upload(filename: str) -> None:
    """删除被替换掉的旧文件，失败不影响主流程。"""
    if not filename:
        return
    try:
        (UPLOAD_DIR / filename).unlink()
    except OSError:
        logger.warning("删除旧文件失败: %s", filename, exc_info=True)


async def save_upload(file: UploadFile) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="仅支持 jpg/png/webp/gif 图片")
    content = await file.read(SIZE_LIMIT + 1)
    if len(content) > SIZE_LIMIT:
        raise HTTPException(status_code=400, detail="图片大小不能超过 20MB")
    try:
        # 以文件真实类型存盘，防止把伪装成图片的文件写进 uploads
        real_ext = validate_image(content, ext)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    filename = f"{uuid.uuid4().hex}{real_ext}"
    (UPLOAD_DIR / filename).write_bytes(_optimize_image(content, real_ext))
    return filename


# ---------- 房型 ----------

class RoomCreate(BaseModel):
    name: str
    rack_price: float
    member_price: float
    description: str = ""
    remaining_rooms: int | None = None


class RoomUpdate(BaseModel):
    name: str | None = None
    rack_price: float | None = None
    member_price: float | None = None
    description: str | None = None
    remaining_rooms: int | None = None
    sold_out: bool | None = None


class ReorderBody(BaseModel):
    ids: list[int]


@router.get("/rooms")
def list_rooms(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    rooms = db.query(Room).order_by(Room.sort_order, Room.id).all()
    return [room_dict(r) for r in rooms]


@router.post("/rooms")
def create_room(body: RoomCreate, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="房型名称不能为空")
    if body.rack_price < 0 or body.member_price < 0:
        raise HTTPException(status_code=400, detail="价格不能为负数")
    if body.remaining_rooms is not None and body.remaining_rooms < 0:
        raise HTTPException(status_code=400, detail="剩余间数不能为负数")
    max_order = next_sort_order(db, Room)
    room = Room(
        name=body.name.strip(),
        rack_price=body.rack_price,
        member_price=body.member_price,
        description=body.description.strip(),
        remaining_rooms=body.remaining_rooms,
        sort_order=max_order,
    )
    db.add(room)
    db.commit()
    logger.info("新增房型: %s（门市价 %s / 会员价 %s）", room.name, room.rack_price, room.member_price)
    return room_dict(room)


@router.put("/rooms/{room_id}")
def update_room(room_id: int, body: RoomUpdate, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房型不存在")
    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(status_code=400, detail="房型名称不能为空")
        room.name = body.name.strip()
    if body.rack_price is not None and body.rack_price < 0:
        raise HTTPException(status_code=400, detail="价格不能为负数")
    if body.member_price is not None and body.member_price < 0:
        raise HTTPException(status_code=400, detail="价格不能为负数")
    if body.remaining_rooms is not None and body.remaining_rooms < 0:
        raise HTTPException(status_code=400, detail="剩余间数不能为负数")
    old_rack, old_member = room.rack_price, room.member_price
    if body.rack_price is not None:
        room.rack_price = body.rack_price
    if body.member_price is not None:
        room.member_price = body.member_price
    if body.description is not None:
        room.description = body.description.strip()
    if "remaining_rooms" in body.model_fields_set:
        room.remaining_rooms = body.remaining_rooms
    if room.rack_price != old_rack or room.member_price != old_member:
        db.add(
            PriceLog(
                room_id=room.id,
                room_name=room.name,
                old_rack_price=old_rack,
                new_rack_price=room.rack_price,
                old_member_price=old_member,
                new_member_price=room.member_price,
            )
        )
    if body.sold_out is not None:
        room.sold_out = body.sold_out
    db.commit()
    logger.info(
        "修改房型 #%s %s：门市价 %s->%s，会员价 %s->%s",
        room.id, room.name, old_rack, room.rack_price, old_member, room.member_price,
    )
    return room_dict(room)


@router.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房型不存在")
    # 数据库已启用外键约束，需先清理关联的价格日志
    db.query(PriceLog).filter(PriceLog.room_id == room_id).delete(synchronize_session=False)
    db.delete(room)
    db.commit()
    logger.info("删除房型 #%s %s", room_id, room.name)
    return {"ok": True}


@router.post("/rooms/reorder")
def reorder_rooms(body: ReorderBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    for index, room_id in enumerate(body.ids):
        room = db.get(Room, room_id)
        if room:
            room.sort_order = index
    db.commit()
    return {"ok": True}


@router.get("/rooms/logs")
def list_price_logs(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    logs = db.query(PriceLog).order_by(PriceLog.id.desc()).limit(50).all()
    return [
        {
            "id": log.id,
            "room_name": log.room_name,
            "old_rack_price": log.old_rack_price,
            "new_rack_price": log.new_rack_price,
            "old_member_price": log.old_member_price,
            "new_member_price": log.new_member_price,
            "created_at": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for log in logs
    ]


# ---------- 图片 ----------

@router.get("/images")
def list_images(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    images = db.query(Image).order_by(Image.sort_order, Image.id).all()
    return [
        {"id": img.id, "url": f"/uploads/{img.filename}", "sort_order": img.sort_order}
        for img in images
    ]


@router.post("/images")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(require_auth)):
    filename = await save_upload(file)
    try:
        image = Image(filename=filename, sort_order=next_sort_order(db, Image))
        db.add(image)
        db.commit()
    except Exception:
        db.rollback()
        discard_upload(filename)
        logger.exception("图片入库失败")
        raise
    logger.info("上传图片: %s", filename)
    return {"id": image.id, "url": f"/uploads/{image.filename}"}


@router.delete("/images/{image_id}")
def delete_image(image_id: int, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    db.delete(image)
    db.commit()
    _unlink_upload(image.filename)
    logger.info("删除图片 #%s %s", image_id, image.filename)
    return {"ok": True}


@router.post("/images/reorder")
def reorder_images(body: ReorderBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    for index, image_id in enumerate(body.ids):
        image = db.get(Image, image_id)
        if image:
            image.sort_order = index
    db.commit()
    return {"ok": True}


# ---------- 公告 ----------

class AnnouncementBody(BaseModel):
    text: str


@router.get("/announcements")
def list_announcements(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    items = db.query(Announcement).order_by(Announcement.sort_order, Announcement.id).all()
    return [{"id": a.id, "text": a.text, "sort_order": a.sort_order} for a in items]


@router.post("/announcements")
def create_announcement(body: AnnouncementBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="公告内容不能为空")
    item = Announcement(text=body.text.strip(), sort_order=next_sort_order(db, Announcement))
    db.add(item)
    db.commit()
    logger.info("新增公告: %s", item.text[:30])
    return {"id": item.id, "text": item.text, "sort_order": item.sort_order}


@router.put("/announcements/{announcement_id}")
def update_announcement(announcement_id: int, body: AnnouncementBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    item = db.get(Announcement, announcement_id)
    if not item:
        raise HTTPException(status_code=404, detail="公告不存在")
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="公告内容不能为空")
    item.text = body.text.strip()
    db.commit()
    return {"id": item.id, "text": item.text, "sort_order": item.sort_order}


@router.delete("/announcements/{announcement_id}")
def delete_announcement(announcement_id: int, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    item = db.get(Announcement, announcement_id)
    if not item:
        raise HTTPException(status_code=404, detail="公告不存在")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/announcements/reorder")
def reorder_announcements(body: ReorderBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    for index, announcement_id in enumerate(body.ids):
        item = db.get(Announcement, announcement_id)
        if item:
            item.sort_order = index
    db.commit()
    return {"ok": True}


# ---------- 系统设置 ----------

class SettingsBody(BaseModel):
    hotel_name: str | None = None
    hotel_name_en: str | None = None
    carousel_interval: int | None = None
    weather_api_key: str | None = None
    weather_city: str | None = None
    logo_size: int | None = None
    theme: str | None = None
    festival: str | None = None


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    logo = get_setting(db, "logo_filename")
    qr = get_setting(db, "qr_filename")
    return {
        "hotel_name": get_setting(db, "hotel_name"),
        "hotel_name_en": get_setting(db, "hotel_name_en"),
        "carousel_interval": int(get_setting(db, "carousel_interval", "5")),
        "weather_api_key": get_setting(db, "weather_api_key"),
        "weather_city": get_setting(db, "weather_city"),
        "logo_url": f"/uploads/{logo}" if logo else "",
        "logo_size": int(get_setting(db, "logo_size", "96")),
        "qr_url": f"/uploads/{qr}" if qr else "",
        "theme": get_setting(db, "theme", "navy"),
        "festival": get_setting(db, "festival", ""),
    }


@router.put("/settings")
def update_settings(body: SettingsBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    if body.hotel_name is not None:
        set_setting(db, "hotel_name", body.hotel_name.strip())
    if body.hotel_name_en is not None:
        set_setting(db, "hotel_name_en", body.hotel_name_en.strip())
    if body.carousel_interval is not None:
        if not 3 <= body.carousel_interval <= 60:
            raise HTTPException(status_code=400, detail="轮播间隔需在 3～60 秒之间")
        set_setting(db, "carousel_interval", str(body.carousel_interval))
    if body.logo_size is not None:
        if not 40 <= body.logo_size <= 160:
            raise HTTPException(status_code=400, detail="LOGO 尺寸需在 40～160 像素之间")
        set_setting(db, "logo_size", str(body.logo_size))
    if body.weather_api_key is not None:
        set_setting(db, "weather_api_key", body.weather_api_key.strip())
    if body.weather_city is not None:
        set_setting(db, "weather_city", body.weather_city.strip())
    if body.theme is not None:
        theme = body.theme.strip()
        if theme not in ("navy", "green", "wine", "black", "purple", "brown"):
            raise HTTPException(status_code=400, detail="未知的背景主题")
        set_setting(db, "theme", theme)
    if body.festival is not None:
        festival = body.festival.strip()
        if festival not in ("", "spring", "dragon", "midautumn", "national"):
            raise HTTPException(status_code=400, detail="未知的节日装饰")
        set_setting(db, "festival", festival)
    db.commit()
    changed = ", ".join(body.model_fields_set) or "无"
    logger.info("更新系统设置，变更字段: %s", changed)
    return get_settings(db, _)


@router.post("/settings/logo")
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(require_auth)):
    filename = await save_upload(file)
    old = get_setting(db, "logo_filename")
    try:
        set_setting(db, "logo_filename", filename)
        db.commit()
    except Exception:
        db.rollback()
        discard_upload(filename)
        logger.exception("LOGO 入库失败")
        raise
    _unlink_upload(old)
    logger.info("更新 LOGO: %s", filename)
    return {"logo_url": f"/uploads/{filename}"}


@router.post("/settings/qr")
async def upload_qr(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(require_auth)):
    filename = await save_upload(file)
    old = get_setting(db, "qr_filename")
    try:
        set_setting(db, "qr_filename", filename)
        db.commit()
    except Exception:
        db.rollback()
        discard_upload(filename)
        logger.exception("二维码入库失败")
        raise
    _unlink_upload(old)
    logger.info("更新二维码: %s", filename)
    return {"qr_url": f"/uploads/{filename}"}


# ---------- 欢迎致辞 ----------

class WelcomeBody(BaseModel):
    enabled: bool = True
    title: str = ""
    subtitle: str = ""
    message: str = ""
    end_time: str = ""


def welcome_dict(db: Session) -> dict:
    logo = get_setting(db, "welcome_image_filename")
    return {
        "enabled": get_setting(db, "welcome_enabled") == "1",
        "title": get_setting(db, "welcome_title"),
        "subtitle": get_setting(db, "welcome_subtitle"),
        "message": get_setting(db, "welcome_message"),
        "image_url": f"/uploads/{logo}" if logo else "",
        "end_time": get_setting(db, "welcome_end_time"),
        "hotel_name": get_setting(db, "hotel_name"),
    }


@router.get("/welcome")
def get_welcome_config(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    return welcome_dict(db)


@router.put("/welcome")
def update_welcome(body: WelcomeBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    set_setting(db, "welcome_enabled", "1" if body.enabled else "0")
    set_setting(db, "welcome_title", body.title.strip())
    set_setting(db, "welcome_subtitle", body.subtitle.strip())
    set_setting(db, "welcome_message", body.message.strip())
    set_setting(db, "welcome_end_time", body.end_time.strip())
    db.commit()
    return welcome_dict(db)


@router.post("/welcome/image")
async def upload_welcome_image(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(require_auth)):
    filename = await save_upload(file)
    old = get_setting(db, "welcome_image_filename")
    try:
        set_setting(db, "welcome_image_filename", filename)
        db.commit()
    except Exception:
        db.rollback()
        discard_upload(filename)
        logger.exception("欢迎背景图入库失败")
        raise
    _unlink_upload(old)
    logger.info("更新欢迎背景图: %s", filename)
    return {"image_url": f"/uploads/{filename}"}


@router.delete("/welcome/image")
def delete_welcome_image(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    old = get_setting(db, "welcome_image_filename")
    set_setting(db, "welcome_image_filename", "")
    db.commit()
    _unlink_upload(old)
    logger.info("删除欢迎背景图")
    return {"ok": True}
