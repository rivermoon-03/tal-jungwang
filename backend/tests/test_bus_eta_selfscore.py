"""버스 정확도 기능 회귀 테스트 — A1 잔여좌석 / A4 ETA 자가 채점.

- gbis.py: remainSeatCnt1/2 파싱 (0석=만차 보존, 누락=-1)
- bus_collector: 캐시 슬롯에 remain_seat/location_no 적재, 폴링마다 예측 버퍼
  기록, 도착 판정(detected) 시 버퍼 회수 → bus_eta_samples 오차 샘플 생성
- bus_stats: refresh_eta_accuracy 집계 / get_eta_accuracy 조회

외부 API·DB·Redis는 기존 테스트 패턴대로 전부 모킹한다.
"""

import json
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Fake Redis (list/pipeline 지원) ──────────────────────────────────────
# bus_collector가 쓰는 명령만 구현한 인메모리 fake. pipeline은 redis-py처럼
# 명령을 동기로 큐잉하고 execute()에서 순서대로 실행한다.
class FakePipeline:
    def __init__(self, redis):
        self._redis = redis
        self._ops = []

    def __getattr__(self, name):
        def queue(*args, **kwargs):
            self._ops.append((name, args, kwargs))
            return self

        return queue

    async def execute(self):
        out = []
        for name, args, kwargs in self._ops:
            out.append(await getattr(self._redis, name)(*args, **kwargs))
        self._ops = []
        return out


class FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}
        self.lists: dict[str, list[str]] = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None, nx=False):
        if nx and key in self.store:
            return None
        self.store[key] = value
        return True

    async def exists(self, key):
        return 1 if key in self.store or key in self.lists else 0

    async def delete(self, key):
        existed = key in self.store or key in self.lists
        self.store.pop(key, None)
        self.lists.pop(key, None)
        return 1 if existed else 0

    async def rpush(self, key, value):
        self.lists.setdefault(key, []).append(value)
        return len(self.lists[key])

    async def lrange(self, key, start, end):
        lst = self.lists.get(key, [])
        n = len(lst)
        s = start + n if start < 0 else start
        e = end + n if end < 0 else end
        return lst[max(0, s):e + 1]

    async def ltrim(self, key, start, end):
        lst = self.lists.get(key)
        if lst is None:
            return True
        n = len(lst)
        s = start + n if start < 0 else start
        e = end + n if end < 0 else end
        self.lists[key] = lst[max(0, s):e + 1]
        return True

    async def expire(self, key, ttl):
        return True

    def pipeline(self):
        return FakePipeline(self)


# ── Fake DB 세션 ─────────────────────────────────────────────────────────
class FakeSession:
    def __init__(self):
        self.added = []
        self.commits = 0

    def add_all(self, objs):
        self.added.extend(objs)

    async def commit(self):
        self.commits += 1


class _SessionCM:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *args):
        return False


def _make_target(route):
    return {
        "stop_id": 3,
        "stop_name": "한국공학대학교",
        "gbis_station_id": "224000639",
        "routes": {"R1": route},
        "travel_directions": {"R1": "to_school"},
    }


def _route():
    return MagicMock(
        id=12,
        route_number="5602",
        direction_name="구로행",
        category="등교",
    )


async def _run_poll(fake_redis, fake_session, items_sequence):
    """poll_and_collect를 items_sequence 횟수만큼 실행 (모든 외부 의존 모킹)."""
    from app.services import bus_collector

    route = _route()
    target = _make_target(route)
    fetch = AsyncMock(side_effect=list(items_sequence))

    with (
        patch.object(bus_collector, "_load_realtime_stations", AsyncMock(return_value=[target])),
        patch.object(bus_collector, "fetch_arrivals", fetch),
        patch.object(bus_collector, "get_redis", AsyncMock(return_value=fake_redis)),
        patch.object(bus_collector, "AsyncSessionLocal", lambda: _SessionCM(fake_session)),
    ):
        for _ in items_sequence:
            await bus_collector.poll_and_collect()


# ── 1. GBIS 잔여좌석 파싱 ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_fetch_arrivals_parses_remain_seat_1_and_2():
    """remainSeatCnt1/2를 모두 파싱하고 0석(만차)을 -1로 뭉개지 않는다."""
    body = {
        "response": {
            "msgBody": {
                "busArrivalList": [
                    {
                        "routeId": 1234,
                        "predictTimeSec1": 300,
                        "remainSeatCnt1": 0,
                        "remainSeatCnt2": 17,
                    }
                ]
            }
        }
    }
    mock_resp = MagicMock()
    mock_resp.json = MagicMock(return_value=body)
    mock_resp.raise_for_status = MagicMock(return_value=None)
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    async def _get_client():
        return mock_client

    with patch("app.services.external.gbis.get_http_client", side_effect=_get_client):
        from app.services.external.gbis import fetch_arrivals

        results = await fetch_arrivals("224000639")

    assert results[0]["remain_seat1"] == 0  # 만차 — 정보 없음(-1)과 구분돼야 한다
    assert results[0]["remain_seat2"] == 17


