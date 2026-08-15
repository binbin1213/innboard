import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import require_auth
from ..database import UPLOAD_DIR, get_db
from ..models import Announcement, Image, PriceLog, Room, Setting
from ..settings import get_setting, set_setting

router = APIRouter(prefix="/api", tags=["admin"])

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
SIZE_LIMIT = 20 * 1024 * 1024


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


async def save_upload(file: UploadFile) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="仅支持 jpg/png/webp/gif 图片")
    content = await file.read(SIZE_LIMIT + 1)
    if len(content) > SIZE_LIMIT:
        raise HTTPException(status_code=400, detail="图片大小不能超过 20MB")
    filename = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / filename).write_bytes(content)
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
    max_order = db.query(Room).count()
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
    if body.remaining_rooms is not None:
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
    return room_dict(room)


@router.delete("/rooms/{room_id}")
def delete_room(room_id: int, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="房型不存在")
    db.delete(room)
    db.commit()
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
    image = Image(filename=filename, sort_order=db.query(Image).count())
    db.add(image)
    db.commit()
    return {"id": image.id, "url": f"/uploads/{image.filename}"}


@router.delete("/images/{image_id}")
def delete_image(image_id: int, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    image = db.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    path = UPLOAD_DIR / image.filename
    if path.exists():
        path.unlink()
    db.delete(image)
    db.commit()
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
    item = Announcement(text=body.text.strip(), sort_order=db.query(Announcement).count())
    db.add(item)
    db.commit()
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
    carousel_interval: int | None = None
    weather_api_key: str | None = None
    weather_city: str | None = None


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), _: str = Depends(require_auth)):
    logo = get_setting(db, "logo_filename")
    qr = get_setting(db, "qr_filename")
    return {
        "hotel_name": get_setting(db, "hotel_name"),
        "carousel_interval": int(get_setting(db, "carousel_interval", "5")),
        "weather_api_key": get_setting(db, "weather_api_key"),
        "weather_city": get_setting(db, "weather_city"),
        "logo_url": f"/uploads/{logo}" if logo else "",
        "qr_url": f"/uploads/{qr}" if qr else "",
    }


@router.put("/settings")
def update_settings(body: SettingsBody, db: Session = Depends(get_db), _: str = Depends(require_auth)):
    if body.hotel_name is not None:
        set_setting(db, "hotel_name", body.hotel_name.strip())
    if body.carousel_interval is not None:
        if not 3 <= body.carousel_interval <= 60:
            raise HTTPException(status_code=400, detail="轮播间隔需在 3～60 秒之间")
        set_setting(db, "carousel_interval", str(body.carousel_interval))
    if body.weather_api_key is not None:
        set_setting(db, "weather_api_key", body.weather_api_key.strip())
    if body.weather_city is not None:
        set_setting(db, "weather_city", body.weather_city.strip())
    db.commit()
    return get_settings(db, _)


@router.post("/settings/logo")
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(require_auth)):
    filename = await save_upload(file)
    old = get_setting(db, "logo_filename")
    if old:
        old_path = UPLOAD_DIR / old
        if old_path.exists():
            old_path.unlink()
    set_setting(db, "logo_filename", filename)
    db.commit()
    return {"logo_url": f"/uploads/{filename}"}


@router.post("/settings/qr")
async def upload_qr(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(require_auth)):
    filename = await save_upload(file)
    old = get_setting(db, "qr_filename")
    if old:
        old_path = UPLOAD_DIR / old
        if old_path.exists():
            old_path.unlink()
    set_setting(db, "qr_filename", filename)
    db.commit()
    return {"qr_url": f"/uploads/{filename}"}
