"""한국공학대 TIP 학생식당 + E동 레스토랑 주간 식단표 수집·파싱.

흐름:
  1) GET https://ibook.tukorea.ac.kr/viewer/menu02 → 페이지 HTML에서 bookcode 추출
  2) POST https://ibook.tukorea.ac.kr/web/RawFileList (key, bookcode, base64) → XML
     → <file file_url="…xlsx"/> 추출
  3) GET file_url → xlsx 바이너리
  4) openpyxl 파싱 → JSON

캐시 키 `cafeteria:menu` TTL 6시간. APScheduler가 매일 07:00·11:00 KST에 강제 갱신.
"""
import logging
import re
from datetime import datetime
from io import BytesIO
from zoneinfo import ZoneInfo

import openpyxl

from app.core.cache import get_cached_json, set_cached_json
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

KST = ZoneInfo("Asia/Seoul")
CACHE_KEY = "cafeteria:menu"
CACHE_TTL = 6 * 3600

VIEWER_URL = "https://ibook.tukorea.ac.kr/viewer/menu02"
RAWFILE_URL = "https://ibook.tukorea.ac.kr/web/RawFileList"
WEB_KEY = "kpu"

_BOOKCODE_RE = re.compile(r"bookcode\s*=\s*['\"]([A-Z0-9]+)['\"]")
_FILE_URL_RE = re.compile(r'file_url="([^"]+\.xlsx?[^"]*)"')
_FILE_NAME_RE = re.compile(r'<file\s+name="([^"]+)"')

_DATE_HEADER_RE = re.compile(r"^(\d{1,2})일")
_MEAL_HEADER_RE = re.compile(r"^(천원의\s*아침밥|중식|석식|조식|간식)")
_TIME_RE = re.compile(r"(\d{1,2}:\d{2})\s*[\n~\-]+\s*(\d{1,2}:\d{2})")
_TITLE_TIP_RE = re.compile(r"TIP\s*학생식당")
_TITLE_E_RE = re.compile(r"E동\s*레스토랑")


# ── 다운로드 ─────────────────────────────────────────────────────────────────

