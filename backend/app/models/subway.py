from datetime import datetime, time

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SubwayTimetableEntry(Base):
    __tablename__ = "subway_timetable_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # up | down
    day_type: Mapped[str] = mapped_column(String(10), nullable=False)   # weekday|saturday|sunday
    departure_time: Mapped[time] = mapped_column(nullable=False)        # 정왕역 출발 시각
    destination: Mapped[str] = mapped_column(String(50), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_subway_tt_dir_day", "direction", "day_type"),
    )
