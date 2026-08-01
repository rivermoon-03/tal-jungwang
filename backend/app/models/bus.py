from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, Numeric, SmallInteger, String, UniqueConstraint
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
    commute_contexts: Mapped[list["BusCommuteContext"]] = relationship(
        back_populates="route", cascade="all, delete-orphan"
    )
    realtime_targets: Mapped[list["BusRealtimeTarget"]] = relationship(
        back_populates="route", cascade="all, delete-orphan"
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


class BusCommuteContext(Base):
    """사용자가 선택하는 통학 목적. 정보 source의 기준점과는 독립적이다."""

    __tablename__ = "bus_commute_contexts"

    id: Mapped[int] = mapped_column(primary_key=True)
    bus_route_id: Mapped[int] = mapped_column(
        ForeignKey("bus_routes.id", ondelete="CASCADE"), nullable=False
    )
    group_key: Mapped[str] = mapped_column(String(40), nullable=False)
    origin_label: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_label: Mapped[str] = mapped_column(String(100), nullable=False)
    journey_labels: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    route: Mapped["BusRoute"] = relationship(back_populates="commute_contexts")
    sources: Mapped[list["BusInformationSource"]] = relationship(
        back_populates="context",
        cascade="all, delete-orphan",
        order_by="BusInformationSource.sort_order",
    )

    __table_args__ = (
        UniqueConstraint("bus_route_id", "group_key", name="uq_bus_commute_route_group"),
    )


class BusInformationSource(Base):
    """시간표 또는 실시간 정보가 의미하는 구체 정류장과 역할."""

    __tablename__ = "bus_information_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    context_id: Mapped[int] = mapped_column(
        ForeignKey("bus_commute_contexts.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_role: Mapped[str] = mapped_column(String(30), nullable=False)
    bus_stop_id: Mapped[int] = mapped_column(ForeignKey("bus_stops.id"), nullable=False)
    display_label: Mapped[str] = mapped_column(String(100), nullable=False)
    travel_direction: Mapped[str] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    context: Mapped["BusCommuteContext"] = relationship(back_populates="sources")
    stop: Mapped["BusStop"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "context_id", "source_type", "source_role", "bus_stop_id",
            name="uq_bus_info_source_context_type_role_stop",
        ),
    )


class BusRealtimeTarget(Base):
    """GBIS 수집기가 폴링할 노선·정류장·진행방향의 명시적 binding."""

    __tablename__ = "bus_realtime_targets"

    id: Mapped[int] = mapped_column(primary_key=True)
    bus_route_id: Mapped[int] = mapped_column(
        ForeignKey("bus_routes.id", ondelete="CASCADE"), nullable=False
    )
    bus_stop_id: Mapped[int] = mapped_column(
        ForeignKey("bus_stops.id", ondelete="CASCADE"), nullable=False
    )
    travel_direction: Mapped[str] = mapped_column(String(30), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    route: Mapped["BusRoute"] = relationship(back_populates="realtime_targets")
    stop: Mapped["BusStop"] = relationship()

    __table_args__ = (
        UniqueConstraint(
            "bus_route_id", "bus_stop_id", "travel_direction",
            name="uq_bus_realtime_route_stop_direction",
        ),
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
        # retention.py 나이틀리 삭제(recorded_at 단독 조건)용 인덱스.
        Index("idx_crowding_recorded_at", "recorded_at"),
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
        # retention.py 나이틀리 삭제(arrived_at 단독 조건)용 인덱스.
        Index("idx_bus_arrival_arrived_at", "arrived_at"),
    )


class BusArrivalStats(Base):
    __tablename__ = "bus_arrival_stats"

    route_id: Mapped[int] = mapped_column(
        ForeignKey("bus_routes.id", ondelete="CASCADE"), primary_key=True
    )
    stop_id: Mapped[int] = mapped_column(
        ForeignKey("bus_stops.id", ondelete="CASCADE"), primary_key=True
    )
    day_type: Mapped[str] = mapped_column(String(10), primary_key=True)
    hour_of_day: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    p10_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    p50_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    p90_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    mean_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class BusCrowdingStats(Base):
    """`bus_crowding_logs` 사전 집계 (30분 버킷 평균 혼잡도).

    day_type은 bus_arrival_stats 등 다른 사전집계 테이블의 3분류
    (weekday/saturday/sunday)와 달리 crowding_flow.py 도메인을 그대로 따라
    'weekday'/'weekend' 2분류다 (compute_crowding_flow의 isodow<=5 기준).
    bucket = hour*2 + half (half: 0=00분대, 1=30분대), 0~47 범위.
    """

    __tablename__ = "bus_crowding_stats"

    route_id: Mapped[int] = mapped_column(
        ForeignKey("bus_routes.id", ondelete="CASCADE"), primary_key=True
    )
    stop_id: Mapped[int] = mapped_column(
        ForeignKey("bus_stops.id", ondelete="CASCADE"), primary_key=True
    )
    day_type: Mapped[str] = mapped_column(String(10), primary_key=True)  # weekday|weekend
    bucket: Mapped[int] = mapped_column(SmallInteger, primary_key=True)  # 0~47
    avg_crowded: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_days: Mapped[int] = mapped_column(Integer, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