async def _fetch_bookcode() -> str:
    client = await get_http_client()
    resp = await client.get(VIEWER_URL, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    m = _BOOKCODE_RE.search(resp.text)
    if not m:
        raise RuntimeError("bookcode를 viewer 페이지에서 찾지 못함")
    return m.group(1)


async def _fetch_file_url(bookcode: str) -> tuple[str, str]:
    """RawFileList XML에서 (file_name, file_url) 추출."""
    client = await get_http_client()
    resp = await client.post(
        RAWFILE_URL,
        headers={
            "X-Requested-With": "XMLHttpRequest",
            "Referer": VIEWER_URL,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        data={"key": WEB_KEY, "bookcode": bookcode, "base64": "N"},
    )
    resp.raise_for_status()
    xml = resp.text
    m_url = _FILE_URL_RE.search(xml)
    m_name = _FILE_NAME_RE.search(xml)
    if not m_url or not m_name:
        raise RuntimeError("RawFileList 응답에서 file_url/name을 찾지 못함")
    return m_name.group(1), m_url.group(1)


async def _download_xlsx(url: str) -> bytes:
    client = await get_http_client()
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.content


# ── 파싱 ─────────────────────────────────────────────────────────────────────

def _clean(v) -> str:
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


def _extract_time(text: str) -> str | None:
    m = _TIME_RE.search(text)
    return f"{m.group(1)}~{m.group(2)}" if m else None


def _find_date_columns(ws, row: int) -> list[tuple[int, str]]:
    cols = []
    for c in range(1, ws.max_column + 1):
        text = _clean(ws.cell(row=row, column=c).value)
        m = _DATE_HEADER_RE.match(text)
        if m:
            cols.append((c, m.group(1)))
    return cols


def _meal_row_ranges(ws, start: int, end: int) -> list[tuple[int, int, str, str | None]]:
    """식사 헤더의 (시작행, 끝행, 식사타입, 시간) 리스트.

    천원의 아침밥처럼 A열에 두 개의 merged 셀(헤더 + 시간 표기)이 인접해 있는
    경우, 두 영역을 한 식사로 묶는다. 그렇지 않으면 ②코너(R5~R6) 같은 후행 행이
    어떤 식사에도 속하지 않게 된다.
    """
    merged_by_top = {(m.min_row, m.min_col): m for m in ws.merged_cells.ranges}
    result = []
    for r in range(start, end + 1):
        text = _clean(ws.cell(row=r, column=1).value)
        if not _MEAL_HEADER_RE.search(text):
            continue
        mtype = re.sub(r"\s+", " ", _MEAL_HEADER_RE.search(text).group(1))
        time = _extract_time(text)
        if (r, 1) in merged_by_top:
            end_row = merged_by_top[(r, 1)].max_row
        else:
            end_row = r

        # 헤더 직후에 또 다른 A열 merged 셀이 있고 그 텍스트가 시간 표기면
        # 같은 식사의 메타 영역으로 보고 범위를 확장한다.
        next_r = end_row + 1
        if (next_r, 1) in merged_by_top:
            next_text = _clean(ws.cell(row=next_r, column=1).value)
            if _TIME_RE.search(next_text):
                if not time:
                    time = _extract_time(next_text)
                end_row = merged_by_top[(next_r, 1)].max_row

        result.append((r, end_row, mtype, time))
    return result


def _collect_menu(ws, start_row: int, end_row: int, col: int) -> list[str]:
    items = []
    for r in range(start_row, end_row + 1):
        v = _clean(ws.cell(row=r, column=col).value)
        if v:
            items.append(v)
    return items


def _parse_section(ws, title_row: int, last_row: int, name: str) -> dict:
    date_cols = _find_date_columns(ws, title_row + 1)
    if not date_cols:
        return {"name": name, "meals": []}
    meals = []
    for hr, end_row, mtype, time in _meal_row_ranges(ws, title_row + 2, last_row):
        by_day = {day: _collect_menu(ws, hr, end_row, col) for col, day in date_cols}
        meals.append({"type": mtype, "time": time, "by_day": by_day})
    return {"name": name, "meals": meals}


def _parse_xlsx(content: bytes) -> dict:
    wb = openpyxl.load_workbook(BytesIO(content), data_only=True)
    ws = wb.active
    week_start = ws.title  # "5.11"

    tip_row = e_row = None
    for m in ws.merged_cells.ranges:
        if m.min_row == m.max_row and m.min_col == 1 and m.max_col >= 6:
            text = _clean(ws.cell(row=m.min_row, column=1).value)
            if _TITLE_TIP_RE.search(text):
                tip_row = m.min_row
            elif _TITLE_E_RE.search(text):
                e_row = m.min_row

    cafeterias = []
    if tip_row is not None:
        last = (e_row - 1) if e_row is not None else ws.max_row
        cafeterias.append(_parse_section(ws, tip_row, last, "TIP 학생식당"))
    if e_row is not None:
        cafeterias.append(_parse_section(ws, e_row, ws.max_row, "E동 레스토랑"))

    return {"week_start": week_start, "cafeterias": cafeterias}


# ── 공개 API ────────────────────────────────────────────────────────────────

async def get_menu(force_refresh: bool = False) -> dict | None:
    """주간 식단표 가져오기 (캐시 우선). force_refresh=True면 캐시 무시."""
    if not force_refresh:
        cached = await get_cached_json(CACHE_KEY)
        if cached:
            return cached

    try:
        bookcode = await _fetch_bookcode()
        file_name, file_url = await _fetch_file_url(bookcode)
        content = await _download_xlsx(file_url)
        parsed = _parse_xlsx(content)
    except Exception:
        logger.exception("학식 식단표 갱신 실패")
        # 실패 시에도 stale 캐시는 살려둠 (만약 있다면) — 아래 None은 cold start만
        cached = await get_cached_json(CACHE_KEY)
        return cached

    now = datetime.now(KST)
    result = {
        **parsed,
        "year": now.year,
        "source_file": file_name,
        "fetched_at": now.isoformat(),
    }
    await set_cached_json(CACHE_KEY, result, ttl=CACHE_TTL)
    return result


async def refresh_menu() -> dict | None:
    """APScheduler가 호출하는 강제 갱신 진입점."""
    return await get_menu(force_refresh=True)
