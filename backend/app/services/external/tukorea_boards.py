"""한국공학대학교 전교 게시판(목록 페이지) 스크레이퍼 — 공지 카테고리 확장(DS1).

robots.txt(https://www.tukorea.ac.kr/robots.txt) 재검토(2026-08-02):
    Allow: /bbs/ce/201/* , /bbs/ce/203/* , /ce/*
    Disallow: /bbs/
    Disallow: /SemiBootcamp

여기서 수집하는 것은 `/tukorea/<메뉴id>/subview.do` · `/dorm/<메뉴id>/subview.do`
**목록 페이지**다 — /bbs/ 하위가 아니므로 robots.txt 허용 경로다.
게시글 본문(/bbs/**/artclView.do)은 Disallow 대상이라 **절대 요청하지 않는다** —
목록의 제목·게시일·원문 링크만 저장하고, 본문은 링크로 원 사이트에 보낸다
(저작권 리스크 최소화 + 트래픽 원 사이트 유도 — 학과 RSS 수집과 같은 원칙).

목록 1페이지(최신 10건)만 읽는다: 60분 폴링 대비 충분한 버퍼고,
페이지네이션 순회는 원 서버에 불필요한 부하다.
"""

import logging
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")
SITE_ORIGIN = "https://www.tukorea.ac.kr"

# category 코드 → 목록 페이지. 코드가 프런트 칩과 1:1로 노출되므로 바꾸면 안 된다.
BOARD_SOURCES: dict[str, dict] = {
    "academic":    {"label": "학사",   "url": f"{SITE_ORIGIN}/tukorea/1096/subview.do"},
    "scholarship": {"label": "장학",   "url": f"{SITE_ORIGIN}/tukorea/1097/subview.do"},
    "job":         {"label": "취업",   "url": f"{SITE_ORIGIN}/tukorea/1098/subview.do"},
    "extra":       {"label": "비교과", "url": f"{SITE_ORIGIN}/tukorea/6622/subview.do"},
    "dorm":        {"label": "생활관", "url": f"{SITE_ORIGIN}/dorm/2630/subview.do"},
}

_USER_AGENT = (
    "TalJungwangBot/1.0 (+https://taljungwang.app; "
    "contact:moonlandingplan.03@gmail.com; purpose:academic-notice-aggregator)"
)

_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S)
_LINK_RE = re.compile(r'href="(/bbs/[a-z]+/\d+/(\d+)/artclView\.do)"')
_TITLE_RE = re.compile(r'artclView\.do"[^>]*>(.*?)</a>', re.S)
_DATE_RE = re.compile(r"(\d{4})\.(\d{2})\.(\d{2})")
_TAG_RE = re.compile(r"<[^>]+>")


def _clean_title(raw: str) -> str:
    text = _TAG_RE.sub(" ", raw)
    text = re.sub(r"\s+", " ", text).strip()
    # 목록이 제목 뒤에 붙이는 '새글' 뱃지 텍스트 제거
    return re.sub(r"\s*새글$", "", text)


def parse_board_list(html: str) -> list[dict]:
    """게시판 목록 HTML → [{"external_id", "title", "url", "published_at"}, ...].

    행 단위로 파싱하고, 한 행이 깨져도 나머지는 계속 수집한다.
    게시일은 날짜(YYYY.MM.DD)만 제공되므로 KST 자정으로 저장한다.
    """
    items: list[dict] = []
    for row in _ROW_RE.findall(html):
        link = _LINK_RE.search(row)
        if not link:
            continue  # 헤더 행 등
        title_m = _TITLE_RE.search(row)
        date_m = _DATE_RE.search(row)
        if not title_m or not date_m:
            continue
        title = _clean_title(title_m.group(1))
        if not title:
            continue
        y, m, d = (int(g) for g in date_m.groups())
        try:
            published_at = datetime(y, m, d, tzinfo=KST)
        except ValueError:
            logger.warning("게시판 목록: 잘못된 날짜 %s.%s.%s", y, m, d)
            continue
        items.append(
            {
                "external_id": int(link.group(2)),
                "title": title,
                "url": f"{SITE_ORIGIN}{link.group(1)}",
                "published_at": published_at,
            }
        )
    return items


async def fetch_board_notices(category: str) -> list[dict]:
    """카테고리 게시판 목록 1페이지를 조회한다. 실패는 예외 전파 —
    호출부(app.services.school)가 이전 DB 데이터 유지로 처리한다."""
    source = BOARD_SOURCES.get(category)
    if source is None:
        raise ValueError(f"지원하지 않는 공지 카테고리: {category}")

    client = await get_http_client()
    resp = await client.get(source["url"], headers={"User-Agent": _USER_AGENT})
    resp.raise_for_status()
    return parse_board_list(resp.text)
