from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.core.database import get_db
from app.main import app


@pytest.fixture
async def client():
    async def _fake_get_db():
        yield MagicMock()

    app.dependency_overrides[get_db] = _fake_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_commute_context_api_keeps_3400_source_stations_separate(client):
    contexts = [
        {
            "id": 1,
            "route_id": 1,
            "route_number": "3400",
            "category": "하교",
            "group_key": "to-seoul",
            "origin_label": "시흥터미널",
            "destination_label": "강남역",
            "journey_labels": ["시흥터미널", "이마트", "강남역"],
            "sources": [
                {
                    "id": 1,
                    "type": "timetable",
                    "role": "departure",
                    "stop_id": 17,
                    "station_label": "한국공학대학교 시흥터미널",
                    "display_label": "시흥터미널 출발",
                    "travel_direction": "to-seoul",
                },
                {
                    "id": 2,
                    "type": "realtime",
                    "role": "boarding_arrival",
                    "stop_id": 2,
                    "station_label": "이마트",
                    "display_label": "이마트 도착",
                    "travel_direction": "to-seoul",
                },
            ],
        }
    ]

    with patch("app.api.bus.get_commute_contexts", new=AsyncMock(return_value=contexts), create=True):
        response = await client.get(
            "/api/v1/bus/commute-contexts",
            params={"category": "하교", "group": "to-seoul"},
        )

    assert response.status_code == 200
    data = response.json()["data"]
    assert [(source["type"], source["stop_id"]) for source in data[0]["sources"]] == [
        ("timetable", 17),
        ("realtime", 2),
    ]


@pytest.mark.anyio
async def test_commute_context_api_rejects_unknown_group(client):
    response = await client.get(
        "/api/v1/bus/commute-contexts",
        params={"category": "하교", "group": "unknown"},
    )

    assert response.status_code == 422


@pytest.mark.anyio
async def test_commute_context_api_accepts_wolgot_direction(client):
    with patch("app.api.bus.get_commute_contexts", new=AsyncMock(return_value=[]), create=True) as get_contexts:
        response = await client.get(
            "/api/v1/bus/commute-contexts",
            params={"category": "하교", "group": "to-wolgot"},
        )

    assert response.status_code == 200
    get_contexts.assert_awaited_once()
    assert get_contexts.await_args.kwargs == {"category": "하교", "group_key": "to-wolgot"}
