"""B3 통학축 돌발상황 — ITS 어댑터 저하·bbox/유형 필터·cache-aside TTL 테스트."""
from unittest.mock import AsyncMock, patch

import fakeredis
import pytest
from fastapi import Response

from app.api import traffic as traffic_api
from app.core import cache as cache_mod
from app.services import traffic_incidents as svc
from app.services.external import its


# ── 헬퍼 ──────────────────────────────────────────────────────


def _item(**over):
    """bbox 안의 정상 사고 item. over로 개별 필드를 덮어쓴다."""
    base = {
        "eventType": "교통사고",
        "roadName": "서해안로",
        "message": "서해안로 3중 추돌사고",
        "startDate": "20260803140500",
        "coordX": "126.75",
        "coordY": "37.40",
    }
    base.update(over)
    return base


def _payload(items):
    return {"body": {"totalCount": len(items), "items": items}}


class _FakeResp:
    def __init__(self, *, text="", json_data=None, content_type="application/json"):
        self.text = text
        self._json = json_data
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        pass

    def json(self):
        return self._json


def _make_request(path="/api/v1/traffic/incidents"):
    """slowapi.Limiter가 isinstance(Request) 체크하므로 진짜 Starlette Request가 필요."""
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
        "app": None,
    }
    return Request(scope)


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


# ── 어댑터 파싱: 유형·bbox 필터 ──────────────────────────────


def test_사고와_공사만_남기고_유형을_정규화한다():
    items = [
        _item(eventType="교통사고"),
        _item(eventType="공사", message="차로 축소 공사"),
        _item(eventType="기상"),
        _item(eventType="기타행사"),
    ]
    result = its.parse_incident_response(_payload(items))

    assert [r["type"] for r in result] == ["accident", "construction"]
    assert result[0]["road_name"] == "서해안로"
    assert result[1]["message"] == "차로 축소 공사"


def test_통학축_bbox_밖의_돌발은_버린다():
    items = [
        _item(),                                   # bbox 안
        _item(coordX="127.05", coordY="37.50"),    # 서울 도심 — 축 밖
        _item(coordX="126.75", coordY="37.20"),    # 남쪽 — 축 밖
    ]
    result = its.parse_incident_response(_payload(items))
    assert len(result) == 1


def test_좌표가_없으면_통학축_판정이_불가하므로_버린다():
    result = its.parse_incident_response(_payload([_item(coordX=None, coordY=None)]))
    assert result == []


def test_occurred_at은_KST_tz_aware_ISO다():
    result = its.parse_incident_response(_payload([_item(startDate="20260803140500")]))
    assert result[0]["occurred_at"] == "2026-08-03T14:05:00+09:00"


def test_startDate가_깨져도_항목은_유지된다():
    result = its.parse_incident_response(_payload([_item(startDate="not-a-date")]))
    assert len(result) == 1
    assert result[0]["occurred_at"] is None


def test_봉투가_깨진_payload는_빈_목록이다():
    assert its.parse_incident_response({}) == []
    assert its.parse_incident_response({"body": None}) == []
    assert its.parse_incident_response({"body": {"items": "oops"}}) == []


# ── 어댑터 저하: 미승인 'Forbidden' 텍스트 → None ────────────


def _client_with(resp):
    client = AsyncMock()
    client.get = AsyncMock(return_value=resp)
    return client


@pytest.fixture
def its_key():
    """ITS 전용 키가 설정된 상태. 없으면 fetch_incidents 가 호출 전에 None 을 낸다."""
    with patch.object(its.settings, "ITS_API_KEY", "test-its-key"):
        yield


@pytest.mark.asyncio
async def test_ITS_키가_없으면_호출도_하지_않고_None이다():
    client = AsyncMock()
    client.get = AsyncMock()
    with patch.object(its.settings, "ITS_API_KEY", ""), \
         patch.object(its, "get_http_client", AsyncMock(return_value=client)):
        assert await its.fetch_incidents() is None
    client.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_data_go_kr_키를_보내지_않는다(its_key):
    """ITS 는 키 체계가 달라 공유 키를 보내면 4005 가 온다 — 전용 키만 실려야 한다."""
    resp = _FakeResp(json_data=_payload([_item()]))
    client = _client_with(resp)
    with patch.object(its, "get_http_client", AsyncMock(return_value=client)):
        await its.fetch_incidents()
    assert client.get.await_args.kwargs["params"]["apiKey"] == "test-its-key"


