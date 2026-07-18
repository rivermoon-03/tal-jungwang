from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PushSubscription(Base):
    """Web Push 구독. 사용자 계정이 없으므로 브라우저가 발급하는 endpoint를 기본 키로 쓴다.

    favorite_codes: 프론트 zustand `favorites.routes`와 동일한 favCode 문자열 배열
    (예: "등교:5602", "shuttle:등교", "subway:정왕:up").
    last_notified: 오늘 하루 중복 발송 방지용. `{"<favCode>:last": "2026-07-18",
    "<favCode>:first": "2026-07-18"}` 형태로 (favCode, edge) 조합별 마지막 발송 날짜(KST)를 기록.
    """

    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    p256dh_key: Mapped[str] = mapped_column(Text, nullable=False)
    auth_key: Mapped[str] = mapped_column(Text, nullable=False)
    favorite_codes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    last_notified: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
