"""push 라우터 계약 테스트 — API 응답 shape이 프론트와 합의한 계약과 정확히 일치하는지.

프론트 공용 apiFetch(frontend/src/hooks/useApi.js)는 모든 응답이 {success, data}
shape이라고 가정하므로(success 없으면 예외), vapid-public-key를 포함한 모든
엔드포인트가 ApiResponse로 감싼 응답을 반환해야 한다. 나머지 엔드포인트는 서비스
함수를 mock으로 대체해 라우팅/상태 코드만 검증한다.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import get_db
from app.main import app


@pytest.fixture
def client():
    async def _fake_get_db():
        yield MagicMock()

    # 의도적으로 `with TestClient(app) as c:` (컨텍스트매니저)를 쓰지 않는다 —
    # 그러면 lifespan(startup)이 실행되어 스케줄러/초기 캐시 워밍이 실제 DB·Redis·
    # 외부 API에 접근을 시도한다. 라우팅 계약만 검증하는 이 테스트에서는 불필요하므로
    # startup 이벤트 없이 순수 요청/응답만 확인한다.
    app.dependency_overrides[get_db] = _fake_get_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


def test_vapid_public_key_shape_is_wrapped_in_api_response(client):
    with patch.object(settings, "VAPID_PUBLIC_KEY", "test-public-key"):
        resp = client.get("/api/v1/push/vapid-public-key")

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"] == {"public_key": "test-public-key"}


def test_subscribe_upserts_and_returns_ok(client):
    fake_sub = MagicMock(endpoint="https://ep/1", favorite_codes=["등교:5602"])
    with patch(
        "app.api.push.upsert_subscription", new=AsyncMock(return_value=fake_sub)
    ) as mock_upsert:
        resp = client.post(
            "/api/v1/push/subscribe",
            json={
                "endpoint": "https://ep/1",
                "keys": {"p256dh": "p", "auth": "a"},
                "favorite_codes": ["등교:5602"],
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["endpoint"] == "https://ep/1"
    mock_upsert.assert_awaited_once()


def test_update_favorites_404_when_missing(client):
    with patch("app.api.push.update_favorites", new=AsyncMock(return_value=None)):
        resp = client.put(
            "/api/v1/push/subscriptions/favorites",
            json={"endpoint": "https://ep/none", "favorite_codes": []},
        )

    assert resp.status_code == 404


def test_update_favorites_ok_when_found(client):
    fake_sub = MagicMock(endpoint="https://ep/1", favorite_codes=["shuttle:등교"])
    with patch("app.api.push.update_favorites", new=AsyncMock(return_value=fake_sub)):
        resp = client.put(
            "/api/v1/push/subscriptions/favorites",
            json={"endpoint": "https://ep/1", "favorite_codes": ["shuttle:등교"]},
        )

    assert resp.status_code == 200
    assert resp.json()["data"]["favorite_codes"] == ["shuttle:등교"]


def test_unsubscribe_is_idempotent_200(client):
    with patch("app.api.push.delete_subscription", new=AsyncMock(return_value=None)) as mock_del:
        resp = client.request(
            "DELETE", "/api/v1/push/subscribe", json={"endpoint": "https://ep/not-exist"}
        )

    assert resp.status_code == 200
    mock_del.assert_awaited_once()
