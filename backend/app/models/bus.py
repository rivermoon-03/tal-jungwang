from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BusStop(Base):
    __tablename__ = "bus_stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sub_name: Mapped[str | None] = mapped_column(String(100))
    gbis_station_id: Mapped[str | None] = mapped_column(String(20), unique=True)
    lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    lng: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)

    timetable_entries: Mapped[list["BusTimetableEntry"]] = relationship(back_populates="stop")
    routes: Mapped[list["BusRoute"]] = relationship(
        secondary="bus_stop_routes", back_populates="stops"
    )


class BusRoute(Base):
    __tablename__ = "bus_routes"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_number: Mapped[str] = mapped_column(String(20), nullable=False)
    route_name: Mapped[str | None] = mapped_column(String(100))
    direction_name: Mapped[str | None] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    gbis_route_id: Mapped[str | None] = mapped_column(String(20))

    @property
    def is_realtime(self) -> bool:
        return self.gbis_route_id is not None

    timetable_entries: Mapped[list["BusTimetableEntry"]] = relationship(back_populates="route")
    stops: Mapped[list["BusStop"]] = relationship(
        secondary="bus_stop_routes", back_populates="routes"
    )

    __table_args__ = (
        UniqueConstraint("route_number", "category", name="uq_bus_routes_number_category"),
    )


class BusStopRoute(Base):
    __tablename__ = "bus_stop_routes"

    bus_stop_id: Mapped[int] = mapped_column(
        ForeignKey("bus_stops.id", ondelete="CASCADE"), primary_key=True
    )
    bus_route_id: Mapped[int] = mapped_column(
        ForeignKey("bus_routes.id", ondelete="CASCADE"), primary_key=True
    )


class BusTimetableEntry(Base):
    __tablename__ = "bus_timetable_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("bus_routes.id", ondelete="CASCADE"))
    stop_id: Mapped[int] = mapped_column(ForeignKey("bus_stops.id"))
    day_type: Mapped[str] = mapped_column(String(10), nullable=False)  # weekday|saturday|sunday
    departure_time: Mapped[time] = mapped_column(nullable=False)
    note: Mapped[str | None] = mapped_column(String(100))

    route: Mapped["BusRoute"] = relationship(back_populates="timetable_entries")
    stop: Mapped["BusStop"] = relationship(back_populates="timetable_entries")

    __table_args__ = (
        Index("idx_bus_tt_route_stop_day", "route_id", "stop_id", "day_type"),
    )


class BusCrowdingLog(Base):
    __tablename__ = "bus_crowding_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("bus_routes.id", ondelete="CASCADE"), nullable=False)
    stop_id: Mapped[int] = mapped_column(ForeignKey("bus_stops.id"), nullable=False)
    plate_no: Mapped[str] = mapped_column(String(20), nullable=False)
    crowded: Mapped[int] = mapped_column(nullable=False)  # 1=여유 2=보통 3=혼잡 4=매우혼잡
    arrive_in_seconds: Mapped[int] = mapped_column(nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("idx_crowding_route_stop_at", "route_id", "stop_id", "recorded_at"),
    )


class BusArrivalHistory(Base):
    __tablename__ = "bus_arrival_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("bus_routes.id", ondelete="CASCADE"), nullable=False)
    stop_id: Mapped[int] = mapped_column(ForeignKey("bus_stops.id"), nullable=False)
    plate_no: Mapped[str] = mapped_column(String(20), nullable=False)
    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    day_type: Mapped[str] = mapped_column(String(10), nullable=False)
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="detected")

    route: Mapped["BusRoute"] = relationship()
    stop: Mapped["BusStop"] = relationship()

    __table_args__ = (
        Index("idx_bus_arrival_route_stop_day", "route_id", "stop_id", "day_type", "arrived_at"),
    )
