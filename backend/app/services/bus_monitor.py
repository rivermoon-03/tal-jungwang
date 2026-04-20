"""버스 도착 이력 Discord 알림 — 6시간마다 수집 현황을 웹훅으로 전송."""
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


async def _post(content: str) -> None:
    url = settings.DISCORD_WEBHOOK_URL
    if not url:
        logger.warning("DISCORD_WEBHOOK_URL 미설정 — Discord 알림 스킵")
        return
    client = await get_http_client()
    try:
        resp = await client.post(url, json={"content": content}, timeout=10.0)
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
