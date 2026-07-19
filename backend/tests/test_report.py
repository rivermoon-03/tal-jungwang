"""제보 라우터/서비스 테스트.

app.main.app에는 report 라우터가 아직 등록되어 있지 않으므로(라우터 등록은
다른 소유 파일인 app/main.py의 몫), 여기서는 report 라우터만 부착한 독립
FastAPI 앱을 구성해 라우팅/유효성/rate limit 계약을 검증한다. slowapi는
app.state.limiter와 RateLimitExceeded 예외 핸들러가 있어야 429가 정상 동작하므로
app/main.py와 동일하게 부착한다.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.report import router as report_router
from app.core.config import settings
from app.core.limiter import limiter


@pytest.fixture
def client():
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.include_router(report_router)
    # 테스트 간 rate limit 카운터가 새지 않도록 매 테스트마다 리셋한다.
    limiter.reset()
    with TestClient(app) as c:
        yield c
    limiter.reset()


def _payload(**overrides):
    body = {
        "category": "route_error",
        "message": "3400번 버스가 정류장을 지나쳐요.",
        "contact": "010-0000-0000",
    }
    body.update(overrides)
    return body


def test_submit_report_success_sends_to_discord(client):
    with patch.object(settings, "DISCORD_ERROR_WEBHOOK_URL", "https://discord.example/webhook"), \
         patch("app.services.report.logger") as mock_logger:
        resp = client.post("/api/v1/report", json=_payload())

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["category"] == "route_error"
    assert body["data"]["delivered"] is True

    mock_logger.warning.assert_called_once()
    sent_content = mock_logger.warning.call_args[0][0]
    assert "노선 오류" in sent_content
    assert "3400번 버스가 정류장을 지나쳐요." in sent_content


def test_submit_report_without_discord_webhook_still_succeeds(client):
    with patch.object(settings, "DISCORD_ERROR_WEBHOOK_URL", ""):
        resp = client.post("/api/v1/report", json=_payload(category="shuttle_full"))

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["delivered"] is False


def test_empty_message_is_rejected(client):
    resp = client.post("/api/v1/report", json=_payload(message=""))
    assert resp.status_code == 422


def test_invalid_category_is_rejected(client):
    resp = client.post("/api/v1/report", json=_payload(category="not_a_real_category"))
    assert resp.status_code == 422


def test_rate_limit_exceeded_returns_429(client):
    for _ in range(3):
        resp = client.post("/api/v1/report", json=_payload())
        assert resp.status_code == 200

    resp = client.post("/api/v1/report", json=_payload())
    assert resp.status_code == 429
