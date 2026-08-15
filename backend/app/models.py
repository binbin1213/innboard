from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    rack_price: Mapped[float]
    member_price: Mapped[float]
    description: Mapped[str] = mapped_column(String(200), default="")
    remaining_rooms: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    sold_out: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(default=0)


class PriceLog(Base):
    __tablename__ = "price_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    room_name: Mapped[str] = mapped_column(String(50))
    old_rack_price: Mapped[float]
    new_rack_price: Mapped[float]
    old_member_price: Mapped[float]
    new_member_price: Mapped[float]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(default=0)


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0)


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")


class AuthSession(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
