"""교내 매장 운영 여부 판정 — 학식 위젯 '운영정보' 탭.

데이터 원본은 프런트(`frontend/src/data/cafeteriaVenues.js`)이고, 여기서 읽는
JSON은 `scripts/export_cafeteria_venues.mjs`가 만든 파생물이다. 손으로 복제하지
않는 이유는 두 벌이 반드시 갈라지기 때문 — 원본을 고치면 스크립트를 다시 돌린다.

학기/방학 구분은 셔틀 운행 기간(schedule_periods)이 아니라 매장 스케줄의
semester/vacation 키를 그대로 쓴다. 학사력상 방학이라도 매장 운영은 별도라
학교 공지 기준으로 프런트 데이터가 갱신된다.
"""

import json
import logging
from datetime import datetime
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "cafeteria_venues.json"

# 0=월 … 6=일 (datetime.weekday())
_DAY_KEYS = ["weekday", "weekday", "weekday", "weekday", "weekday", "saturday", "sunday"]
_CLOSED_DAY_NAMES = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
]


@lru_cache(maxsize=1)
def _load() -> list[dict]:
    try:
        return json.loads(_DATA_PATH.read_text(encoding="utf-8"))["venues"]
    except Exception:
        logger.exception("매장 데이터 로드 실패 (%s)", _DATA_PATH)
        return []


def _to_minutes(hhmm: str) -> int | None:
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


def open_venues_now(now: datetime, season: str = "vacation", limit: int = 3) -> list[dict]:
    """지금 문 연 매장을 마감 임박 순으로 반환한다.

    24시간 매장은 마감이 없으므로 항상 목록 끝에 둔다(급하지 않은 정보).
    반환: [{"name", "close_text", "is24h"}]
    """
    day_key = _DAY_KEYS[now.weekday()]
    closed_name = _CLOSED_DAY_NAMES[now.weekday()]
    now_min = now.hour * 60 + now.minute

    timed: list[tuple[int, dict]] = []
    always: list[dict] = []

    for v in _load():
        if closed_name in (v.get("closedDays") or []):
            continue
        if v.get("is24h"):
            always.append({"name": v["name"], "close_text": "24시간", "is24h": True})
            continue

        slots = ((v.get("schedule") or {}).get(season) or {}).get(day_key) or []
        for slot in slots:
            start, end = _to_minutes(slot.get("start")), _to_minutes(slot.get("end"))
            if start is None or end is None or not (start <= now_min < end):
                continue
            timed.append((end, {"name": v["name"], "close_text": f"{slot['end']} 마감", "is24h": False}))
            break

    timed.sort(key=lambda x: x[0])  # 마감이 가까운 순 — "지금 갈 수 있나"의 답
    return [v for _, v in timed][:limit] + always[: max(0, limit - len(timed))]
