"""tukorea_boards 목록 파서 테스트 — 실제 장학공지(1097) 목록 HTML 스냅샷 기반."""
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.services.external.tukorea_boards import BOARD_SOURCES, parse_board_list

_KST = ZoneInfo("Asia/Seoul")

FIXTURE = Path(__file__).parent / "fixtures" / "tukorea_board_sample.html"
# 리스트형 마크업(취업 1098 · 생활관 dorm/2630) — <tr>이 아니라 <li class="notice">에
# <dl class="date">로 날짜가 들어간다. 표형만 지원하던 초기 파서가 이 두 게시판에서
# 0건을 반환한 회귀를 고정한다.
LIST_FIXTURE = Path(__file__).parent / "fixtures" / "tukorea_board_list_sample.html"


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


def test_리스트형_마크업에서도_공지를_추출한다():
    items = parse_board_list(LIST_FIXTURE.read_text(encoding="utf-8"))
    assert len(items) >= 1
    first = items[0]
    assert first["external_id"] > 0
    assert first["url"].startswith("https://www.tukorea.ac.kr/bbs/dorm/")
    assert first["title"]
    assert first["published_at"].year >= 2025


def test_HTML_엔티티는_디코딩해서_저장한다():
    html = (
        '<a href="/bbs/tukorea/375/1/artclView.do"><strong>&quot;2차&quot; 모집 &amp; 안내</strong></a>'
        '<dl class="date"><dd>2026.07.27</dd></dl>'
    )
    items = parse_board_list(html)
    assert items[0]["title"] == '"2차" 모집 & 안내'


def test_같은_글의_중복_링크는_한_번만_수집한다():
    """썸네일·제목이 각각 링크인 목록에서 같은 external_id가 두 번 잡히지 않아야 한다."""
    html = (
        '<a href="/bbs/tukorea/374/999/artclView.do"><strong>제목</strong></a>'
        '<a href="/bbs/tukorea/374/999/artclView.do"><strong>제목</strong></a>'
        "<td>2026.07.31</td>"
    )
    items = parse_board_list(html)
    assert [i["external_id"] for i in items] == [999]


def test_링크_없는_행은_건너뛴다():
    html = "<table><tr><th>번호</th><th>제목</th></tr></table>"
    assert parse_board_list(html) == []


def test_카테고리_레지스트리는_robots_허용_경로만_쓴다():
    for src in BOARD_SOURCES.values():
        # /bbs/ 하위(본문·RSS)는 Disallow — 목록 페이지(subview.do)만 허용된다
        assert "/bbs/" not in src["url"]
        assert src["url"].endswith("subview.do")
