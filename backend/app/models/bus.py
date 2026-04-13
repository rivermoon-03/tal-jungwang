from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BusStop(Base):
    __tablename__ = "bus_stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
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
    is_realtime: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gbis_route_id: Mapped[str | None] = mapped_column(String(20), unique=True)

    timetable_entries: Mapped[list["BusTimetableEntry"]] = relationship(back_populates="route")
    stops: Mapped[list["BusStop"]] = relationship(
        secondary="bus_stop_routes", back_populates="routes"
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
