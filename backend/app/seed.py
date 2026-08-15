from sqlalchemy.orm import Session

from .models import Announcement, Room

ROOM_DEFAULTS = {
    "标准大床房": ("25㎡ / 1.8m大床 / 含双早", 3),
    "豪华大床房": ("32㎡ / 2.0m大床 / 含双早", None),
    "商务双床房": ("35㎡ / 1.5m双床 / 含双早", None),
    "家庭房": ("45㎡ / 双床+儿童床 / 含三早", 2),
}


def seed_data(db: Session) -> None:
    if db.query(Room).count() == 0:
        for index, name in enumerate(ROOM_DEFAULTS):
            rack = [268, 298, 318, 358][index]
            member = [168, 198, 218, 258][index]
            description, remaining = ROOM_DEFAULTS[name]
            db.add(
                Room(
                    name=name,
                    rack_price=rack,
                    member_price=member,
                    description=description,
                    remaining_rooms=remaining,
                    sort_order=index,
                )
            )
    else:
        for room in db.query(Room).all():
            if room.name in ROOM_DEFAULTS and not room.description:
                description, remaining = ROOM_DEFAULTS[room.name]
                room.description = description
                if room.remaining_rooms is None:
                    room.remaining_rooms = remaining
    if db.query(Announcement).count() == 0:
        db.add_all(
            [
                Announcement(text="入住时间：14:00以后", sort_order=0),
                Announcement(text="退房时间：12:00以前", sort_order=1),
                Announcement(text="早餐时间：07:00-09:30", sort_order=2),
            ]
        )
    db.commit()
