from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Index, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TrafficHistory(Base):
    __tablename__ = "traffic_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    road_name: Mapped[str] = mapped_column(String(50), nullable=False)
    direction: Mapped[str] = mapped_column(String(15), nullable=False)  # to_station | to_school
    speed: Mapped[Decimal] = mapped_column(Numeric(5, 1), nullable=False)  # km/h
    duration_seconds: Mapped[int] = mapped_column(nullable=False)
    distance_meters: Mapped[int] = mapped_column(nullable=False)
    congestion: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1~4
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_traffic_road_dir_time", "road_name", "direction", "collected_at"),
        Index("idx_traffic_collected_at", "collected_at"),
    )
