"""막차/첫차 30분 전 Web Push 알림.

즐겨찾기(`favorites.routes`, favCode 문자열 배열)는 프론트 zustand persist에만
있으므로, 서버는 각 구독(`push_subscriptions.favorite_codes`)에 저장된 favCode를
파싱해 기존 시간표 서비스(app.services.bus/shuttle/subway)를 재사용해 오늘의
막차/첫차 시각을 계산한다. 새 SQL을 짜지 않고 이미 캐시-aside로 감싸진 서비스
함수를 그대로 호출한다.

효율성: 구독 수만큼 시간표를 반복 조회하지 않도록, 전체 구독의 favorite_codes를
모아 고유 favCode 집합을 만들고 그 집합에 대해서만 오늘의 막차/첫차를 한 번씩
계산한다(`build_targets`). 계산 결과를 각 구독에 매칭해 알림 대상을 추린다.
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push import PushSubscription
from app.services import bus as bus_service
from app.services import shuttle as shuttle_service
from app.services import subway as subway_service

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

# 막차/첫차 출발 30분 전에 알림. 값 변경 시 문구("30분 후")도 함께 갱신할 것
# (단일 상수에서 파생시키지 않고 문구에 하드코딩되어 있으므로 주의).
NOTIFY_LEAD_SECONDS = 30 * 60

# 지하철 서비스(app.services.subway.get_timetable)가 반환하는 방향 키.
_SUBWAY_KEYS = frozenset({
    "up", "down", "line4_up", "line4_down",
    "choji_up", "choji_dn", "siheung_up", "siheung_dn",
})

# 셔틀 favCode의 (campus, label) → direction 매핑.
# frontend/src/components/summary/ShuttlePanel.jsx의 SHUTTLE_CAMPUS_DIRECTIONS와
# 동일한 규칙: campusTag는 dir>=2일 때만 "2캠 " 접두어.
_SHUTTLE_DIRECTIONS = {
    ("main", "등교"): 0,
    ("main", "하교"): 1,
    ("second", "등교"): 2,
    ("second", "하교"): 3,
}
_SHUTTLE_LABEL = {
    0: "본캠 셔틀버스 등교",
    1: "본캠 셔틀버스 하교",
    2: "2캠 셔틀버스 등교",
    3: "2캠 셔틀버스 하교",
}
_SUBWAY_KEY_LABEL = {
    "up": "상행",
    "down": "하행",
    "line4_up": "4호선 상행",
    "line4_down": "4호선 하행",
    "choji_up": "초지 상행",
    "choji_dn": "초지 하행",
    "siheung_up": "시흥시청 상행",
    "siheung_dn": "시흥시청 하행",
}
_EDGE_EMOJI = {"bus": "🚌", "shuttle": "🚌", "subway": "🚇"}
_EDGE_WORD = {"last": "막차", "first": "첫차"}


# ── favCode 파싱 (순수 함수) ─────────────────────────────────────────────


@dataclass(frozen=True)
class ParsedFavCode:
    kind: str  # "bus" | "shuttle" | "subway"
    route_number: str | None = None  # bus
    category: str | None = None  # bus ("등교"/"하교", 없을 수 있음)
    direction: int | None = None  # shuttle (0~3)
    station_group: str | None = None  # subway (표시용, 예: "정왕")
    subway_key: str | None = None  # subway (up/down/... )


def parse_fav_code(fav_code: str) -> ParsedFavCode | None:
    """favCode 문자열을 도메인별 조회 파라미터로 분해한다. 형식 불명이면 None.

    포맷 기준(frontend/src/components/schedule/SchedulePage.jsx,
    frontend/src/components/map/MapView.jsx, frontend/src/components/summary/ShuttlePanel.jsx):
    - 버스: "{category}:{route_number}" (예: "등교:5602") 또는 category 없이 route_number 단독.
    - 셔틀: "shuttle:{campusTag}{label}" — campusTag는 "2캠 "(제2캠) 또는 빈 문자열(본캠),
      label은 "등교"/"하교".
    - 지하철: "subway:{stationGroup}:{key}" — key는 up/down/line4_up/line4_down/
      choji_up/choji_dn/siheung_up/siheung_dn 중 하나.
    """
    if not fav_code:
        return None

    if fav_code.startswith("shuttle:"):
        rest = fav_code[len("shuttle:"):]
        if rest.startswith("2캠 "):
            campus, label = "second", rest[len("2캠 "):]
        else:
            campus, label = "main", rest
        direction = _SHUTTLE_DIRECTIONS.get((campus, label))
        if direction is None:
            return None
        return ParsedFavCode(kind="shuttle", direction=direction)

    if fav_code.startswith("subway:"):
        parts = fav_code.split(":")
        if len(parts) != 3:
            return None
        _, station_group, key = parts
        if key not in _SUBWAY_KEYS or not station_group:
            return None
        return ParsedFavCode(kind="subway", station_group=station_group, subway_key=key)

    if ":" in fav_code:
        category, route_number = fav_code.split(":", 1)
        if not route_number:
            return None
        return ParsedFavCode(kind="bus", route_number=route_number, category=category or None)

    return ParsedFavCode(kind="bus", route_number=fav_code, category=None)


# ── 시각 헬퍼 (순수 함수) ────────────────────────────────────────────────


def _hhmm_to_time(s: str) -> time:
    """"HH:MM" 또는 "HH:MM:SS" 문자열을 time으로 변환 (초는 버림)."""
    hh, mm = s.split(":")[:2]
    return time(int(hh), int(mm))


def seconds_until(d: date, now_time: time, target: time) -> int:
    """오늘 날짜 기준 now_time → target까지 남은 초(tz-aware).

    막차/첫차는 같은 날짜(day_type이 이미 반영된 오늘 시간표) 안에서 비교하면
    충분하므로 자정 wraparound 보정은 하지 않는다 — 다만 문자열 비교가 아니라
    항상 tz-aware datetime 차이로 계산한다(mistakes.md §1).
    """
    now_dt = datetime.combine(d, now_time, tzinfo=_KST)
    target_dt = datetime.combine(d, target, tzinfo=_KST)
    return int((target_dt - now_dt).total_seconds())


def is_within_notify_window(seconds_remaining: int) -> bool:
    """0 < 남은 시간 <= NOTIFY_LEAD_SECONDS 이면 알림 대상."""
    return 0 < seconds_remaining <= NOTIFY_LEAD_SECONDS


# ── 오늘의 막차/첫차 계산 (기존 서비스 함수 재사용) ───────────────────────


async def _resolve_bus_edges(db: AsyncSession, parsed: ParsedFavCode, d: date) -> dict | None:
    data = await bus_service.get_timetable_by_route_number(
        db, parsed.route_number, d, category=parsed.category
    )
    if not data or not data.get("times"):
        return None
    times = data["times"]
    return {
        "first": _hhmm_to_time(times[0]),
        "last": _hhmm_to_time(times[-1]),
        "label": f"{parsed.route_number}번",
        "kind": "bus",
    }


async def _resolve_shuttle_edges(db: AsyncSession, parsed: ParsedFavCode, d: date) -> dict | None:
    data = await shuttle_service.get_schedule(db, d, direction=parsed.direction)
    if not data:
        return None
    match = next(
        (g for g in data.get("directions", []) if g["direction"] == parsed.direction), None
    )
    if not match or not match.get("times"):
        return None
    times = match["times"]
    return {
        "first": _hhmm_to_time(times[0]["depart_at"]),
        "last": _hhmm_to_time(times[-1]["depart_at"]),
        "label": _SHUTTLE_LABEL.get(parsed.direction, "셔틀버스"),
        "kind": "shuttle",
    }


async def _resolve_subway_edges(db: AsyncSession, parsed: ParsedFavCode, d: date) -> dict | None:
    data = await subway_service.get_timetable(db, d, direction=parsed.subway_key)
    items = data.get(parsed.subway_key) or []
    if not items:
        return None
    dest = items[-1].get("destination") or ""
    suffix = f"{dest}행" if dest else _SUBWAY_KEY_LABEL.get(parsed.subway_key, "")
    return {
        "first": _hhmm_to_time(items[0]["depart_at"]),
        "last": _hhmm_to_time(items[-1]["depart_at"]),
        "label": f"{parsed.station_group}역 {suffix}".strip(),
        "kind": "subway",
    }


async def resolve_edge_times(db: AsyncSession, fav_code: str, d: date) -> dict | None:
    """favCode 하나에 대해 오늘의 {first, last, label, kind}를 계산. 실패 시 None."""
    parsed = parse_fav_code(fav_code)
    if parsed is None:
        logger.warning("알 수 없는 favCode 형식, 건너뜀: %s", fav_code)
        return None

    try:
        if parsed.kind == "bus":
            return await _resolve_bus_edges(db, parsed, d)
        if parsed.kind == "shuttle":
            return await _resolve_shuttle_edges(db, parsed, d)
        if parsed.kind == "subway":
            return await _resolve_subway_edges(db, parsed, d)
    except Exception:
        logger.exception("favCode 시간표 조회 실패: %s", fav_code)
        return None
    return None


async def build_targets(db: AsyncSession, fav_codes: set[str], d: date) -> dict[str, dict]:
    """고유 favCode 집합에 대해 오늘의 막차/첫차를 한 번씩만 계산해 매핑을 만든다."""
    targets: dict[str, dict] = {}
    for fav_code in fav_codes:
        resolved = await resolve_edge_times(db, fav_code, d)
        if resolved is not None:
            targets[fav_code] = resolved
    return targets


# ── 알림 payload ─────────────────────────────────────────────────────────


def build_notification_payload(kind: str, label: str, edge: str, depart_hhmm: str) -> dict:
    """{title, body, url} 형태의 payload. url은 SW가 클릭 시 열 경로."""
    emoji = _EDGE_EMOJI.get(kind, "🚌")
    edge_word = _EDGE_WORD.get(edge, edge)
    return {
        "title": "탈것:정왕",
        "body": f"{emoji} {label} {edge_word}가 30분 후 출발해요 ({depart_hhmm})",
        "url": "/schedule",
    }


# ── 실제 발송 ────────────────────────────────────────────────────────────


def send_web_push(subscription: PushSubscription, payload: dict) -> None:
    """pywebpush(동기/블로킹)로 단일 구독에 전송. 실패 시 WebPushException 전파.

    호출부는 asyncio.to_thread로 감싸 이벤트 루프를 막지 않아야 한다.
    """
    webpush(
        subscription_info={
            "endpoint": subscription.endpoint,
            "keys": {"p256dh": subscription.p256dh_key, "auth": subscription.auth_key},
        },
        data=json.dumps(payload, ensure_ascii=False),
        vapid_private_key=settings.VAPID_PRIVATE_KEY,
        vapid_claims={"sub": settings.VAPID_SUBJECT},
        ttl=300,
    )


# ── 5분 주기 크론에서 호출되는 진입점 ──────────────────────────────────────


async def run_push_notification_cycle(db: AsyncSession) -> dict:
    """모든 구독을 순회하며 막차/첫차 30분 전 알림을 보낸다.

    반환값은 관측용 요약(dict) — 스케줄러 로그에 남긴다.
    """
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("VAPID 키 미설정 — 푸시 발송 스킵")
        return {"subscriptions": 0, "targets": 0, "sent": 0, "removed": 0}

    now = datetime.now(_KST)
    d = now.date()
    today_str = d.isoformat()

    result = await db.execute(select(PushSubscription))
    subs = [s for s in result.scalars().all() if s.favorite_codes]
    if not subs:
        return {"subscriptions": 0, "targets": 0, "sent": 0, "removed": 0}

    unique_codes: set[str] = {code for sub in subs for code in (sub.favorite_codes or [])}
    targets = await build_targets(db, unique_codes, d)

    sent = 0
    removed = 0

    for sub in subs:
        last_notified: dict[str, str] = dict(sub.last_notified or {})
        pending: list[dict] = []
        changed = False

        for fav_code in sub.favorite_codes or []:
            target = targets.get(fav_code)
            if not target:
                continue
            for edge in ("last", "first"):
                edge_time = target.get(edge)
                if edge_time is None:
                    continue
                notif_key = f"{fav_code}:{edge}"
                if last_notified.get(notif_key) == today_str:
                    continue
                remaining = seconds_until(d, now.time(), edge_time)
                if not is_within_notify_window(remaining):
                    continue

                payload = build_notification_payload(
                    target["kind"], target["label"], edge, edge_time.strftime("%H:%M")
                )
                pending.append(payload)
                last_notified[notif_key] = today_str
                changed = True

        row_removed = False
        for payload in pending:
            try:
                await asyncio.to_thread(send_web_push, sub, payload)
                sent += 1
            except WebPushException as exc:
                status_code = getattr(exc.response, "status_code", None)
                if status_code in (404, 410):
                    # 표준 web push 위생: 만료/폐기된 구독은 즉시 삭제.
                    await db.execute(
                        delete(PushSubscription).where(PushSubscription.id == sub.id)
                    )
                    await db.commit()
                    removed += 1
                    row_removed = True
                    changed = False
                    break
                logger.warning(
                    "푸시 전송 실패 (id=%s, status=%s): %s", sub.id, status_code, exc
                )
            except Exception:
                logger.exception("푸시 전송 중 예외 (id=%s)", sub.id)

        if row_removed:
            continue

        if changed:
            sub.last_notified = last_notified
            db.add(sub)

    await db.commit()
    return {
        "subscriptions": len(subs),
        "targets": len(targets),
        "sent": sent,
        "removed": removed,
    }
