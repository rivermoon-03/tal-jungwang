from datetime import date, datetime, time

from sqlalchemy import DateTime, ForeignKey, Index, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SchedulePeriod(Base):
    __tablename__ = "schedule_periods"

    id: Mapped[int] = mapped_column(primary_key=True)
    period_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # SEMESTER | VACATION | EXAM | HOLIDAY | SUSPENDED
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(nullable=False)
    end_date: Mapped[date] = mapped_column(nullable=False)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notice_message: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    shuttle_entries: Mapped[list["ShuttleTimetableEntry"]] = relationship(
        back_populates="schedule_period"
    )


class ShuttleRoute(Base):
    __tablename__ = "shuttle_routes"

    id: Mapped[int] = mapped_column(primary_key=True)
    direction: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=등교, 1=하교
    description: Mapped[str | None] = mapped_column(String(255))

    shuttle_entries: Mapped[list["ShuttleTimetableEntry"]] = relationship(
        back_populates="shuttle_route"
    )


class ShuttleTimetableEntry(Base):
    __tablename__ = "shuttle_timetable_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_period_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_periods.id", ondelete="CASCADE"), nullable=False
    )
    shuttle_route_id: Mapped[int] = mapped_column(
        ForeignKey("shuttle_routes.id", ondelete="CASCADE"), nullable=False
    )
    day_type: Mapped[str] = mapped_column(String(10), nullable=False)  # weekday|saturday|sunday
    departure_time: Mapped[time] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(String(100))

    schedule_period: Mapped["SchedulePeriod"] = relationship(back_populates="shuttle_entries")
    shuttle_route: Mapped["ShuttleRoute"] = relationship(back_populates="shuttle_entries")

    __table_args__ = (
        Index(
            "idx_shuttle_tt_period_route_day",
            "schedule_period_id", "shuttle_route_id", "day_type",
        ),
    )
