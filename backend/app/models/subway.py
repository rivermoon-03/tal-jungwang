from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import DateTime, Index, Numeric, SmallInteger, String
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


class SubwayArrivalHistory(Base):
    """실측 도착 이력 (A5).

    실시간 폴링에서 "도착"(arvlCd=1) 또는 ETA 소실을 도착으로 판정해 적재한다.
    추후 요일별 다이아 정본화(실측 기반 시간표 보정)의 원료가 되므로,
    day_type 은 공휴일 보정 없이 실제 요일 기반(weekday/saturday/sunday,
    공휴일은 sunday)으로 기록한다. line_id 는 서울 실시간 API subwayId
    (1004:4호선, 1075:수인분당선, 1093:서해선).
    """

    __tablename__ = "subway_arrival_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    station_name: Mapped[str] = mapped_column(String(20), nullable=False)  # 정왕|시흥시청|초지
    line_id: Mapped[str] = mapped_column(String(10), nullable=False)       # 1004|1075|1093
    direction: Mapped[str] = mapped_column(String(10), nullable=False)     # 상행|하행
    train_no: Mapped[str] = mapped_column(String(20), nullable=False)
    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # KST tz-aware
    day_type: Mapped[str] = mapped_column(String(10), nullable=False)      # weekday|saturday|sunday

    __table_args__ = (
        # 다이아 정본화 조회(역·노선·방향·요일별 도착 시각 분포)용 복합 인덱스.
        Index(
            "idx_subway_arrival_stn_line_day",
            "station_name", "line_id", "direction", "day_type", "arrived_at",
        ),
        # 보존기간 정리(arrived_at 단독 조건)용 인덱스 — bus_arrival_history 패턴.
        Index("idx_subway_arrival_arrived_at", "arrived_at"),
    )


class SubwayCrowdingProfile(Base):
    """역 시간대별 혼잡 프로파일 (B4).

    교통카드 빅데이터 통합정보시스템(stcis.go.kr)의 역별 시간대별 승하차 인원을
    (역·노선·방향·요일) 그룹 내 최대값으로 나눠 0~1 로 정규화한 값이다.
    적재는 수동 스크립트(scripts/load_subway_crowding_profile.py)로만 한다 —
    cron 없음, 요청 경로는 읽기 전용. 테이블이 비어 있으면 API 는 빈 배열을 주고
    프런트는 섹션 자체를 그리지 않는다(가짜 시드 금지 정책).
    line_id 는 서울 실시간 API subwayId 와 동일 체계
    (1004:4호선, 1075:수인분당선, 1093:서해선).
    """

    __tablename__ = "subway_crowding_profile"

    station_name: Mapped[str] = mapped_column(String(20), primary_key=True)  # 정왕|시흥시청|초지
    line_id: Mapped[str] = mapped_column(String(10), primary_key=True)       # 1004|1075|1093
    direction: Mapped[str] = mapped_column(String(10), primary_key=True)     # up|down
    day_type: Mapped[str] = mapped_column(String(10), primary_key=True)      # weekday|saturday|sunday
    hour: Mapped[int] = mapped_column(SmallInteger, primary_key=True)        # 0~23
    level: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False)    # 0.00~1.00 정규화 혼잡도
    source: Mapped[str] = mapped_column(String(50), nullable=False)          # 예: "stcis-2026-06"
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
