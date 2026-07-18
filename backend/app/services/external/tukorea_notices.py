"""한국공학대학교 학과 공지 RSS 스크레이퍼.

robots.txt(https://www.tukorea.ac.kr/robots.txt) 검토 결과:
    Allow: /bbs/ce/201/*
    Allow: /bbs/ce/203/*
    Allow: /ce/*
    Disallow: /bbs/
    Disallow: /SemiBootcamp

컴퓨터공학부(ce) RSS만 사용한다 — `/bbs/ce/201/*`는 robots.txt가 명시적으로
Allow 했고, 학교가 RSS 배포용으로 켜놓은 공식 기능이다.
`/bbs/tukorea/107`(전교 학사공지 원본)을 비롯한 다른 `/bbs/` 하위 경로는
robots.txt Disallow 대상이므로 절대 스크래핑하지 않는다. 학과를 추가할 때는
반드시 robots.txt에서 해당 게시판이 Allow 되어 있는지 먼저 확인할 것.

본문(<description>)은 저장하지 않는다 — 제목·게시일·원문 링크만 수집해
저작권 리스크를 최소화하고 트래픽을 원 사이트로 유도한다.

외부 요청에는 서비스 식별용 User-Agent를 명시한다(봇 존재를 숨기지 않음).
"""

import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")

SITE_ORIGIN = "https://www.tukorea.ac.kr"

# department code -> RSS URL. robots.txt에서 Allow 확인된 게시판만 등록한다.
# row=50: 최근 50건 — 60분 폴링 주기 대비 충분한 버퍼(운영 중 게시글이 그 사이
# 50건 이상 새로 올라오는 일은 사실상 없다).
DEPARTMENT_RSS_URLS: dict[str, str] = {
    "ce": f"{SITE_ORIGIN}/bbs/ce/201/rssList.do?row=50",
}

_USER_AGENT = (
    "TalJungwangBot/1.0 (+https://taljungwang.app; "
    "contact:moonlandingplan.03@gmail.com; purpose:academic-notice-aggregator)"
)

# RSS <link>가 "/bbs/ce/201/151703/artclView.do" 형태 — 게시글 번호(external_id) 추출.
_ARTICLE_ID_RE = re.compile(r"/(\d+)/artclView\.do")

# 학교 사이트가 pubDate를 "2026-07-16 21:27:37.0"(초 이하 1자리) 형태로 내려준다.
# 표준 RFC-822 pubDate 형식이 아니므로 직접 파싱한다. 값 자체가 이미 KST 표기이므로
# (UTC가 아님) ZoneInfo("Asia/Seoul")을 명시로 부여한다 — CLAUDE.md 시각 규칙.
_PUBDATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})")


def _parse_pubdate(raw: str) -> datetime | None:
    m = _PUBDATE_RE.match(raw.strip())
    if not m:
        return None
    try:
        naive = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None
    return naive.replace(tzinfo=KST)


def parse_rss(xml_text: str) -> list[dict]:
    """RSS XML → [{"external_id", "title", "url", "published_at"}, ...].

    개별 <item> 파싱에 실패해도 전체를 포기하지 않고 해당 항목만 건너뛴다
    (한 항목의 링크/날짜 형식이 어긋나도 나머지 공지는 정상 수집되도록).
    """
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        logger.exception("학과 공지 RSS 파싱 실패(XML 구조 오류)")
        return items

    for item in root.findall(".//item"):
        title_el = item.find("title")
        link_el = item.find("link")
        pubdate_el = item.find("pubDate")

        if title_el is None or link_el is None or pubdate_el is None:
            continue
        title = (title_el.text or "").strip()
        link = (link_el.text or "").strip()
        pubdate_raw = (pubdate_el.text or "").strip()
        if not title or not link:
            continue

        id_match = _ARTICLE_ID_RE.search(link)
        if not id_match:
            logger.warning("학과 공지 RSS: 게시글 번호 추출 실패 — link=%s", link)
            continue

        published_at = _parse_pubdate(pubdate_raw)
        if published_at is None:
            logger.warning("학과 공지 RSS: pubDate 파싱 실패 — raw=%s", pubdate_raw)
            continue

        url = link if link.startswith("http") else f"{SITE_ORIGIN}{link}"

        items.append(
            {
                "external_id": int(id_match.group(1)),
                "title": title,
                "url": url,
                "published_at": published_at,
            }
        )

    return items


async def fetch_department_notices(department: str) -> list[dict]:
    """학과 RSS를 조회해 공지 목록을 반환한다.

    실패 시 예외를 그대로 전파한다 — 호출부(app.services.school)가 잡아서
    "이전 데이터 유지" graceful degradation을 처리한다(이 함수 자체는 캐시를
    모른다 — 스케줄러 크론에서만 호출되며, 요청 경로에서는 절대 호출하지 않는다).
    """
    if department not in DEPARTMENT_RSS_URLS:
        raise ValueError(f"지원하지 않는 학과 코드: {department}")

    client = await get_http_client()
    resp = await client.get(
        DEPARTMENT_RSS_URLS[department],
        headers={"User-Agent": _USER_AGENT},
    )
    resp.raise_for_status()
    return parse_rss(resp.text)
