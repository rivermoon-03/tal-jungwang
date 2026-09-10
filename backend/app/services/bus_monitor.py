"""버스 도착 이력 Discord 알림.

정기 현황 보고와, 수집이 멈췄을 때의 경보 두 가지를 보낸다.
"""
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.http_client import get_http_client
from app.models.bus import BusArrivalHistory, BusRoute, BusStop

logger = logging.getLogger(__name__)
_KST = ZoneInfo("Asia/Seoul")
_DISCORD_LIMIT = 1900  # 여유 버퍼 포함 (공식 한도 2000)


async def _post(content: str, *, mention_everyone: bool = False) -> None:
    url = settings.DISCORD_WEBHOOK_URL
    if not url:
        logger.warning("DISCORD_WEBHOOK_URL 미설정 — Discord 알림 스킵")
        return
    client = await get_http_client()
    # allowed_mentions 를 명시하지 않으면 Discord 는 본문의 @everyone 을 무시한다.
    # 경보만 이 문을 연다 — 정기 보고가 사람을 부르면 곧 아무도 안 읽는다.
    payload: dict = {"content": content}
    payload["allowed_mentions"] = (
        {"parse": ["everyone"]} if mention_everyone else {"parse": []}
    )
    try:
        resp = await client.post(url, json=payload, timeout=10.0)
        if resp.status_code >= 400:
            logger.error("Discord webhook 실패 %s: %s", resp.status_code, resp.text[:200])
        else:
            logger.info("Discord webhook 전송 완료 (%d자)", len(content))
    except Exception:
        logger.exception("Discord webhook 전송 중 예외")


def _chunk_and_send_ready(blocks: list[str]) -> list[str]:
    """줄 단위 블록을 Discord 한도에 맞춰 여러 메시지로 분할."""
    messages: list[str] = []
    buf = ""
    for block in blocks:
        piece = block + "\n"
        if len(buf) + len(piece) > _DISCORD_LIMIT:
            if buf:
                messages.append(buf.rstrip())
            buf = piece
        else:
            buf += piece
    if buf.strip():
        messages.append(buf.rstrip())
    return messages


async def send_bus_arrival_report(window_hours: int = 6) -> None:
    """최근 window_hours 시간 동안의 버스 도착 이력을 Discord로 전송."""
    now = datetime.now(_KST)
    start = now - timedelta(hours=window_hours)
    start_utc = start.astimezone(timezone.utc)
    now_utc = now.astimezone(timezone.utc)

    async with AsyncSessionLocal() as db:
        arrived_kst = func.timezone("Asia/Seoul", BusArrivalHistory.arrived_at)
        stmt = (
            select(
                BusRoute.route_number,
                BusStop.name.label("stop_name"),
                func.to_char(arrived_kst, "HH24:MI").label("t"),
            )
            .join(BusRoute, BusRoute.id == BusArrivalHistory.route_id)
            .join(BusStop, BusStop.id == BusArrivalHistory.stop_id)
            .where(BusArrivalHistory.arrived_at >= start_utc)
            .where(BusArrivalHistory.arrived_at < now_utc)
            .order_by(BusRoute.route_number, BusStop.name, "t")
        )
        rows = (await db.execute(stmt)).all()

    grouped: dict[tuple[str, str], list[str]] = {}
    for route_num, stop_name, t in rows:
        grouped.setdefault((route_num, stop_name), []).append(t)

    header = f"📊 **버스 도착 이력** (`{start:%Y-%m-%d %H:%M}` ~ `{now:%H:%M}` KST · 최근 {window_hours}h)"

    if not grouped:
        await _post(f"{header}\n\n_수집된 도착 기록이 없습니다._")
        return

    count_lines = ["", "**📌 도착 횟수**"]
    for (route_num, stop_name), times in grouped.items():
        count_lines.append(f"• `{route_num}` ({stop_name}): **{len(times)}회**")

    time_blocks: list[str] = ["", "**⏱ 수집 시각**"]
    for (route_num, stop_name), times in grouped.items():
        time_blocks.append(f"**{route_num} ({stop_name})**")
        time_blocks.append(" ".join(f"`{t}`" for t in times))

    messages = _chunk_and_send_ready([header] + count_lines + time_blocks)
    for msg in messages:
        await _post(msg)


async def send_test_message() -> None:
    now = datetime.now(_KST)
    content = (
        "✅ **버스 도착 모니터링 알림 테스트**\n"
        f"테스트 시각: `{now:%Y-%m-%d %H:%M} KST`\n"
        "이 채널로 **3시간마다** (00 / 03 / 06 / 09 / 12 / 15 / 18 / 21 KST) 수집 현황 요약이 전송됩니다."
    )
    await _post(content)


