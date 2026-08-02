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
    "bus_full": "버스 만차",
    "bus_no_show": "버스 결행",
}

# ── F6 실시간 신호 제보 (Redis 30분 창) ─────────────────────────────────
# 키: report:bus:{station_key}:{route_no}:{kind} → {"count": n, "last_ts": iso}
# TTL 30분 — 제보는 순간의 상황이라 오래 살수록 오정보가 된다.
_SIGNAL_TTL = 1800
_SIGNAL_KINDS = {"bus_full", "bus_no_show"}


def _signal_key(station_key: str, route_no: str, kind: str) -> str:
    return f"report:bus:{station_key}:{route_no}:{kind}"


async def _record_bus_signal(payload: ReportCreate, received_at: datetime) -> None:
    from app.core.cache import get_cached_json, set_cached_json

    key = _signal_key(payload.station_key, payload.route_no, payload.category)
    current = await get_cached_json(key) or {"count": 0}
    await set_cached_json(
        key,
        {"count": int(current.get("count", 0)) + 1, "last_ts": received_at.isoformat()},
        ttl=_SIGNAL_TTL,
    )


async def get_active_bus_reports(station_key: str) -> list[dict]:
    """정류장의 활성(30분 내) 만차·결행 신호 목록 — 도착 카드 경고 뱃지용."""
    from app.core.cache import get_redis

    now = datetime.now(_KST)
    items: list[dict] = []
    try:
        redis = await get_redis()
        pattern = f"report:bus:{station_key}:*"
        async for key in redis.scan_iter(match=pattern, count=100):
            raw = await redis.get(key)
            if not raw:
                continue
            try:
                import json

                data = json.loads(raw)
                parts = key.split(":")  # report:bus:{station}:{route}:{kind}
                route_no, kind = parts[3], parts[4]
                last = datetime.fromisoformat(data["last_ts"])
                minutes_ago = max(0, int((now - last).total_seconds() // 60))
                items.append(
                    {"route_no": route_no, "kind": kind, "count": int(data["count"]), "minutes_ago": minutes_ago}
                )
            except (KeyError, ValueError, IndexError):
                continue
    except Exception:
        logger.exception("활성 제보 조회 실패 (station=%s)", station_key)
    items.sort(key=lambda x: x["minutes_ago"])
    return items


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

    # F6 — 만차·결행 신호는 Discord 릴레이에 더해 Redis 카운터로 30분간 공유
    if payload.category in _SIGNAL_KINDS and payload.route_no and payload.station_key:
        try:
            await _record_bus_signal(payload, received_at)
        except Exception:
            logger.exception("버스 신호 기록 실패 (route=%s)", payload.route_no)

    try:
        logger.warning(content)
    except Exception:
        # 로깅 자체가 실패하는 극단적인 경우에도 사용자 응답은 성공으로 유지한다.
        logger.exception("제보 전송 중 예외 (category=%s)", payload.category)

    delivered = bool(settings.DISCORD_ERROR_WEBHOOK_URL)
    return ReportOut(category=payload.category, delivered=delivered)
