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
    # 서해선만 채워짐 (tabriz.kr 시드). K71xx=일산, K72xx=대곡. 실시간 API 매칭용.
    train_no: Mapped[str | None] = mapped_column(String(20), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_subway_tt_dir_day", "direction", "day_type"),
        Index("idx_subway_tt_train_no", "train_no"),
    )
