"""정류장 단위 실시간 능력 판정 회귀 테스트.

`bus_routes.gbis_route_id`(노선 단위)가 아니라 `bus_realtime_targets`(노선+정류장)로
실시간 노선을 판정해야 한다. 그러지 않으면 3400 시흥터미널 승차, 6502 이마트 승차처럼
해당 정류장에 시간표만 있는 노선이 `arrive_in_seconds=None` 실시간 항목으로 나가고,
같은 정류장의 시간표는 중복 방지 필터에 걸려 응답에서 통째로 사라진다.
(docs/2026-08-01-bus-data-source-audit.md "현재 구현의 오류" §5)
"""

import json
from datetime import date, datetime, time, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest

_KST = ZoneInfo("Asia/Seoul")

# 이마트(내부 PK 2). 6502·3401은 gbis_route_id가 있지만 이 정류장의 실시간 관측
# 대상은 아니고(6502는 아예 없음, 3401은 시흥시청), 시흥1만 이마트 실시간 대상이다.
_EMART_META = {
    "id": 2,
    "name": "이마트",
    "gbis_station_id": "224000513",
    "lat": 37.34,
    "lng": 126.73,
    "routes": [
        {
            "id": 6,
            "route_number": "6502",
            "direction_name": "서울행",
            "category": "하교",
            "gbis_route_id": "224000123",
            "is_realtime": True,
        },
        {
            "id": 20,
            "route_number": "시흥1",
            "direction_name": "개봉행",
            "category": "하교",
            "gbis_route_id": "224000456",
            "is_realtime": True,
        },
    ],
}


def _timetable_row(route_id, route_no, departure_time):
    entry = SimpleNamespace(departure_time=departure_time, route_id=route_id)
    route = SimpleNamespace(
        id=route_id,
        route_number=route_no,
        direction_name="서울행",
        category="하교",
    )
    return (entry, route)


def _db_returning(*result_rows):
    """db.execute 를 호출 순서대로 .all() 결과로 응답하는 mock.

    지정한 개수를 넘는 호출은 빈 결과로 답한다. get_arrivals 에 조회가 하나
    추가될 때마다 모든 테스트가 StopAsyncIteration 으로 무너지는 것을 막는다 —
    각 테스트는 자기가 관심 있는 앞쪽 쿼리만 지정하면 된다.
    """
    db = MagicMock()
    pending = []
    for rows in result_rows:
        r = MagicMock()
        r.all = MagicMock(return_value=list(rows))
        pending.append(r)

    def _next(*_args, **_kwargs):
        if pending:
            return pending.pop(0)
        empty = MagicMock()
        empty.all = MagicMock(return_value=[])
        return empty

    db.execute = AsyncMock(side_effect=_next)
    return db


def _route(route_id, route_no):
    return SimpleNamespace(
        id=route_id,
        route_number=route_no,
        direction_name="서울행",
        category="하교",
        gbis_route_id=f"22400{route_id}",
    )


def _ctx(route_no, category="하교", boarding=None, timetable=False):
    return {
        "route_no": route_no,
        "category": category,
        "boarding_label": boarding,
        "has_timetable_source": timetable,
    }


