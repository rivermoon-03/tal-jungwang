from decimal import Decimal

from sqlalchemy import Boolean, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Destination(Base):
    """하교 탭에서 고를 수 있는 목적지.

    kind:
      - "subway_station": 정왕역·사당·강남·석수 등 지하철 도착지
      - "area": 행선지 지역(동 단위)
    상단 정렬·노출 여부는 is_active + sort_order로 제어.
    """
    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)  # "jeongwang", "sadang", ...
    name: Mapped[str] = mapped_column(String(40), nullable=False)  # "정왕역"
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # "subway_station" | "area"
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    sort_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint("code", name="uq_destinations_code"),
    )
