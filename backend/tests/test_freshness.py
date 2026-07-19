"""데이터 신선도 SLO(`app/core/freshness.py`) 단위 테스트 + `/health` 통합 검증.

fakeredis로 실제 Redis 없이 검증한다:
1. mark_fresh가 KST ISO 시각을 TTL 없이(영구) 저장하는지.
2. get_freshness_report가 mget 결과로 age_seconds를 정확히 계산하는지.
3. 한 번도 mark_fresh되지 않은 도메인은 리포트에서 제외되는지.
4. Redis 연결 자체가 실패해도 mark_fresh/get_freshness_report가 예외를 던지지
   않고(mark_fresh는 조용히 무시, report는 빈 dict) 헬스 자체를 죽이지 않는지.
5. `/health` 응답이 기존 shape(status/redis/db)를 유지하면서 freshness 필드를
   포함하는지.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import fakeredis
import pytest
from fastapi.testclient import TestClient

from app.core import freshness as freshness_mod

_KST = ZoneInfo("Asia/Seoul")


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


# ── mark_fresh ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mark_fresh_writes_kst_iso_without_ttl(fake_redis):
    with patch.object(freshness_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await freshness_mod.mark_fresh("bus")

    raw = await fake_redis.get("tj:freshness:bus")
    assert raw is not None

    parsed = datetime.fromisoformat(raw)
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timedelta(hours=9)  # KST(Asia/Seoul) 오프셋

    # TTL을 두지 않는다 — fakeredis에서 만료 없는 키의 ttl()은 -1.
    ttl = await fake_redis.ttl("tj:freshness:bus")
    assert ttl == -1


@pytest.mark.asyncio
async def test_mark_fresh_redis_unavailable_is_noop(fake_redis):
    """Redis 연결 실패는 예외를 삼키고 조용히 무시한다(cache-aside 컨벤션)."""
    with patch.object(
        freshness_mod, "get_redis", AsyncMock(side_effect=ConnectionError("down"))
    ):
        await freshness_mod.mark_fresh("bus")  # 예외 없이 반환되어야 함


@pytest.mark.asyncio
async def test_mark_fresh_overwrites_previous_value(fake_redis):
    """같은 도메인을 다시 mark하면 이전 값을 덮어써 최신 시각만 남는다."""
    old_iso = (datetime.now(_KST) - timedelta(hours=1)).isoformat()
    await fake_redis.set("tj:freshness:bus", old_iso)

    with patch.object(freshness_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await freshness_mod.mark_fresh("bus")

    raw = await fake_redis.get("tj:freshness:bus")
    assert raw != old_iso


# ── get_freshness_report ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_report_computes_age_seconds_for_known_timestamp(fake_redis):
    past = datetime.now(_KST) - timedelta(seconds=120)
    await fake_redis.set("tj:freshness:subway", past.isoformat())

    with patch.object(freshness_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        report = await freshness_mod.get_freshness_report()

    assert "subway" in report
    assert report["subway"]["last_success"] == past.isoformat()
    # 실행 중 약간의 시간이 흐르므로 근사 비교(2초 오차 허용).
    assert 118 <= report["subway"]["age_seconds"] <= 122


@pytest.mark.asyncio
async def test_report_excludes_never_marked_domains(fake_redis):
    with patch.object(freshness_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await freshness_mod.mark_fresh("bus")
        report = await freshness_mod.get_freshness_report()

    assert set(report.keys()) == {"bus"}
    for domain in freshness_mod.DOMAINS:
        if domain != "bus":
            assert domain not in report


@pytest.mark.asyncio
async def test_report_single_mget_round_trip(fake_redis):
    """등록 도메인 전체를 mget 1회로 조회한다(개별 get 반복 금지)."""
    await fake_redis.set("tj:freshness:bus", datetime.now(_KST).isoformat())

    call_count = 0
    real_mget = fake_redis.mget

    async def _counting_mget(keys):
        nonlocal call_count
        call_count += 1
        return await real_mget(keys)

    fake_redis.mget = _counting_mget

    with patch.object(freshness_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await freshness_mod.get_freshness_report()

    assert call_count == 1


@pytest.mark.asyncio
async def test_report_redis_unavailable_returns_empty_dict():
    with patch.object(
        freshness_mod, "get_redis", AsyncMock(side_effect=ConnectionError("down"))
    ):
        report = await freshness_mod.get_freshness_report()

    assert report == {}


@pytest.mark.asyncio
async def test_report_ignores_unparseable_value(fake_redis):
    """손상된 값(파싱 불가)은 조용히 건너뛰고 다른 도메인은 정상 반환한다."""
    await fake_redis.set("tj:freshness:weather", "not-a-valid-iso-datetime")
    await fake_redis.set("tj:freshness:traffic", datetime.now(_KST).isoformat())

    with patch.object(freshness_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        report = await freshness_mod.get_freshness_report()

    assert "weather" not in report
    assert "traffic" in report


# ── /health 통합 ──────────────────────────────────────────────────────────────


class _FakeSessionCtx:
    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc_info):
        return False


class _FakeSessionLocal:
    """`AsyncSessionLocal()`을 흉내내는 콜러블 — `async with` 프로토콜만 지원."""

    def __init__(self, session):
        self._session = session

    def __call__(self):
        return _FakeSessionCtx(self._session)


def _fake_session_local():
    session = MagicMock()
    session.execute = AsyncMock(return_value=None)
    return _FakeSessionLocal(session)


def test_health_response_includes_freshness_field(fake_redis):
    from app.main import app

    marked_at = datetime.now(_KST) - timedelta(seconds=30)
    fake_redis_dict = {"tj:freshness:bus": marked_at.isoformat()}

    async def _fake_mget(keys):
        return [fake_redis_dict.get(k) for k in keys]

    redis_mock = AsyncMock()
    redis_mock.ping = AsyncMock(return_value=True)
    redis_mock.mget = AsyncMock(side_effect=_fake_mget)

    with (
        patch("app.core.cache.get_redis", AsyncMock(return_value=redis_mock)),
        patch("app.core.freshness.get_redis", AsyncMock(return_value=redis_mock)),
        patch("app.core.database.AsyncSessionLocal", _fake_session_local()),
    ):
        client = TestClient(app)
        resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()

    # 기존 응답 shape(status/redis/db) 유지 확인.
    assert body["status"] == "ok"
    assert body["redis"] == "ok"
    assert body["db"] == "ok"

    # freshness 필드 추가 확인.
    assert "freshness" in body
    assert "bus" in body["freshness"]
    assert body["freshness"]["bus"]["last_success"] == marked_at.isoformat()
    assert 28 <= body["freshness"]["bus"]["age_seconds"] <= 32
    # 한 번도 mark되지 않은 도메인은 응답에서 제외된다.
    assert "shuttle" not in body["freshness"]


def test_health_response_degraded_still_includes_freshness():
    """Redis/DB 체크가 실패해도(degraded) freshness 조회 자체는 별도로 시도된다."""
    from app.main import app

    with (
        patch("app.core.cache.get_redis", AsyncMock(side_effect=ConnectionError("down"))),
        patch(
            "app.core.database.AsyncSessionLocal",
            MagicMock(side_effect=ConnectionError("db down")),
        ),
        patch("app.core.freshness.get_redis", AsyncMock(side_effect=ConnectionError("down"))),
    ):
        client = TestClient(app)
        resp = client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["freshness"] == {}
