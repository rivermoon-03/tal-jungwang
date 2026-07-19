"""사용자 제보 채널.

노선 오류·셔틀 만차·시간표 변경 등 경량 제보를 받아 Discord로 즉시 흘려보낸다.
새 webhook 발송 코드를 따로 두지 않고 core/discord_logging.py에 이미 설치된
WARNING 이상 로그 → Discord 웹훅 파이프라인을 재사용한다(app.main이 startup 시
install_discord_logging(settings.DISCORD_ERROR_WEBHOOK_URL)을 호출해 루트 로거에
핸들러를 부착한다). 웹훅 URL이 설정되지 않은 환경에서는 핸들러 자체가 부착되지
않으므로 logger.warning 호출은 표준 로깅으로만 남고 자동으로 "로깅만" 동작이 된다.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.schemas.report import ReportCreate, ReportOut

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

_CATEGORY_LABELS: dict[str, str] = {
    "route_error": "노선 오류",
    "shuttle_full": "셔틀 만차",
    "timetable_change": "시간표 변경",
    "other": "기타",
}


def _format_report(payload: ReportCreate, client_hint: str | None, received_at: datetime) -> str:
    label = _CATEGORY_LABELS.get(payload.category, payload.category)
    contact = payload.contact or "미기재"
    hint = client_hint or "알수없음"
    return (
        f"[사용자 제보] {label}\n"
        f"메시지: {payload.message}\n"
        f"연락처: {contact}\n"
        f"제보자 힌트: {hint}\n"
        f"수신 시각: {received_at:%Y-%m-%d %H:%M:%S} KST"
    )


async def submit_report(payload: ReportCreate, client_hint: str | None = None) -> ReportOut:
    """제보를 접수해 Discord로 전달한다.

    전송 자체가 실패해도(웹훅 미설정 포함) 예외를 던지지 않는다 — 제보 유실보다
    사용자 UX(성공 응답)를 우선한다. 실패 시에는 warning 로그만 남긴다.
    """
    received_at = datetime.now(_KST)
    content = _format_report(payload, client_hint, received_at)

    try:
        logger.warning(content)
    except Exception:
        # 로깅 자체가 실패하는 극단적인 경우에도 사용자 응답은 성공으로 유지한다.
        logger.exception("제보 전송 중 예외 (category=%s)", payload.category)

    delivered = bool(settings.DISCORD_ERROR_WEBHOOK_URL)
    return ReportOut(category=payload.category, delivered=delivered)
