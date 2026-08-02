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

import html as html_module
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

# 게시판 목록은 두 가지 마크업이 섞여 있다:
#   - 표형(학사 1096 · 장학 1097 · 비교과 6622): <tr> 안에 링크·제목·등록일 셀
#   - 리스트형(취업 1098 · 생활관 dorm/2630): <li class="notice"> 안에 <dl class="date">
# 그래서 행 태그에 기대지 않고 "게시글 링크 → 다음 링크 직전"을 한 블록으로 잘라
# 그 안에서 제목(<strong>)과 날짜를 찾는다. 두 마크업 모두 제목·날짜가 링크 뒤에 온다.
_LINK_RE = re.compile(r'href="(/bbs/[a-z]+/\d+/(\d+)/artclView\.do)"')
_STRONG_RE = re.compile(r"<strong[^>]*>(.*?)</strong>", re.S)
_ANCHOR_TEXT_RE = re.compile(r'artclView\.do"[^>]*>(.*?)</a>', re.S)
_DATE_RE = re.compile(r"(\d{4})\.(\d{2})\.(\d{2})")
_TAG_RE = re.compile(r"<[^>]+>")

# 마지막 항목에만 적용하는 블록 길이 상한 — 뒤에 링크가 없어 페이지 꼬리(푸터 등)를
# 통째로 삼키는 것을 막는다. 항목 사이는 "다음 링크 직전"이 정확한 경계이므로
# 상한을 걸지 않는다(리스트형 마크업은 한 항목이 4000자에 달해, 상한을 일괄
# 적용하면 항목 대부분에서 날짜를 놓친다 — 실제로 겪은 회귀).
_LAST_BLOCK_MAX_CHARS = 6000


def _clean_title(raw: str) -> str:
    text = _TAG_RE.sub(" ", raw)
    text = html_module.unescape(text)  # &quot; &apos; &amp; 등 원문 그대로 저장 방지
    text = re.sub(r"\s+", " ", text).strip()
    # 목록이 제목 뒤에 붙이는 '새글' 뱃지 텍스트 제거
    return re.sub(r"\s*새글$", "", text)


def parse_board_list(html: str) -> list[dict]:
    """게시판 목록 HTML → [{"external_id", "title", "url", "published_at"}, ...].

    블록 하나가 깨져도 나머지는 계속 수집한다.
    게시일은 날짜(YYYY.MM.DD)만 제공되므로 KST 자정으로 저장한다.
    """
    items: list[dict] = []
    matches = list(_LINK_RE.finditer(html))
    seen: set[int] = set()

    for i, link in enumerate(matches):
        external_id = int(link.group(2))
        if external_id in seen:  # 같은 글이 썸네일·제목 두 링크로 나오는 목록 대응
            continue

        start = link.end()
        if i + 1 < len(matches):
            end = matches[i + 1].start()
        else:
            end = min(len(html), start + _LAST_BLOCK_MAX_CHARS)
        block = html[start:end]

        title_m = _STRONG_RE.search(block) or _ANCHOR_TEXT_RE.search(html[link.start() : end])
        date_m = _DATE_RE.search(block)
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

        seen.add(external_id)
        items.append(
            {
                "external_id": external_id,
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
