"""지하철 도착 이력 적재(A5) + 자체 지연 감지(A6) 단위 테스트.

외부 API·DB·Redis 는 전부 모킹한다 (기존 테스트 컨벤션).
핵심 검증:
  - 도착 판정: arvlCd=1 또는 "임박했다가 사라짐"(ETA 소실)만 도착으로 본다.
  - 편차 계산: ±20분 내 가장 가까운 계획 시각과의 차이(분), 자정 wraparound 보정.
  - 지연 판정: 최근 3건 이상의 중앙값이 +5분 이상일 때만.
  - 예외 격리: 이력 적재가 죽어도 폴링(fetch_and_cache_realtime)은 계속된다.
  - DB write 는 도착 확정 시에만 발생한다 (도착 0건이면 세션조차 열지 않음).
"""
from datetime import datetime, time as dtime
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from zoneinfo import ZoneInfo

import pytest

from app.services import subway_realtime as sr

_KST = ZoneInfo("Asia/Seoul")

NOW_TS = 1_755_000_000.0


def _item(train_no, *, line="수인분당선", direction="상행", status_code=99,
          arrive_seconds=None, destination="왕십리"):
    return {
        "train_no": train_no,
        "line": line,
        "direction": direction,
        "destination": destination,
        "status_code": status_code,
        "arrive_seconds": arrive_seconds,
    }


def _prev(trains, age_sec=15):
    return {"fetched_at": NOW_TS - age_sec, "trains": trains}


# ── 1. detect_arrivals — 도착 판정 ──────────────────────────────────────────


def test_arvlCd_1은_도착으로_판정된다():
    items = [_item("6542", status_code=1)]
    events = sr.detect_arrivals(None, items, NOW_TS)
    assert [e["train_no"] for e in events] == ["6542"]


def test_임박했다가_사라진_열차는_ETA_소실_도착으로_판정된다():
    prev = _prev({
        "6542": {"line": "수인분당선", "direction": "상행",
                 "destination": "왕십리", "arrive_seconds": 60, "status_code": 99},
    })
    events = sr.detect_arrivals(prev, [], NOW_TS)
    assert [e["train_no"] for e in events] == ["6542"]
    assert events[0]["direction"] == "상행"


def test_임박하지_않았던_열차가_사라져도_도착이_아니다():
    """멀리서 운행 중이던 열차의 소실은 도착이 아니라 조회 범위 이탈이다."""
    prev = _prev({
        "6542": {"line": "수인분당선", "direction": "상행",
                 "destination": "왕십리", "arrive_seconds": 600, "status_code": 99},
    })
    assert sr.detect_arrivals(prev, [], NOW_TS) == []


def test_스냅샷이_오래되면_ETA_소실_판정을_건너뛴다():
    """심야(10분 주기) 등 폴링 공백이 길면 도착 시각을 특정할 수 없다."""
    prev = _prev(
        {"6542": {"line": "수인분당선", "direction": "상행",
                  "destination": "왕십리", "arrive_seconds": 30, "status_code": 0}},
        age_sec=sr._PREV_MAX_AGE_SEC + 60,
    )
    assert sr.detect_arrivals(prev, [], NOW_TS) == []


def test_아직_보이는_열차는_도착이_아니다():
    prev = _prev({
        "6542": {"line": "수인분당선", "direction": "상행",
                 "destination": "왕십리", "arrive_seconds": 60, "status_code": 99},
    })
    items = [_item("6542", arrive_seconds=30)]
    assert sr.detect_arrivals(prev, items, NOW_TS) == []


def test_같은_열차가_두_경로에_걸려도_이벤트는_1건이다():
    """진입(0) 상태로 스냅샷에 있고 이번 폴링에 도착(1)로 잡혀도 중복 없음."""
    prev = _prev({
        "6542": {"line": "수인분당선", "direction": "상행",
                 "destination": "왕십리", "arrive_seconds": 30, "status_code": 0},
    })
    items = [_item("6542", status_code=1)]
    events = sr.detect_arrivals(prev, items, NOW_TS)
    assert len(events) == 1


# ── 2. nearest_deviation_minutes — 편차 계산 ───────────────────────────────


def _kst(h, m, s=0):
    return datetime(2026, 5, 18, h, m, s, tzinfo=_KST)  # 평일 월요일