@pytest.mark.parametrize(
    "value, expected",
    [(None, -1), ("", -1), (0, 0), ("0", 0), (7, 7), ("34", 34)],
)
def test_seat_count_preserves_zero_and_defaults_missing(value, expected):
    from app.services.external.gbis import _seat_count

    assert _seat_count(value) == expected


# ── 2. 수집기 캐시 슬롯 — remain_seat/location_no ────────────────────────
@pytest.mark.asyncio
async def test_collector_cache_slot_carries_remain_seat_and_location_no():
    fake_redis = FakeRedis()
    fake_session = FakeSession()
    items = [{
        "route_id": "R1",
        "predict_time_sec1": 300,
        "predict_time_sec2": 720,
        "plate_no1": "경기70아1234",
        "plate_no2": "경기70아5678",
        "crowded1": 1,
        "crowded2": 0,
        "location_no1": 2,
        "location_no2": 7,
        "remain_seat1": 12,
        "remain_seat2": 0,
    }]

    await _run_poll(fake_redis, fake_session, [items])

    payload = json.loads(fake_redis.store["bus:arrivals:3"])
    arrivals = payload["arrivals"]
    assert len(arrivals) == 2
    assert arrivals[0]["remain_seat"] == 12
    assert arrivals[0]["location_no"] == 2
    assert arrivals[1]["remain_seat"] == 0  # 만차 보존
    assert arrivals[1]["location_no"] == 7


@pytest.mark.asyncio
async def test_collector_cache_slot_defaults_remain_seat_when_missing():
    """gbis 응답에 remain_seat 키가 없어도(하위호환) -1로 채워 슬롯 형태를 고정한다."""
    fake_redis = FakeRedis()
    fake_session = FakeSession()
    items = [{
        "route_id": "R1",
        "predict_time_sec1": 300,
        "plate_no1": "경기70아1234",
        "crowded1": 0,
        "location_no1": 0,
    }]

    await _run_poll(fake_redis, fake_session, [items])

    payload = json.loads(fake_redis.store["bus:arrivals:3"])
    assert payload["arrivals"][0]["remain_seat"] == -1


# ── 3. ETA 자가 채점 — 예측 버퍼 적재 + 도착 시 오차 샘플 ─────────────────
@pytest.mark.asyncio
async def test_collector_records_eta_predictions_per_plate():
    fake_redis = FakeRedis()
    fake_session = FakeSession()
    items = [{
        "route_id": "R1",
        "predict_time_sec1": 80,
        "predict_time_sec2": 600,
        "plate_no1": "경기70아1234",
        "plate_no2": "경기70아5678",
        "crowded1": 0,
        "crowded2": 0,
    }]

    await _run_poll(fake_redis, fake_session, [items])

    key1 = "bus:eta_pred:224000639:경기70아1234"
    key2 = "bus:eta_pred:224000639:경기70아5678"
    assert len(fake_redis.lists[key1]) == 1
    assert len(fake_redis.lists[key2]) == 1  # 두 번째 차량 예측도 기록
    t, p = json.loads(fake_redis.lists[key1][0])
    assert p == 80
    assert abs(t - datetime.now(timezone.utc).timestamp()) < 30


@pytest.mark.asyncio
async def test_detected_arrival_harvests_buffer_into_eta_samples():
    """이전 폴링 sec ≤ 90이던 차량이 사라지면(detected) 버퍼가 오차 샘플이 된다."""
    from app.models.bus import BusArrivalHistory, BusEtaSample

    fake_redis = FakeRedis()
    fake_session = FakeSession()
    items_poll1 = [{
        "route_id": "R1",
        "predict_time_sec1": 80,
        "plate_no1": "경기70아1234",
        "crowded1": 0,
    }]

    # 1차 폴링: 예측 기록 → 2차 폴링: 차량 소멸 → 도착 판정
    await _run_poll(fake_redis, fake_session, [items_poll1, []])

    histories = [o for o in fake_session.added if isinstance(o, BusArrivalHistory)]
    samples = [o for o in fake_session.added if isinstance(o, BusEtaSample)]
    assert len(histories) == 1
    assert histories[0].source == "detected"
    assert len(samples) == 1

    s = samples[0]
    assert s.route_number == "5602"
    assert s.station_id == 3  # 내부 stop PK — GBIS id가 아니다
    assert s.plate_no == "경기70아1234"
    assert s.lead_sec == 80
    # 테스트는 두 폴링이 거의 동시라 error_sec ≈ -80 (예측보다 80초 일찍 "도착")
    assert -85 <= s.error_sec <= -74
    assert s.observed_at.tzinfo is not None  # KST tz-aware

    # 회수된 버퍼는 삭제 — 같은 차량의 다음 운행과 섞이면 안 된다
    assert "bus:eta_pred:224000639:경기70아1234" not in fake_redis.lists


