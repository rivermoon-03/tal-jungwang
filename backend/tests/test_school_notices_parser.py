"""학과 공지 RSS 파서(`app.services.external.tukorea_notices`) 단위 테스트.

실제 사이트를 호출하지 않는다 — `tests/fixtures/tukorea_ce_rss_sample.xml`은
2026-07-18에 실제 https://www.tukorea.ac.kr/bbs/ce/201/rssList.do?row=50
응답에서 발췌한 항목이다.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.services.external.tukorea_notices import parse_rss

_KST = ZoneInfo("Asia/Seoul")
_FIXTURE = Path(__file__).parent / "fixtures" / "tukorea_ce_rss_sample.xml"


def _load_fixture() -> str:
    return _FIXTURE.read_text(encoding="utf-8")


def test_parses_all_items_from_real_sample():
    items = parse_rss(_load_fixture())
    assert len(items) == 4


def test_extracts_external_id_from_link():
    items = parse_rss(_load_fixture())
    assert items[0]["external_id"] == 151703
    assert items[0]["url"] == "https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do"


def test_title_is_preserved_verbatim():
    items = parse_rss(_load_fixture())
    assert items[0]["title"] == "2026학년도 2학기 수강신청 및 교과시간표 안내"


def test_pubdate_is_kst_aware_not_utc():
    """pubDate("2026-07-16 21:27:37.0")는 이미 KST 표기 — UTC로 잘못 태깅하면
    안 된다(CLAUDE.md §1 시각 규칙: KST 값에 UTC tzinfo 부여 패턴 금지)."""
    items = parse_rss(_load_fixture())
    published = items[0]["published_at"]
    assert published.tzinfo is not None
    assert published.utcoffset().total_seconds() == 9 * 3600
    assert published == datetime(2026, 7, 16, 21, 27, 37, tzinfo=_KST)


def test_items_sorted_as_in_feed_newest_first():
    """RSS 자체가 최신순으로 내려오므로 파서는 순서를 바꾸지 않는다(서비스 레이어가
    필요 시 published_at 기준으로 재정렬)."""
    items = parse_rss(_load_fixture())
    dates = [i["published_at"] for i in items]
    assert dates == sorted(dates, reverse=True)


def test_description_body_is_never_stored():
    """본문 전체를 저장하지 않는다 — title/url/published_at/external_id 키만 반환."""
    items = parse_rss(_load_fixture())
    for item in items:
        assert set(item.keys()) == {"external_id", "title", "url", "published_at"}


def test_skips_item_missing_required_fields():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
        <item>
            <title>제목만 있고 link 없음</title>
            <pubDate>2026-07-16 21:27:37.0</pubDate>
        </item>
        <item>
            <title>정상 항목</title>
            <link>/bbs/ce/201/999/artclView.do</link>
            <pubDate>2026-07-16 21:27:37.0</pubDate>
        </item>
    </channel></rss>"""
    items = parse_rss(xml)
    assert len(items) == 1
    assert items[0]["external_id"] == 999


def test_skips_item_with_unparseable_pubdate():
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
        <item>
            <title>날짜 이상함</title>
            <link>/bbs/ce/201/1/artclView.do</link>
            <pubDate>이상한 날짜</pubDate>
        </item>
    </channel></rss>"""
    assert parse_rss(xml) == []


def test_malformed_xml_returns_empty_list_not_raises():
    assert parse_rss("<rss><channel><item><title>안닫힘") == []
