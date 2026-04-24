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
