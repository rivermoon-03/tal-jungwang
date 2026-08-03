"""시간대 혼잡 프로파일 (B4) 테스트.

원칙: 실데이터(stcis 수동 다운로드)가 없는 동안 UI 가 아예 보이지 않아야 한다.
- 테이블이 비면 서비스는 빈 배열 (프런트는 섹션 미렌더).
- day_type 은 표준 매핑(토요일 → saturday) — 시간표의 saturday → sunday quirk 미적용.
- 적재 스크립트 정규화: 그룹 내 최대 승객수 → 1.0, max=0 그룹은 전부 0.0.
"""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import subway as subway_service
from scripts.load_subway_crowding_profile import normalize_levels, parse_rows

# 2026-05-18 월요일 / 2026-05-16 토요일 / 2026-05-05 어린이날(화, 공휴일)
MONDAY = date(2026, 5, 18)
SATURDAY = date(2026, 5, 16)
HOLIDAY = date(2026, 5, 5)


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


def _db_with(rows):
    db = MagicMock()
    db.execute = AsyncMock(return_value=_FakeResult(rows))
    return db


def _row(hour, level):
    return SimpleNamespace(hour=hour, level=Decimal(str(level)))


# ── 서비스: 빈 테이블 → 빈 배열 ───────────────────────────────────────


@pytest.mark.asyncio
async def test_빈_테이블이면_빈_배열():
    db = _db_with([])
    with patch.object(subway_service, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(subway_service, "set_cached_json", AsyncMock()) as set_mock:
        result = await subway_service.get_crowding_profile(db, "정왕", "1075", "up", MONDAY)

    assert result == []
    # 빈 결과도 캐시한다 (음성 캐싱 — 수동 적재라 6시간 stale 허용).
    set_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_DB_예외는_빈_배열로_저하되고_캐시하지_않는다():
    """테이블 미생성 환경(마이그레이션 미적용)에서 500 대신 빈 배열."""
    db = MagicMock()
    db.execute = AsyncMock(side_effect=RuntimeError("relation does not exist"))
    with patch.object(subway_service, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(subway_service, "set_cached_json", AsyncMock()) as set_mock:
        result = await subway_service.get_crowding_profile(db, "정왕", "1075", "up", MONDAY)

    assert result == []
    set_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_캐시_히트면_DB를_조회하지_않는다():
    """빈 배열 캐시도 히트로 취급 (cached is not None)."""
    db = _db_with([])
    with patch.object(subway_service, "get_cached_json", AsyncMock(return_value=[])):
        result = await subway_service.get_crowding_profile(db, "정왕", "1075", "up", MONDAY)

    assert result == []
    db.execute.assert_not_awaited()


# ── 서비스: 행 반환 형식 ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_행이_있으면_hour_level_float_배열():
    """numeric(3,2) Decimal → float 캐스팅 확인 (JSON 직렬화 대상)."""
    db = _db_with([_row(7, "0.55"), _row(8, "1.00"), _row(9, "0.80")])
    with patch.object(subway_service, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(subway_service, "set_cached_json", AsyncMock()) as set_mock:
        result = await subway_service.get_crowding_profile(db, "정왕", "1075", "up", MONDAY)

    assert result == [
        {"hour": 7, "level": 0.55},
        {"hour": 8, "level": 1.0},
        {"hour": 9, "level": 0.8},
    ]
    assert all(isinstance(x["level"], float) for x in result)
    # TTL 6시간으로 캐시
    assert set_mock.await_args.kwargs.get("ttl") == 21600


# ── 서비스: day_type 매핑 (표준 — 시간표 quirk 미적용) ─────────────────


@pytest.mark.asyncio
async def test_토요일은_saturday_키로_조회():
    """시간표의 saturday → sunday quirk 를 따라가면 안 된다 (stcis 는 토요일 실재)."""
    db = _db_with([])
    with patch.object(subway_service, "get_cached_json", AsyncMock(return_value=None)) as get_mock, \
         patch.object(subway_service, "set_cached_json", AsyncMock()):
        await subway_service.get_crowding_profile(db, "정왕", "1075", "up", SATURDAY)

    cache_key = get_mock.await_args.args[0]
    assert cache_key == "subway:crowding:정왕:1075:up:saturday"


@pytest.mark.asyncio
async def test_공휴일은_sunday_키로_조회():
    db = _db_with([])
    with patch.object(subway_service, "get_cached_json", AsyncMock(return_value=None)) as get_mock, \
         patch.object(subway_service, "set_cached_json", AsyncMock()):
        await subway_service.get_crowding_profile(db, "정왕", "1004", "down", HOLIDAY)

    cache_key = get_mock.await_args.args[0]
    assert cache_key == "subway:crowding:정왕:1004:down:sunday"


# ── 적재 스크립트: 정규화 ─────────────────────────────────────────────


def _csv_row(hour, passengers, *, station="정왕", line="1075", direction="up", day="weekday"):
    return {
        "station_name": station,
        "line_id": line,
        "direction": direction,
        "day_type": day,
        "hour": str(hour),
        "passengers": str(passengers),
    }


def test_정규화_그룹_최대가_1점0():
    rows = parse_rows([_csv_row(7, 100), _csv_row(8, 400), _csv_row(9, 200)])
    out = normalize_levels(rows)
    by_hour = {r["hour"]: r["level"] for r in out}
    assert by_hour[8] == 1.0
    assert by_hour[7] == 0.25
    assert by_hour[9] == 0.5


def test_정규화_소수_둘째자리_반올림():
    """numeric(3,2) 정밀도 — 1/3 → 0.33."""
    rows = parse_rows([_csv_row(7, 1), _csv_row(8, 3)])
    out = normalize_levels(rows)
    by_hour = {r["hour"]: r["level"] for r in out}
    assert by_hour[7] == 0.33


def test_정규화_max_0_그룹은_전부_0():
    rows = parse_rows([_csv_row(2, 0), _csv_row(3, 0)])
    out = normalize_levels(rows)
    assert all(r["level"] == 0.0 for r in out)


def test_정규화는_그룹별로_독립():
    """up 그룹 최대 400 이 down 그룹 정규화에 영향을 주면 안 된다."""
    rows = parse_rows([
        _csv_row(8, 400, direction="up"),
        _csv_row(8, 100, direction="down"),
        _csv_row(9, 50, direction="down"),
    ])
    out = normalize_levels(rows)
    down = {r["hour"]: r["level"] for r in out if r["direction"] == "down"}
    assert down[8] == 1.0
    assert down[9] == 0.5


# ── 적재 스크립트: 검증 ───────────────────────────────────────────────


def test_잘못된_direction은_에러():
    with pytest.raises(ValueError, match="direction"):
        parse_rows([_csv_row(8, 100, direction="상행")])


def test_hour_범위_밖은_에러():
    with pytest.raises(ValueError, match="hour"):
        parse_rows([_csv_row(24, 100)])


def test_중복_PK는_에러():
    with pytest.raises(ValueError, match="중복"):
        parse_rows([_csv_row(8, 100), _csv_row(8, 200)])