@pytest.mark.asyncio
async def test_collect_eta_samples_skips_corrupt_entries():
    from app.services.bus_collector import _collect_eta_samples

    fake_redis = FakeRedis()
    key = "bus:eta_pred:224000639:경기70아1234"
    now = datetime.now(timezone.utc)
    await fake_redis.rpush(key, "not-json")
    await fake_redis.rpush(key, json.dumps([int(now.timestamp()) - 100, 0]))  # 예측 0초 → 스킵
    await fake_redis.rpush(key, json.dumps([int(now.timestamp()) - 100, 90]))

    samples = await _collect_eta_samples(
        fake_redis, "224000639", 3, [("경기70아1234", "5602")], now
    )

    assert len(samples) == 1
    assert samples[0].lead_sec == 90
    assert samples[0].error_sec == 100 - 90


# ── 4. bus_stats — 집계/조회 ─────────────────────────────────────────────
def _exec_result(rowcount=None, mapping=None):
    res = MagicMock()
    res.rowcount = rowcount
    mappings = MagicMock()
    mappings.first = MagicMock(return_value=mapping)
    res.mappings = MagicMock(return_value=mappings)
    return res


@pytest.mark.asyncio
async def test_refresh_eta_accuracy_upserts_and_purges():
    from app.services.bus_stats import ETA_ACCURACY_MIN_SAMPLES, refresh_eta_accuracy

    session = MagicMock()
    session.execute = AsyncMock(side_effect=[
        _exec_result(rowcount=4),    # upsert
        _exec_result(rowcount=1),    # stale 삭제
        _exec_result(rowcount=120),  # 28일 초과 샘플 정리
    ])
    session.commit = AsyncMock()

    result = await refresh_eta_accuracy(session)

    assert result["updated"] == 4
    assert result["deleted"] == 1
    assert result["purged_samples"] == 120
    session.commit.assert_awaited_once()

    upsert_sql = str(session.execute.await_args_list[0].args[0])
    assert "bus_eta_accuracy" in upsert_sql
    assert "bus_eta_samples" in upsert_sql
    # 표본 하한이 파라미터로 전달된다 (50 미만 행 미생성)
    upsert_params = session.execute.await_args_list[0].args[1]
    assert upsert_params["min_samples"] == ETA_ACCURACY_MIN_SAMPLES == 50

    purge_sql = str(session.execute.await_args_list[2].args[0])
    assert "DELETE FROM bus_eta_samples" in purge_sql


@pytest.mark.asyncio
async def test_get_eta_accuracy_returns_payload_or_none():
    from app.services.bus_stats import get_eta_accuracy

    row = {
        "sample_size": 132,
        "mae_sec": 47,
        "bias_sec": -12,
        "within60_ratio": Decimal("0.842"),
        "updated_at": datetime(2026, 8, 3, 3, 47, tzinfo=timezone.utc),
    }
    session = MagicMock()
    session.execute = AsyncMock(return_value=_exec_result(mapping=row))

    payload = await get_eta_accuracy(session, "3400", 3)
    assert payload == {
        "sample_size": 132,
        "mae_sec": 47,
        "bias_sec": -12,
        "within60_ratio": 0.842,
        "updated_at": "2026-08-03T03:47:00+00:00",
    }

    session.execute = AsyncMock(return_value=_exec_result(mapping=None))
    assert await get_eta_accuracy(session, "3400", 3) is None


# ── 5. 스케줄러 등록 — 03:47 KST ─────────────────────────────────────────
def test_scheduler_registers_eta_accuracy_job_at_0347():
    import inspect

    from app.core import scheduler as sched_mod

    src = inspect.getsource(sched_mod.setup_scheduler)
    assert "bus_eta_accuracy_refresh" in src
    assert "_bus_eta_accuracy_refresh_job" in src
    # 03:47 KST — 나이틀리 슬롯(03:45 purge와 03:50 calendar 사이)
    idx = src.index("bus_eta_accuracy_refresh")
    window = src[max(0, idx - 400):idx + 200]
    assert "hour=3" in window and "minute=47" in window
