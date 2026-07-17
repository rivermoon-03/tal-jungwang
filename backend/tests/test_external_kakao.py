import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_fetch_driving_route_extracts_taxi_fee():
    mock_response_data = {
        "routes": [
            {
                "result_code": 0,
                "summary": {
                    "duration": 600,
                    "distance": 5000,
                    "fare": {"toll": 0, "taxi": 7500},
                },
                "sections": [],
            }
        ],
    }
    mock_resp = MagicMock()
    mock_resp.json = MagicMock(return_value=mock_response_data)
    mock_resp.raise_for_status = MagicMock(return_value=None)

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    async def _get_client():
        return mock_client

    with patch("app.services.external.kakao.get_http_client", side_effect=_get_client):
        from app.services.external.kakao import fetch_driving_route

        result = await fetch_driving_route(origin_x=1, origin_y=2, dest_x=3, dest_y=4)
        assert result["taxi_fee"] == 7500
        assert result["toll_fee"] == 0
        assert result["duration_seconds"] == 600
        assert result["distance_meters"] == 5000


@pytest.mark.asyncio
async def test_fetch_driving_route_empty_routes_defaults_taxi_fee_zero():
    mock_resp = MagicMock()
    mock_resp.json = MagicMock(return_value={"routes": []})
    mock_resp.raise_for_status = MagicMock(return_value=None)

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    async def _get_client():
        return mock_client

    with patch("app.services.external.kakao.get_http_client", side_effect=_get_client):
        from app.services.external.kakao import fetch_driving_route

        result = await fetch_driving_route(origin_x=1, origin_y=2, dest_x=3, dest_y=4)
        assert result["taxi_fee"] == 0
        assert result["toll_fee"] == 0


@pytest.mark.asyncio
async def test_fetch_driving_route_http_status_error_raises_kakao_api_error():
    """카카오 API가 4xx/5xx를 반환하면 KakaoApiError로 감싸져야 한다(raw httpx 예외 노출 금지)."""
    mock_request = MagicMock()
    mock_response = MagicMock(status_code=500)
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(
        side_effect=httpx.HTTPStatusError("500 Internal Server Error", request=mock_request, response=mock_response)
    )

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    async def _get_client():
        return mock_client

    with patch("app.services.external.kakao.get_http_client", side_effect=_get_client):
        from app.services.external.kakao import KakaoApiError, fetch_driving_route

        with pytest.raises(KakaoApiError):
            await fetch_driving_route(origin_x=1, origin_y=2, dest_x=3, dest_y=4)


@pytest.mark.asyncio
async def test_fetch_driving_route_timeout_raises_kakao_api_error():
    """타임아웃도 KakaoApiError 하나로 통일되어야 호출부가 단일 타입만 캐치하면 된다."""
    mock_client = MagicMock()
    mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("connect timeout"))

    async def _get_client():
        return mock_client

    with patch("app.services.external.kakao.get_http_client", side_effect=_get_client):
        from app.services.external.kakao import KakaoApiError, fetch_driving_route

        with pytest.raises(KakaoApiError):
            await fetch_driving_route(origin_x=1, origin_y=2, dest_x=3, dest_y=4)


@pytest.mark.asyncio
async def test_fetch_driving_route_invalid_json_raises_kakao_api_error():
    """200 응답이지만 JSON 파싱이 실패하는 경우도 KakaoApiError로 감싸져야 한다."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock(return_value=None)
    mock_resp.json = MagicMock(side_effect=ValueError("Expecting value: line 1 column 1 (char 0)"))

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    async def _get_client():
        return mock_client

    with patch("app.services.external.kakao.get_http_client", side_effect=_get_client):
        from app.services.external.kakao import KakaoApiError, fetch_driving_route

        with pytest.raises(KakaoApiError):
            await fetch_driving_route(origin_x=1, origin_y=2, dest_x=3, dest_y=4)