async def _run_get_arrivals(
    db,
    *,
    realtime_routes,
    cached=None,
    now=None,
    timetable_sources=(),
    next_departures=None,
    context_meta=None,
):
    from app.services import bus as bus_mod

    now = now or datetime.now(_KST)
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value=json.dumps(cached) if cached else None)

    meta = dict(context_meta or {})
    for rid in timetable_sources:
        meta.setdefault(rid, _ctx(str(rid)))
        meta[rid]["has_timetable_source"] = True

    with patch.object(bus_mod, "_get_station_meta", AsyncMock(return_value=_EMART_META)), \
         patch.object(
             bus_mod,
             "_realtime_routes_at_stop",
             AsyncMock(return_value=list(realtime_routes)),
         ), \
         patch.object(
             bus_mod,
             "_stop_context_meta",
             AsyncMock(return_value=meta),
         ), \
         patch.object(
             bus_mod,
             "_next_departures",
             AsyncMock(return_value=dict(next_departures or {})),
         ), \
         patch.object(bus_mod, "load_calibrations", AsyncMock(return_value=[])), \
         patch.object(bus_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(bus_mod, "_resolve_avg_intervals", AsyncMock(return_value={})), \
         patch.object(bus_mod, "_resolve_arrival_stats", AsyncMock(return_value={})):
        return await bus_mod.get_arrivals(
            db,
            station_id=2,
            d=now.date(),
            now_time=time(now.hour, now.minute, now.second),
        )


@pytest.mark.asyncio
async def test_route_without_target_at_stop_is_served_as_timetable():
    """6502는 gbis_route_id가 있어도 이마트 실시간 대상이 아니다.
    실시간 placeholder가 아니라 이마트 시간표 출발 시각으로 나가야 한다."""
    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    depart = (now + timedelta(minutes=20)).time().replace(second=0, microsecond=0)
    db = _db_returning([_timetable_row(6, "6502", depart)])

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    by_route = {a["route_no"]: a for a in result["arrivals"]}
    assert "6502" in by_route, "이마트 시간표가 있는 6502가 응답에서 사라졌다"
    assert by_route["6502"]["arrival_type"] == "timetable"
    assert by_route["6502"]["depart_at"] == depart.strftime("%H:%M")
    assert by_route["6502"]["arrive_in_seconds"] > 0
    # 같은 노선이 실시간 placeholder로 중복 등장하면 안 된다
    assert [a for a in result["arrivals"] if a["route_no"] == "6502"] == [by_route["6502"]]


@pytest.mark.asyncio
async def test_route_with_target_at_stop_stays_realtime():
    """시흥1은 이마트 실시간 대상이므로 캐시가 비면 실시간 placeholder를 유지한다."""
    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    db = _db_returning([], [])

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    by_route = {a["route_no"]: a for a in result["arrivals"]}
    assert by_route["시흥1"]["arrival_type"] == "realtime"
    assert by_route["시흥1"]["arrive_in_seconds"] is None


@pytest.mark.asyncio
async def test_timetable_exhausted_route_without_target_gets_tomorrow_first_bus():
    """실시간 대상이 아닌 노선은 오늘 시간표가 끝나면 내일 첫차 안내를 받아야 한다.
    기존 구현은 is_realtime=True라는 이유로 이 경로에서도 제외했다."""
    now = datetime.now(_KST).replace(hour=23, minute=50, second=0, microsecond=0)
    tomorrow_first = time(5, 30)
    db = _db_returning([], [_timetable_row(6, "6502", tomorrow_first)])

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    by_route = {a["route_no"]: a for a in result["arrivals"]}
    assert by_route["6502"]["is_tomorrow"] is True
    assert by_route["6502"]["depart_at"] == "05:30"


@pytest.mark.asyncio
async def test_cached_realtime_entry_is_not_duplicated_by_timetable():
    """실시간 대상 노선이 캐시에 있으면 시간표 중복 출력이 없어야 한다(기존 계약 유지)."""
    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    cached = {
        "cached_at": now.isoformat(),
        "arrivals": [
            {
                "route_id": 20,
                "route_no": "시흥1",
                "destination": "개봉행",
                "category": "하교",
                "arrival_type": "realtime",
                "depart_at": None,
                "arrive_in_seconds": 300,
                "is_tomorrow": False,
            }
        ],
    }
    db = _db_returning([], [])

    result = await _run_get_arrivals(
        db, realtime_routes=[_route(20, "시흥1")], cached=cached, now=now
    )

    assert [a["route_no"] for a in result["arrivals"]].count("시흥1") == 1


@pytest.mark.asyncio
async def test_placeholder_carries_departure_only_for_sanctioned_timetable_source():
    """실시간 대기 중인 노선의 시간표 폴백은 제품이 보장한 승차 시간표에서만 온다.

    20-1 한국공학대는 timetable source 가 있으니 다음 출발 시각을 싣고, 시흥1 이마트는
    원본 `bus_timetable_entries` 는 있어도 source 로 연결되지 않았으므로 싣지 않는다
    (2026-08-01 정보 유형별 최종 표시 정책).
    """
    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    db = _db_returning([], [])

    result = await _run_get_arrivals(
        db,
        realtime_routes=[_route(20, "시흥1"), _route(3, "20-1")],
        timetable_sources={3},
        next_departures={3: "09:20"},
        now=now,
    )

    by_route = {a["route_no"]: a for a in result["arrivals"]}
    assert by_route["20-1"]["depart_at"] == "09:20"
    assert by_route["20-1"]["arrive_in_seconds"] is None
    assert by_route["시흥1"]["depart_at"] is None


@pytest.mark.asyncio
async def test_next_departures_asked_only_for_sanctioned_routes():
    """source 없는 노선은 시간표 조회 대상에서 아예 빠진다."""
    from app.services import bus as bus_mod

    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    db = _db_returning([], [])
    spy = AsyncMock(return_value={})

    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value=None)
    with patch.object(bus_mod, "_get_station_meta", AsyncMock(return_value=_EMART_META)), \
         patch.object(
             bus_mod,
             "_realtime_routes_at_stop",
             AsyncMock(return_value=[_route(20, "시흥1"), _route(3, "20-1")]),
         ), \
         patch.object(
             bus_mod,
             "_stop_context_meta",
             AsyncMock(return_value={
                 3: _ctx("20-1", timetable=True),
                 20: _ctx("시흥1", timetable=False),
             }),
         ), \
         patch.object(bus_mod, "_next_departures", spy), \
         patch.object(bus_mod, "load_calibrations", AsyncMock(return_value=[])), \
         patch.object(bus_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(bus_mod, "_resolve_avg_intervals", AsyncMock(return_value={})), \
         patch.object(bus_mod, "_resolve_arrival_stats", AsyncMock(return_value={})):
        await bus_mod.get_arrivals(
            db, station_id=2, d=now.date(), now_time=time(9, 0, 0)
        )

    assert spy.await_args.args[1] == [3]


@pytest.mark.asyncio
async def test_stop_context_meta_reads_information_sources():
    """정류장이 어떤 노선을 취급하는지의 근거는 프런트 상수가 아니라 DB source 다."""
    from app.services import bus as bus_mod

    class _Ctx:
        bus_route_id = 1
        destination_label = "강남역"
        sort_order = 0
        id = 5

    class _Route:
        route_number = "3400"
        category = "하교"

    class _Src:
        source_type = "timetable"
        source_role = "departure"
        display_label = "시흥터미널 출발"
        sort_order = 0

    ctx = _Ctx()
    ctx.route = _Route()
    rows = MagicMock()
    rows.all = MagicMock(return_value=[(ctx, _Src())])
    db = MagicMock()
    db.execute = AsyncMock(return_value=rows)

    meta = await bus_mod._stop_context_meta(db, 17)

    assert meta[1]["route_no"] == "3400"
    assert meta[1]["has_timetable_source"] is True
    # source_role 기준 승차 문구 통일 규칙을 그대로 따른다
    assert meta[1]["boarding_label"] == "시흥터미널 승차"

    stmt = str(db.execute.await_args.args[0])
    assert "bus_information_sources" in stmt


@pytest.mark.asyncio
async def test_response_exposes_expected_routes_and_labels():
    """홈이 '이 정류장이 취급하는 노선'과 승차 문구를 하드코딩하지 않아도 되게 한다."""
    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    db = _db_returning([], [])

    result = await _run_get_arrivals(
        db,
        realtime_routes=[_route(20, "시흥1")],
        context_meta={
            20: _ctx("시흥1", boarding="이마트 승차"),
            6: _ctx("6502", boarding="이마트 승차", timetable=True),
        },
        now=now,
    )

    expected = {r["route_no"]: r for r in result["expected_routes"]}
    assert set(expected) == {"시흥1", "6502"}
    assert expected["6502"]["boarding_label"] == "이마트 승차"

    live = {a["route_no"]: a for a in result["arrivals"]}
    assert live["시흥1"]["boarding_label"] == "이마트 승차"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "given, resolved",
    [("224000513", 2), ("2", 2), (2, 2)],
)
async def test_resolve_stop_id_accepts_gbis_station_id_and_internal_pk(given, resolved):
    """프런트는 GBIS station id를 그대로 넘긴다. int로만 받으면 조용히 0행이 된다."""
    from app.services import bus as bus_mod

    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=resolved)
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)

    with patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(bus_mod, "set_cached_json", AsyncMock()):
        assert await bus_mod.resolve_stop_id(db, given) == resolved