@pytest.mark.asyncio
async def test_인증키_오류_resultCode면_빈_목록이_아니라_None이다(its_key):
    """4005 를 빈 목록으로 취급하면 '돌발 없음'과 구분되지 않아 기능이 조용히 죽는다."""
    resp = _FakeResp(json_data={
        "header": {"resultCode": 4005, "resultMsg": "존재하지 않는 인증키입니다."},
        "body": "",
    })
    with patch.object(its, "get_http_client", AsyncMock(return_value=_client_with(resp))):
        assert await its.fetch_incidents() is None


@pytest.mark.asyncio
async def test_활용신청_미승인_Forbidden_텍스트면_None으로_조용히_저하된다(its_key):
    resp = _FakeResp(text="Forbidden", content_type="text/html")
    with patch.object(its, "get_http_client", AsyncMock(return_value=_client_with(resp))):
        assert await its.fetch_incidents() is None


@pytest.mark.asyncio
async def test_네트워크_예외도_None이다(its_key):
    client = AsyncMock()
    client.get = AsyncMock(side_effect=RuntimeError("timeout"))
    with patch.object(its, "get_http_client", AsyncMock(return_value=client)):
        assert await its.fetch_incidents() is None


@pytest.mark.asyncio
async def test_정상_JSON이면_파싱_결과를_돌려준다(its_key):
    resp = _FakeResp(json_data=_payload([_item()]))
    with patch.object(its, "get_http_client", AsyncMock(return_value=_client_with(resp))):
        result = await its.fetch_incidents()
    assert result is not None
    assert result[0]["type"] == "accident"


def test_정상_resultCode는_통과시킨다():
    assert its.result_code_ok({"header": {"resultCode": 0}, "body": {}}) is True
    assert its.result_code_ok({"header": {"resultCode": "00"}, "body": {}}) is True
    assert its.result_code_ok({"body": {}}) is True  # 헤더 없는 형태는 body 파싱에 맡긴다
    assert its.result_code_ok({"header": {"resultCode": 4005}}) is False


# ── 서비스: cache-aside TTL (positive 1200 / negative 600) ───

_INCIDENT = {
    "type": "accident",
    "road_name": "서해안로",
    "message": "추돌사고",
    "occurred_at": "2026-08-03T14:05:00+09:00",
}


@pytest.mark.asyncio
async def test_결과가_있으면_20분_TTL로_캐시된다(fake_redis):
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(svc, "fetch_incidents", AsyncMock(return_value=[_INCIDENT])):
        result = await svc.get_incidents()

    assert result == [_INCIDENT]
    assert await fake_redis.ttl(svc.INCIDENTS_CACHE_KEY) == svc.INCIDENTS_CACHE_TTL


@pytest.mark.asyncio
async def test_빈_결과도_짧게_음성_캐시된다(fake_redis):
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(svc, "fetch_incidents", AsyncMock(return_value=[])):
        result = await svc.get_incidents()

    assert result == []
    assert await fake_redis.ttl(svc.INCIDENTS_CACHE_KEY) == svc.INCIDENTS_CACHE_TTL_EMPTY


@pytest.mark.asyncio
async def test_어댑터_저하_None도_빈_목록으로_음성_캐시된다(fake_redis):
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(svc, "fetch_incidents", AsyncMock(return_value=None)):
        result = await svc.get_incidents()

    assert result == []
    assert await fake_redis.ttl(svc.INCIDENTS_CACHE_KEY) == svc.INCIDENTS_CACHE_TTL_EMPTY


@pytest.mark.asyncio
async def test_캐시_히트면_외부_호출이_없다(fake_redis):
    fetch_mock = AsyncMock(return_value=[_INCIDENT])
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(svc, "fetch_incidents", fetch_mock):
        await svc.get_incidents()
        second = await svc.get_incidents()

    assert fetch_mock.await_count == 1
    assert second == [_INCIDENT]


# ── 엔드포인트: ApiResponse 봉투 + HTTP 캐시 헤더 ─────────────


@pytest.mark.asyncio
async def test_incidents_엔드포인트는_봉투와_5분_max_age를_지킨다(fake_redis):
    response = Response()
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(svc, "fetch_incidents", AsyncMock(return_value=[_INCIDENT])):
        result = await traffic_api.traffic_incidents(
            request=_make_request(), response=response,
        )

    assert result.success is True
    # ApiResponse[list[TrafficIncident]]가 dict를 모델로 검증·코싱한다
    assert [item.model_dump() for item in result.data] == [_INCIDENT]
    assert "max-age=300" in response.headers["Cache-Control"]


@pytest.mark.asyncio
async def test_incidents_엔드포인트는_저하_시_빈_목록이다(fake_redis):
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(svc, "fetch_incidents", AsyncMock(return_value=None)):
        result = await traffic_api.traffic_incidents(
            request=_make_request(), response=Response(),
        )

    assert result.success is True
    assert result.data == []
