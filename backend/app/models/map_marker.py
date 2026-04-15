from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MapMarker(Base):
    """지도 위 하나의 핀. 노선 정보는 MapMarkerRoute로 분리."""
    __tablename__ = "map_markers"

    id: Mapped[int] = mapped_column(primary_key=True)
    marker_key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    marker_type: Mapped[str] = mapped_column(String(20), nullable=False)
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)
    lat: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    lng: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ui_meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    routes: Mapped[list["MapMarkerRoute"]] = relationship(
        back_populates="marker",
        cascade="all, delete-orphan",
        order_by="MapMarkerRoute.sort_order",
    )


class MapMarkerRoute(Base):
    """bus_seoul 타입 마커에 걸리는 노선 entry. 허브에 여러 개 가능."""
    __tablename__ = "map_marker_routes"

    id: Mapped[int] = mapped_column(primary_key=True)
    marker_id: Mapped[int] = mapped_column(
        ForeignKey("map_markers.id", ondelete="CASCADE"), nullable=False
    )
    route_number: Mapped[str] = mapped_column(String(20), nullable=False)
    route_color: Mapped[str | None] = mapped_column(String(10))
    badge_text: Mapped[str | None] = mapped_column(String(10))
    outbound_stop_id: Mapped[int | None] = mapped_column(ForeignKey("bus_stops.id"))
    inbound_stop_id: Mapped[int | None] = mapped_column(ForeignKey("bus_stops.id"))
    ui_meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    marker: Mapped["MapMarker"] = relationship(back_populates="routes")