@pytest.mark.asyncio
async def test_resolve_stop_id_passes_none_through():
    from app.services import bus as bus_mod

    db = MagicMock()
    db.execute = AsyncMock()

    assert await bus_mod.resolve_stop_id(db, None) is None
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_resolve_stop_id_uses_cache_without_db_hit():
    """지도 화면은 이 엔드포인트를 8회 호출한다. 매핑 조회가 매번 DB를 치면 안 된다."""
    from app.services import bus as bus_mod

    db = MagicMock()
    db.execute = AsyncMock()

    with patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=2)):
        assert await bus_mod.resolve_stop_id(db, "224000513") == 2
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_resolve_stop_id_caches_miss_as_none():
    """존재하지 않는 id는 0으로 캐시되고 None으로 되돌아온다."""
    from app.services import bus as bus_mod

    db = MagicMock()
    db.execute = AsyncMock()

    with patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=0)):
        assert await bus_mod.resolve_stop_id(db, "999999999") is None
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_realtime_target_without_stop_route_link_still_appears():
    """3400은 이마트 실시간 관측 대상이지만 `bus_stop_routes` 링크가 없다.
    stop.routes 기준으로 걸러내면 이마트 목록에서 통째로 빠져 "오늘 미운행"이 된다."""
    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    db = _db_returning([], [])

    result = await _run_get_arrivals(
        db,
        realtime_routes=[_route(20, "시흥1"), _route(1, "3400")],
        now=now,
    )

    by_route = {a["route_no"]: a for a in result["arrivals"]}
    assert "3400" in by_route
    assert by_route["3400"]["arrival_type"] == "realtime"


