"""도서관(library.tukorea.ac.kr) 열람실 개관시간 어댑터 — F7 시험기간 카드용.

도서관 홈은 SPA라 HTML 크롤이 불가능하지만, 페이지 자신이 호출하는 공개
JSON API(pyxis-api, 인증 불필요)가 있다. 메인의 '열람실 이용시간' 위젯은
배너 카테고리 3번으로 내려온다:
    GET /pyxis-api/1/banner-categories/3
    → data.list[] = {name: "자료열람실(3층)", description: "[방학] 평일 09:30 ~ 17:30", ...}

좌석 '현황'(er-sso)은 SSO 로그인 뒤라 다루지 않는다 — 개관시간만.
"""

import logging
import re

from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

_HOURS_URL = "https://library.tukorea.ac.kr/pyxis-api/1/banner-categories/3"

_TAG_RE = re.compile(r"<[^>]+>")
# description 예: "[방학] 평일 09:30 ~ 17:30" / "[방학] 미개방"
_PERIOD_RE = re.compile(r"^\[(?P<period>[^\]]+)\]\s*(?P<hours>.*)$")


def parse_library_hours(payload: dict) -> list[dict]:
    """배너 응답 → [{"room", "period", "hours", "closed"}...]."""
    rooms: list[dict] = []
    for item in payload.get("data", {}).get("list", []):
        name = _TAG_RE.sub(" ", item.get("name") or "").strip()
        desc = _TAG_RE.sub(" ", item.get("description") or "").strip()
        if not name or not desc:
            continue
        m = _PERIOD_RE.match(desc)
        period = m.group("period").strip() if m else None
        hours = (m.group("hours").strip() if m else desc) or None
        rooms.append(
            {
                "room": re.sub(r"\s+", " ", name),
                "period": period,          # 방학 | 학기 등 원문 라벨
                "hours": hours,            # "평일 09:30 ~ 17:30" | "미개방"
                "closed": hours == "미개방",
            }
        )
    return rooms


async def fetch_library_hours() -> list[dict]:
    """열람실 개관시간 조회. 실패는 예외 전파 — 호출부가 캐시 유지로 처리."""
    client = await get_http_client()
    resp = await client.get(_HOURS_URL)
    resp.raise_for_status()
    return parse_library_hours(resp.json())
