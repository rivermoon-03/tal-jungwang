"""학사일정 HTML 파서(`app.services.external.tukorea_calendar`) 단위 테스트.

실제 사이트를 호출하지 않는다 — `tests/fixtures/tukorea_calendar_sample.html`은
2026-07-18에 실제 https://www.tukorea.ac.kr/haksa/3000/subview.do 응답에서
발췌한 <table> 구조(캡션 "학사일정 정보", th.td-gubun, <br> 위치 등 원본 그대로)다.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from app.services.external.tukorea_calendar import parse_calendar_html

_FIXTURE = Path(__file__).parent / "fixtures" / "tukorea_calendar_sample.html"


def _load_fixture() -> str:
    return _FIXTURE.read_text(encoding="utf-8")


def test_parses_only_target_table_rows():
    """캡션이 다른/없는 테이블의 셀은 무시하고, "학사일정 정보" 테이블의 데이터 행만 반환.
    헤더 행(<th>월별</th>, class 없음)도 제외되어야 한다."""
    events = parse_calendar_html(_load_fixture())
    assert len(events) == 5
    for ev in events:
        assert "월별" not in ev["title"]
        assert "다른 테이블" not in ev["title"]


def test_single_day_event_has_equal_start_end():
    events = parse_calendar_html(_load_fixture())
    ev = next(e for e in events if "개교기념일" in e["title"])
    assert ev["start_date"] == date(2026, 12, 20)
    assert ev["end_date"] == date(2026, 12, 20)


def test_multi_day_event_within_same_month():
    events = parse_calendar_html(_load_fixture())
    ev = next(e for e in events if "수강정정" in e["title"])
    assert ev["start_date"] == date(2026, 3, 3)
    assert ev["end_date"] == date(2026, 3, 9)


def test_year_rollover_when_end_month_before_start_month():
    """겨울 계절학기(12.23 ~ 01.14)처럼 종료월이 시작월보다 작으면 종료년을
    시작년+1로 이월한다 — th에는 연도가 시작월 기준으로만 한 번 표기되므로
    문자열 그대로 쓰면 종료일이 연초로 잘못 파싱된다."""
    events = parse_calendar_html(_load_fixture())
    ev = next(e for e in events if "동계 계절학기" in e["title"])
    assert ev["start_date"] == date(2026, 12, 23)
    assert ev["end_date"] == date(2027, 1, 14)


def test_explicit_next_year_row_uses_its_own_year():
    events = parse_calendar_html(_load_fixture())
    ev = next(e for e in events if e["title"] == "1학기 개강")
    assert ev["start_date"] == date(2027, 3, 2)
    assert ev["end_date"] == date(2027, 3, 2)


def test_leading_backtick_stripped_from_title():
    """원문 title 셀이 "`26학년도 ..." 처럼 backtick으로 시작하는 경우가 있다
    (사이트의 아포스트로피 입력 아티팩트) — 표시용으로 정리한다."""
    events = parse_calendar_html(_load_fixture())
    ev = next(e for e in events if "1학기 개강(입학일" in e["title"])
    assert not ev["title"].startswith("`")
    assert ev["title"] == "26학년도 1학기 개강(입학일,학기개시일)"


def test_malformed_html_returns_empty_list_not_raises():
    assert parse_calendar_html("<html><body>구조 없음</body></html>") == []


def test_row_with_unparseable_date_is_skipped_not_fatal():
    html = """
    <table>
      <caption>학사일정 정보</caption>
      <tbody>
        <tr>
          <th class="td-gubun">2026<br>13</th>
          <td>13.99 ~ 13.99</td>
          <td>잘못된 날짜</td>
        </tr>
        <tr>
          <th class="td-gubun">2026<br>03</th>
          <td>03.03 ~ 03.03</td>
          <td>정상 항목</td>
        </tr>
      </tbody>
    </table>
    """
    events = parse_calendar_html(html)
    assert len(events) == 1
    assert events[0]["title"] == "정상 항목"
