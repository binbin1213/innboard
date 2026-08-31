import hashlib
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Announcement, Image, Room
from ..settings import get_setting
from ..weather import get_weather

router = APIRouter(prefix="/api", tags=["display"])


def get_welcome(db: Session) -> dict:
    """欢迎致辞配置：enabled 含到期自动失效判断（到期自动恢复图片轮播）。"""
    enabled = get_setting(db, "welcome_enabled") == "1"
    end_time = get_setting(db, "welcome_end_time")
    if enabled and end_time:
        try:
            end_dt = datetime.fromisoformat(end_time)
            if datetime.now().astimezone() > end_dt.astimezone():
                enabled = False
        except ValueError:
            pass
    image = get_setting(db, "welcome_image_filename")
    return {
        "enabled": enabled,
        "title": get_setting(db, "welcome_title"),
        "subtitle": get_setting(db, "welcome_subtitle"),
        "message": get_setting(db, "welcome_message"),
        "image_url": f"/uploads/{image}" if image else "",
        "end_time": end_time,
    }


@router.get("/display")
def get_display(request: Request, db: Session = Depends(get_db)):
    rooms = db.query(Room).order_by(Room.sort_order, Room.id).all()
    images = db.query(Image).order_by(Image.sort_order, Image.id).all()
    announcements = db.query(Announcement).order_by(Announcement.sort_order, Announcement.id).all()

    logo = get_setting(db, "logo_filename")
    qr = get_setting(db, "qr_filename")
    weather = get_weather(
        get_setting(db, "weather_api_key"),
        get_setting(db, "weather_city"),
    )

    payload = {
        "hotel_name": get_setting(db, "hotel_name"),
        "hotel_name_en": get_setting(db, "hotel_name_en"),
        "theme": get_setting(db, "theme", "navy"),
        "festival": get_setting(db, "festival", ""),
        "logo_url": f"/uploads/{logo}" if logo else "",
        "logo_size": int(get_setting(db, "logo_size", "96")),
        "qr_url": f"/uploads/{qr}" if qr else "",
        "carousel_interval": int(get_setting(db, "carousel_interval", "5")),
        "images": [f"/uploads/{img.filename}" for img in images],
        "welcome": get_welcome(db),
        "rooms": [
            {
                "name": r.name,
                "rack_price": r.rack_price,
                "member_price": r.member_price,
                "description": r.description,
                "remaining_rooms": r.remaining_rooms,
                "sold_out": r.sold_out,
            }
            for r in rooms
        ],
        "announcements": [a.text for a in announcements],
        "weather_city": get_setting(db, "weather_city"),
        "weather": weather,
        "server_time": datetime.now().astimezone().isoformat(),
    }

    # server_time 每次请求都在变，必须排除在 ETag 之外，否则缓存永不命中。
    # 客户端已用首次返回的 server_time 算出时钟偏移，304 时沿用即可。
    fingerprint = {k: v for k, v in payload.items() if k != "server_time"}
    digest = hashlib.md5(
        json.dumps(fingerprint, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    ).hexdigest()
    etag = f'"{digest}"'

    headers = {"ETag": etag, "Cache-Control": "no-cache"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)

    return Response(
        content=json.dumps(payload, ensure_ascii=False, default=str),
        media_type="application/json; charset=utf-8",
        headers=headers,
    )