# ── 수집 정지 경보 ────────────────────────────────────────────────────────
#
# 2026-08 에 도착 감지가 3주간 멈춘 적이 있다. 같은 폴링 사이클이 쓰는 혼잡
# 로그는 주당 24,000건으로 멀쩡했고 서버도 GBIS 도 정상이라 아무 지표도 이상을
# 말하지 않았다. 재배포로 복구됐지만 그동안 누구도 몰랐다. 원인은 아직 못
# 밝혔으므로, 원인 규명보다 먼저 "멈추면 사람을 부르는" 장치를 둔다.
#
# 기준은 마지막 detected 도착이다. estimated 는 시간표에서 유도한 값이라 수집이
# 죽어도 계속 생긴다 — 그걸 세면 장애를 못 잡는다.
STALL_ALERT_THRESHOLD_HOURS = 48

# 같은 장애로 매일 @everyone 을 울리지 않도록 하루에 한 번만 부른다.
_STALL_ALERT_COOLDOWN_HOURS = 24
_STALL_ALERT_REDIS_KEY = "bus:stall_alert_sent"


async def check_arrival_collection_stalled() -> dict:
    """마지막 도착 감지가 임계 시간을 넘었으면 @everyone 으로 알린다.

    Returns:
        판정 결과. {"stalled": bool, "last_detected_at": str|None,
                   "hours_since": float|None, "alerted": bool}
    """
    now = datetime.now(_KST)

    async with AsyncSessionLocal() as db:
        stmt = select(func.max(BusArrivalHistory.arrived_at)).where(
            BusArrivalHistory.source == "detected"
        )
        last = (await db.execute(stmt)).scalar_one_or_none()

    if last is None:
        hours_since = None
        stalled = True
    else:
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        hours_since = (now - last.astimezone(_KST)).total_seconds() / 3600
        stalled = hours_since >= STALL_ALERT_THRESHOLD_HOURS

    result = {
        "stalled": stalled,
        "last_detected_at": None if last is None else last.astimezone(_KST).isoformat(),
        "hours_since": None if hours_since is None else round(hours_since, 1),
        "alerted": False,
    }
    if not stalled:
        return result

    if await _stall_alert_on_cooldown():
        logger.warning(
            "버스 도착 감지 정지 지속 (마지막 %s) — 쿨다운 중이라 알림 생략",
            result["last_detected_at"],
        )
        return result

    if hours_since is None:
        detail = "도착 감지 기록이 아예 없습니다."
    else:
        days = hours_since / 24
        detail = (
            f"마지막 도착 감지: `{last.astimezone(_KST):%Y-%m-%d %H:%M} KST`\n"
            f"경과: **{days:.1f}일** ({hours_since:.0f}시간)"
        )

    await _post(
        "@everyone\n"
        "🚨 **버스 도착 감지가 멈췄습니다**\n\n"
        f"{detail}\n\n"
        "실시간 도착 수집(`detected`)이 "
        f"{STALL_ALERT_THRESHOLD_HOURS}시간 넘게 한 건도 없습니다. "
        "혼잡도 수집은 같은 폴링 사이클을 쓰므로, 그쪽이 정상이면 서버가 아니라 "
        "도착 판정 경로만 죽은 것입니다(2026-08 과 같은 양상).\n"
        "확인 순서: 백엔드 재배포 → 폴링 로그의 정류장별 주기 → Redis `bus:prev:*` 잔존 여부",
        mention_everyone=True,
    )
    await _mark_stall_alert_sent()
    result["alerted"] = True
    logger.error(
        "버스 도착 감지 정지 경보 전송 (마지막 %s, %s시간 경과)",
        result["last_detected_at"], result["hours_since"],
    )
    return result


async def _stall_alert_on_cooldown() -> bool:
    """최근에 같은 경보를 보냈는지. Redis 가 없으면 쿨다운 없이 보낸다."""
    try:
        from app.core.cache import get_redis

        redis = await get_redis()
        return bool(await redis.exists(_STALL_ALERT_REDIS_KEY))
    except Exception:
        logger.warning("정지 경보 쿨다운 조회 실패 — 쿨다운 없이 진행", exc_info=True)
        return False


async def _mark_stall_alert_sent() -> None:
    try:
        from app.core.cache import get_redis

        redis = await get_redis()
        await redis.set(
            _STALL_ALERT_REDIS_KEY, "1", ex=_STALL_ALERT_COOLDOWN_HOURS * 3600
        )
    except Exception:
        logger.warning("정지 경보 쿨다운 기록 실패", exc_info=True)