def test_가장_가까운_계획_시각과의_편차를_계산한다():
    departures = [dtime(7, 40), dtime(8, 0), dtime(8, 20)]
    assert sr.nearest_deviation_minutes(_kst(8, 7), departures) == 7.0


def test_일찍_도착하면_음수_편차다():
    departures = [dtime(8, 0)]
    assert sr.nearest_deviation_minutes(_kst(7, 55), departures) == -5.0


def test_20분_밖이면_매칭하지_않는다():
    departures = [dtime(9, 0)]
    assert sr.nearest_deviation_minutes(_kst(8, 7), departures) is None


def test_자정_wraparound_전날_막차와_매칭된다():
    """00:05 도착 vs 23:55 계획 → -1430분이 아니라 +10분."""
    arrived = datetime(2026, 5, 19, 0, 5, 0, tzinfo=_KST)
    departures = [dtime(23, 55)]
    assert sr.nearest_deviation_minutes(arrived, departures) == 10.0


def test_시간표가_비어있으면_None():
    assert sr.nearest_deviation_minutes(_kst(8, 7), []) is None


# ── 3. delay_minutes_from_samples — 지연 판정 ──────────────────────────────


def test_중앙값_5분_이상이면_지연이다():
    assert sr.delay_minutes_from_samples([6.0, 7.0, 8.0]) == 7


def test_샘플_3건_미만이면_판정하지_않는다():
    assert sr.delay_minutes_from_samples([9.0, 9.0]) is None


def test_중앙값이_기준_미만이면_지연이_아니다():
    assert sr.delay_minutes_from_samples([1.0, 2.0, 3.0]) is None


def test_이상치_1건이_판정을_뒤집지_않는다():
    """중앙값 기반 — 회차 지연 30분 1건이 있어도 나머지가 정시면 지연 아님."""
    assert sr.delay_minutes_from_samples([0.5, 1.0, 30.0]) is None
    # 반대로 대부분 늦으면 이상치(빠른 1건)가 있어도 지연.
    assert sr.delay_minutes_from_samples([6.0, 6.5, -2.0, 30.0, 7.0]) == 6


def test_경계값_중앙값_정확히_5분도_지연이다():
    assert sr.delay_minutes_from_samples([5.0, 5.0, 5.0]) == 5


# ── 4. _update_deviation_and_delay — Redis 갱신 흐름 ───────────────────────


def _entries(rows):
    return [
        {"direction": d, "departure_time": dep, "destination": "", "updated_at": None}
        for d, dep in rows
    ]


def _redis_mock(lrange_result):
    redis = MagicMock()
    redis.set = AsyncMock(return_value=True)
    redis.lpush = AsyncMock()
    redis.ltrim = AsyncMock()
    redis.expire = AsyncMock()
    redis.lrange = AsyncMock(return_value=lrange_result)
    redis.mget = AsyncMock(return_value=[])
    return redis


