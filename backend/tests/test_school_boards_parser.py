"""tukorea_boards 목록 파서 테스트 — 실제 장학공지(1097) 목록 HTML 스냅샷 기반."""
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.services.external.tukorea_boards import BOARD_SOURCES, parse_board_list

_KST = ZoneInfo("Asia/Seoul")

FIXTURE = Path(__file__).parent / "fixtures" / "tukorea_board_sample.html"


def test_실제_목록_HTML에서_공지를_추출한다():
    items = parse_board_list(FIXTURE.read_text(encoding="utf-8"))
    assert len(items) >= 2

    first = items[0]
    assert first["external_id"] == 152029
    assert first["url"].startswith("https://www.tukorea.ac.kr/bbs/tukorea/374/152029")
    assert "학자금대출" in first["title"]
    # '새글' 뱃지 텍스트는 제목에서 제거된다
    assert not first["title"].endswith("새글")
    assert first["published_at"] == datetime(2026, 7, 31, tzinfo=_KST)


def test_링크_없는_행은_건너뛴다():
    html = "<table><tr><th>번호</th><th>제목</th></tr></table>"
    assert parse_board_list(html) == []


def test_카테고리_레지스트리는_robots_허용_경로만_쓴다():
    for src in BOARD_SOURCES.values():
        # /bbs/ 하위(본문·RSS)는 Disallow — 목록 페이지(subview.do)만 허용된다
        assert "/bbs/" not in src["url"]
        assert src["url"].endswith("subview.do")
