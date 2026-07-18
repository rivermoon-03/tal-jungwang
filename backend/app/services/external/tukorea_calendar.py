"""한국공학대학교 학사일정 HTML 테이블 스크레이퍼.

대상: https://www.tukorea.ac.kr/haksa/3000/subview.do
robots.txt(https://www.tukorea.ac.kr/robots.txt) Disallow 목록에 `/haksa/`가
없고(Disallow는 `/bbs/`, `/SemiBootcamp`뿐), 정적으로 렌더링된 HTML 테이블이라
스크래핑 대상으로 확인했다(실제 fetch 결과를 보고 아래 파서를 작성함, 추측 아님).

실제 테이블 구조(2026-07-18 확인):
    <table>
      <caption>학사일정 정보</caption>
      <thead><tr><th>월별</th><th>일정</th><th>내용</th></tr></thead>
      <tbody>
        <tr>
          <th class="td-gubun">2026<br>03</th>
          <td>03.03 ~ 03.03</td>
          <td>`26학년도 1학기 개강(입학일,학기개시일)</td>
        </tr>
        ...
        <tr>
          <th class="td-gubun">2026<br>12</th>
          <td>12.23 ~ 01.14</td>          <!-- 종료월이 시작월보다 작으면 다음해로 이월 -->
          <td>동계방학</td>
        </tr>
      </tbody>
    </table>

연도는 <th class="td-gubun"> 첫 줄에만 있고 종료일에는 표기되지 않는다.
겨울방학처럼 종료일이 해를 넘기는 행이 실제로 존재해(12.23 ~ 01.14),
"종료월 < 시작월이면 종료년 = 시작년 + 1"로 이월을 판정한다.

bs4/lxml이 설치돼 있지 않아(requirements.txt 미포함) 표준 라이브러리
`html.parser.HTMLParser`로 직접 파싱한다.
"""

import logging
import re
from datetime import date
from html.parser import HTMLParser

from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://www.tukorea.ac.kr/haksa/3000/subview.do"

_USER_AGENT = (
    "TalJungwangBot/1.0 (+https://taljungwang.app; "
    "contact:moonlandingplan.03@gmail.com; purpose:academic-calendar-aggregator)"
)

_CAPTION_MARKER = "학사일정"
_DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})")
_WS_RE = re.compile(r"\s+")


class _CalendarTableParser(HTMLParser):
    """`caption`이 "학사일정 정보"인 <table>의 <tbody> 데이터 행만 추출한다.

    페이지 안의 다른 테이블에 영향받지 않도록 caption으로 대상 테이블을
    식별하고, 그 테이블이 끝나는(</table>) 시점에 추적을 해제한다.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._table_depth = 0
        self._target_table_depth: int | None = None
        self._in_caption = False
        self._caption_text = ""
        self._in_row = False
        self._current_cell_tag: str | None = None
        self._current_cell_class = ""
        self._cell_buf: list[str] = []
        self._row_cells: list[tuple[str, str, str]] = []
        self.raw_rows: list[list[tuple[str, str, str]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_d = {k: (v or "") for k, v in attrs}
        if tag == "table":
            self._table_depth += 1
        elif tag == "caption":
            self._in_caption = True
            self._caption_text = ""
        elif tag == "tr" and self._target_table_depth is not None:
            self._in_row = True
            self._row_cells = []
        elif tag in ("th", "td") and self._in_row:
            self._current_cell_tag = tag
            self._current_cell_class = attrs_d.get("class", "")
            self._cell_buf = []
        elif tag == "br" and self._current_cell_tag is not None:
            self._cell_buf.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "caption":
            self._in_caption = False
            if self._target_table_depth is None and _CAPTION_MARKER in self._caption_text:
                self._target_table_depth = self._table_depth
        elif tag == "table":
            if self._target_table_depth == self._table_depth:
                self._target_table_depth = None
            self._table_depth -= 1
        elif tag in ("th", "td") and self._current_cell_tag == tag:
            text = "".join(self._cell_buf)
            self._row_cells.append((tag, self._current_cell_class, text))
            self._current_cell_tag = None
        elif tag == "tr" and self._in_row:
            self._in_row = False
            if self._row_cells:
                self.raw_rows.append(self._row_cells)

    def handle_data(self, data: str) -> None:
        if self._in_caption:
            self._caption_text += data
        if self._current_cell_tag is not None:
            self._cell_buf.append(data)


def _clean(text: str) -> str:
    return _WS_RE.sub(" ", text).strip()


def parse_calendar_html(html_text: str) -> list[dict]:
    """학사일정 HTML → [{"title", "start_date", "end_date"}, ...] (오름차순 아님, 문서 순서).

    실패한 개별 행은 건너뛰고 로깅한다(전체를 포기하지 않음). 헤더 행
    (`<th>월별</th>`, class 없음)은 `td-gubun` 클래스 유무로 걸러낸다.
    """
    parser = _CalendarTableParser()
    parser.feed(html_text)

    events: list[dict] = []
    for cells in parser.raw_rows:
        if len(cells) < 3:
            continue
        gubun_tag, gubun_class, gubun_text = cells[0]
        if gubun_tag != "th" or "td-gubun" not in gubun_class:
            continue  # 헤더 행(월별/일정/내용) 스킵

        year_parts = [p for p in gubun_text.split("\n") if p.strip()]
        if not year_parts:
            logger.warning("학사일정: 연도 파싱 실패 — raw=%r", gubun_text)
            continue
        try:
            year = int(year_parts[0].strip())
        except ValueError:
            logger.warning("학사일정: 연도 파싱 실패 — raw=%r", gubun_text)
            continue

        date_range_text = cells[1][2]
        dates = _DATE_RE.findall(date_range_text)
        if not dates:
            logger.warning("학사일정: 날짜 범위 파싱 실패 — raw=%r", date_range_text)
            continue

        start_month, start_day = (int(x) for x in dates[0])
        try:
            start_date = date(year, start_month, start_day)
        except ValueError:
            logger.warning(
                "학사일정: 시작일 파싱 실패 — year=%s month=%s day=%s", year, start_month, start_day
            )
            continue

        end_date = start_date
        if len(dates) >= 2:
            end_month, end_day = (int(x) for x in dates[1])
            end_year = year + 1 if end_month < start_month else year
            try:
                end_date = date(end_year, end_month, end_day)
            except ValueError:
                logger.warning(
                    "학사일정: 종료일 파싱 실패 — year=%s month=%s day=%s",
                    end_year, end_month, end_day,
                )
                end_date = start_date

        title = _clean(cells[2][2]).lstrip("`").strip()
        if not title:
            continue

        events.append({"title": title, "start_date": start_date, "end_date": end_date})

    return events


async def fetch_academic_calendar() -> list[dict]:
    """학사일정 페이지를 조회해 이벤트 목록을 반환한다.

    실패 시 예외를 그대로 전파한다 — 호출부(app.services.school)가 잡아서
    "이전 데이터 유지" graceful degradation을 처리한다. 스케줄러 크론에서만
    호출되며 요청 경로에서는 절대 호출하지 않는다.
    """
    client = await get_http_client()
    resp = await client.get(CALENDAR_URL, headers={"User-Agent": _USER_AGENT})
    resp.raise_for_status()
    return parse_calendar_html(resp.text)