@pytest.mark.asyncio
async def test_도착_확정시_편차가_리스트에_쌓이고_지연키가_갱신된다():
    redis = _redis_mock(["7.0", "6.0", "8.0"])
    arrived = _kst(8, 7)
    event = {"train_no": "6542", "line": "수인분당선", "direction": "상행", "destination": "왕십리"}

    with patch("app.services.subway._load_entries", AsyncMock(return_value=_entries([("up", "08:00:00")]))), \
         patch.object(sr, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(sr, "set_cached_json", AsyncMock()) as set_mock:
        await sr._update_deviation_and_delay(None, redis, "정왕", event, arrived)

    dev_key = "subway:deviation:정왕:1075:up"
    redis.lpush.assert_awaited_once_with(dev_key, "7.0")
    redis.ltrim.assert_awaited_once_with(dev_key, 0, sr._DEVIATION_LIST_MAX - 1)
    redis.expire.assert_awaited_once_with(dev_key, sr._DEVIATION_TTL)

    assert set_mock.await_count == 1
    key, payload = set_mock.await_args.args[0], set_mock.await_args.args[1]
    assert key == "subway:delay:정왕:1075:up"
    assert payload["minutes"] == 7
    assert payload["since"] == arrived.isoformat(timespec="seconds")
    assert payload["recent"] == [7.0, 6.0, 8.0]
    assert set_mock.await_args.kwargs.get("ttl") == sr._DELAY_TTL


@pytest.mark.asyncio
async def test_샘플이_부족하면_지연키를_쓰지_않는다():
    redis = _redis_mock(["7.0"])
    event = {"train_no": "6542", "line": "수인분당선", "direction": "상행", "destination": "왕십리"}

    with patch("app.services.subway._load_entries", AsyncMock(return_value=_entries([("up", "08:00:00")]))), \
         patch.object(sr, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(sr, "set_cached_json", AsyncMock()) as set_mock:
        await sr._update_deviation_and_delay(None, redis, "정왕", event, _kst(8, 7))

    redis.lpush.assert_awaited_once()          # 편차는 쌓지만
    assert set_mock.await_count == 0           # 지연키는 쓰지 않는다


@pytest.mark.asyncio
async def test_지연_갱신시_최초_감지_시각_since는_보존된다():
    redis = _redis_mock(["7.0", "6.0", "8.0"])
    existing = {"minutes": 6, "since": "2026-05-18T07:50:00+09:00", "recent": [6.0, 6.0, 6.0]}
    event = {"train_no": "6542", "line": "수인분당선", "direction": "상행", "destination": "왕십리"}

    with patch("app.services.subway._load_entries", AsyncMock(return_value=_entries([("up", "08:00:00")]))), \
         patch.object(sr, "get_cached_json", AsyncMock(return_value=existing)), \
         patch.object(sr, "set_cached_json", AsyncMock()) as set_mock:
        await sr._update_deviation_and_delay(None, redis, "정왕", event, _kst(8, 7))

    assert set_mock.await_args.args[1]["since"] == "2026-05-18T07:50:00+09:00"


@pytest.mark.asyncio
async def test_시간표에_매칭이_없으면_아무것도_쓰지_않는다():
    redis = _redis_mock([])
    event = {"train_no": "6542", "line": "수인분당선", "direction": "상행", "destination": "왕십리"}

    with patch("app.services.subway._load_entries", AsyncMock(return_value=_entries([("up", "09:00:00")]))), \
         patch.object(sr, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(sr, "set_cached_json", AsyncMock()) as set_mock:
        await sr._update_deviation_and_delay(None, redis, "정왕", event, _kst(8, 7))

    redis.lpush.assert_not_awaited()
    assert set_mock.await_count == 0


# ── 5. _record_arrivals — 적재 오케스트레이션 ──────────────────────────────


class _SessionCtx:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *args):
        return False


def _db_session():
    session = MagicMock()
    session.add = Mock()
    session.commit = AsyncMock()
    return session


@pytest.mark.asyncio
async def test_도착_확정시에만_DB에_적재된다():
    redis = _redis_mock([])
    session = _db_session()
    items = [_item("6542", status_code=1)]

    with patch.object(sr, "get_redis", AsyncMock(return_value=redis)), \
         patch.object(sr, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(sr, "set_cached_json", AsyncMock()), \
         patch.object(sr, "_update_deviation_and_delay", AsyncMock()), \
         patch("app.core.database.AsyncSessionLocal", Mock(return_value=_SessionCtx(session))):
        await sr._record_arrivals("정왕", items)

    assert session.add.call_count == 1
    row = session.add.call_args.args[0]
    assert row.station_name == "정왕"
    assert row.line_id == "1075"
    assert row.direction == "상행"
    assert row.train_no == "6542"
    assert row.arrived_at.tzinfo is not None  # KST tz-aware
    assert row.day_type in ("weekday", "saturday", "sunday")
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_도착이_없으면_DB_세션을_열지_않는다():
    """15초 폴링 경로의 DB write 는 도착 확정 시에만 발생해야 한다."""
    redis = _redis_mock([])
    session_factory = Mock()

    with patch.object(sr, "get_redis", AsyncMock(return_value=redis)), \
         patch.object(sr, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(sr, "set_cached_json", AsyncMock()) as set_mock, \
         patch("app.core.database.AsyncSessionLocal", session_factory):
        await sr._record_arrivals("정왕", [_item("6542", arrive_seconds=300)])

    session_factory.assert_not_called()
    # 스냅샷(다음 판정 기준)은 항상 갱신된다.
    assert any(
        call.args[0] == "subway:prev:정왕" for call in set_mock.await_args_list
    )


@pytest.mark.asyncio
async def test_counted_키가_있으면_중복_적재하지_않는다():
    redis = _redis_mock([])
    redis.set = AsyncMock(return_value=None)  # SET NX 실패 = 이미 적재됨
    session_factory = Mock()

    with patch.object(sr, "get_redis", AsyncMock(return_value=redis)), \
         patch.object(sr, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(sr, "set_cached_json", AsyncMock()), \
         patch("app.core.database.AsyncSessionLocal", session_factory):
        await sr._record_arrivals("정왕", [_item("6542", status_code=1)])

    redis.set.assert_awaited_once_with(
        "subway:counted:정왕:6542", "1", nx=True, ex=sr._COUNTED_TTL
    )
    session_factory.assert_not_called()


# ── 6. 예외 격리 — 적재 실패가 폴링을 죽이지 않는다 ─────────────────────────


@pytest.mark.asyncio
async def test_이력_적재가_죽어도_폴링은_데이터를_반환한다():
    data = [_item("6542", arrive_seconds=120)]
    redis = _redis_mock([])

    with patch.object(sr, "fetch_realtime", AsyncMock(return_value=data)), \
         patch.object(sr, "set_cached_json", AsyncMock()), \
         patch.object(sr, "get_redis", AsyncMock(return_value=redis)), \
         patch.object(sr, "_store_last_success", AsyncMock()), \
         patch.object(sr, "_record_arrivals", AsyncMock(side_effect=RuntimeError("적재 실패"))):
        result = await sr.fetch_and_cache_realtime("정왕")

    assert result == data


@pytest.mark.asyncio
async def test_요청_경로의_cache_aside_fetch는_이력을_적재하지_않는다():
    """read-only 인스턴스(DISABLE_SCHEDULER=1)가 요청을 받아도 중복 기록이 없어야 한다."""
    data = [_item("6542", arrive_seconds=120)]
    redis = _redis_mock([])
    redis.mget = AsyncMock(return_value=[None, None, None, None])

    with patch.object(sr, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(sr, "fetch_realtime", AsyncMock(return_value=data)), \
         patch.object(sr, "set_cached_json", AsyncMock()), \
         patch.object(sr, "get_redis", AsyncMock(return_value=redis)), \
         patch.object(sr, "_store_last_success", AsyncMock()), \
         patch.object(sr, "_read_last_success", AsyncMock(return_value=None)), \
         patch.object(sr, "_record_arrivals", AsyncMock()) as record_mock:
        result = await sr.get_realtime_cached("정왕")

    record_mock.assert_not_awaited()
    assert result["items"] == data


# ── 7. 지연 상태 응답 첨부 ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_read_delays는_지연중인_방향만_반환한다():
    import json as _json

    redis = _redis_mock([])
    payload = {"minutes": 6, "since": "2026-05-18T08:00:00+09:00", "recent": [6.0, 7.0, 5.5]}

    async def fake_mget(keys):
        return [
            _json.dumps(payload) if key == "subway:delay:정왕:1075:up" else None
            for key in keys
        ]

    redis.mget = AsyncMock(side_effect=fake_mget)
    with patch.object(sr, "get_redis", AsyncMock(return_value=redis)):
        delays = await sr._read_delays("정왕")

    assert delays == {("수인분당선", "상행"): payload}


def test_attach_delays는_같은_노선_방향_항목에만_붙인다():
    items = [
        _item("6542", line="수인분당선", direction="상행"),
        _item("6543", line="수인분당선", direction="하행"),
        _item("4590", line="4호선", direction="상행"),
    ]
    delays = {
        ("수인분당선", "상행"): {"minutes": 6, "since": "2026-05-18T08:00:00+09:00", "recent": [6.0, 7.0, 5.5]},
    }
    sr._attach_delays(items, delays)

    assert items[0]["delay_minutes"] == 6
    assert items[0]["delay_since"] == "2026-05-18T08:00:00+09:00"
    assert items[0]["delay_samples"] == [6.0, 7.0, 5.5]
    assert "delay_minutes" not in items[1]
    assert "delay_minutes" not in items[2]


def test_지연이_없으면_delay_필드_자체가_생기지_않는다():
    items = [_item("6542")]
    sr._attach_delays(items, {})
    assert "delay_minutes" not in items[0]
