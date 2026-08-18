from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Announcement, Image, Room
from ..settings import get_setting
from ..weather import get_weather

router = APIRouter(prefix="/api", tags=["display"])


@router.get("/display")
def get_display(db: Session = Depends(get_db)):
    rooms = db.query(Room).order_by(Room.sort_order, Room.id).all()
    images = db.query(Image).order_by(Image.sort_order, Image.id).all()
    announcements = db.query(Announcement).order_by(Announcement.sort_order, Announcement.id).all()

    logo = get_setting(db, "logo_filename")
    qr = get_setting(db, "qr_filename")
    weather = get_weather(
        get_setting(db, "weather_api_key"),
        get_setting(db, "weather_city"),
    )

    return {
        "hotel_name": get_setting(db, "hotel_name"),
        "logo_url": f"/uploads/{logo}" if logo else "",
        "logo_size": int(get_setting(db, "logo_size", "96")),
        "qr_url": f"/uploads/{qr}" if qr else "",
        "carousel_interval": int(get_setting(db, "carousel_interval", "5")),
        "images": [f"/uploads/{img.filename}" for img in images],
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
