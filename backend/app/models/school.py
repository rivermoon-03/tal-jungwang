from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DepartmentNotice(Base):
    """학과별 공지사항. 본문은 저장하지 않는다(제목+게시일+원문링크만) —
    저작권 리스크 최소화 + 원 사이트로 트래픽 유도.

    (department, external_id) UNIQUE로 RSS 재수집 시 중복 삽입을 막는다.
    external_id는 원문 게시글 번호(RSS link의 숫자, 예: 151703).
    """

    __tablename__ = "department_notices"
    __table_args__ = (
        UniqueConstraint(
            "department", "external_id", name="uq_department_notices_department_external_id"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    department: Mapped[str] = mapped_column(String(20), nullable=False)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AcademicCalendarEvent(Base):
    """학사일정. 학교 사이트가 매 스크레이핑마다 현재 시점 기준 전체 목록을
    권위 있는 스냅샷으로 제공하므로, (title, start_date, end_date) UNIQUE +
    ON CONFLICT DO NOTHING으로 append-only 누적한다(삭제 로직 없음 — 스크레이핑
    실패/일부 누락이 기존 데이터를 지우지 않도록 그래스풀 디그레이데이션 유지).
    """

    __tablename__ = "academic_calendar"
    __table_args__ = (
        UniqueConstraint(
            "title", "start_date", "end_date", name="uq_academic_calendar_title_start_end"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