@pytest.mark.asyncio
async def test_realtime_routes_at_stop_queries_enabled_targets_only():
    """헬퍼는 해당 정류장의 enabled target 노선만, gbis_route_id가 있을 때만 돌려준다."""
    from app.services import bus as bus_mod

    routes = [_route(20, "시흥1")]
    unique = MagicMock()
    unique.all = MagicMock(return_value=routes)
    scalars = MagicMock()
    scalars.unique = MagicMock(return_value=unique)
    result = MagicMock()
    result.scalars = MagicMock(return_value=scalars)
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)

    assert await bus_mod._realtime_routes_at_stop(db, 2) == routes

    stmt = str(db.execute.await_args.args[0])
    assert "bus_realtime_targets" in stmt
    assert "bus_realtime_targets.enabled" in stmt
    assert "bus_routes.gbis_route_id IS NOT NULL" in stmt


# ── 운행 시간대 밖 판정 ────────────────────────────────────────────────────
# GBIS에 차가 안 잡히는 이유는 "아직 안 왔다"와 "오늘 끝났다" 두 가지고, 화면에서
# 할 말이 정반대다. 자정 직후 프로덕션에서 3400·시흥1이 "실시간 연결 중 · 잠시 후
# 다시 확인"으로 떠 있던 게 이 구분이 없어서였다.


@pytest.mark.asyncio
async def test_운행_시간대_안이면_종료로_보지_않는다():
    """09시의 무응답은 배차 공백이지 운행 종료가 아니다."""
    now = datetime.now(_KST).replace(hour=9, minute=0, second=0, microsecond=0)
    db = _db_returning([], [], [(20, time(6, 12), time(21, 48))])

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    sihung = next(a for a in result["arrivals"] if a["route_no"] == "시흥1")
    assert sihung["off_service"] is False
    assert sihung["next_first_at"] is None


@pytest.mark.asyncio
async def test_막차_이후에는_내일_첫차를_붙인다():
    now = datetime.now(_KST).replace(hour=23, minute=0, second=0, microsecond=0)
    db = _db_returning(
        [], [], [(20, time(6, 12), time(21, 48))], [(20, time(6, 12))]
    )

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    sihung = next(a for a in result["arrivals"] if a["route_no"] == "시흥1")
    assert sihung["off_service"] is True
    assert sihung["next_first_at"] == "06:12"
    assert sihung["next_first_day"] == "tomorrow"


@pytest.mark.asyncio
async def test_첫차_전에는_오늘_첫차를_붙인다():
    """자정 직후는 '끝났다'가 아니라 '아직 안 시작했다' — 첫차가 오늘이다."""
    now = datetime.now(_KST).replace(hour=0, minute=30, second=0, microsecond=0)
    db = _db_returning([], [], [(20, time(6, 12), time(21, 48))])

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    sihung = next(a for a in result["arrivals"] if a["route_no"] == "시흥1")
    assert sihung["off_service"] is True
    assert sihung["next_first_at"] == "06:12"
    assert sihung["next_first_day"] == "today"


@pytest.mark.asyncio
async def test_시간표가_없는_노선은_판정하지_않는다():
    """운행 시간을 모르는 노선까지 '종료'라고 말하면 없는 사실을 지어내는 것이다."""
    now = datetime.now(_KST).replace(hour=23, minute=0, second=0, microsecond=0)
    db = _db_returning([], [], [])

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    sihung = next(a for a in result["arrivals"] if a["route_no"] == "시흥1")
    assert sihung["off_service"] is False


@pytest.mark.asyncio
async def test_내일_첫차로_대체된_시간표_노선도_종료로_표시된다():
    now = datetime.now(_KST).replace(hour=23, minute=50, second=0, microsecond=0)
    db = _db_returning([], [_timetable_row(6, "6502", time(5, 30))], [])

    result = await _run_get_arrivals(db, realtime_routes=[_route(20, "시흥1")], now=now)

    bus6502 = next(a for a in result["arrivals"] if a["route_no"] == "6502")
    assert bus6502["off_service"] is True
    assert bus6502["next_first_at"] == "05:30"
    assert bus6502["next_first_day"] == "tomorrow"
