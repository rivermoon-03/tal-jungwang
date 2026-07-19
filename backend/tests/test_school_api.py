"""school 라우터 계약 테스트 — ApiResponse shape, 잘못된 department의 400 처리.

요청 경로가 외부 사이트/DB를 실제로 건드리지 않도록 서비스 함수를 patch한다.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.main import app


@pytest.fixture
def client():
    async def _fake_get_db():
        yield MagicMock()

    # lifespan(startup)을 실행하지 않는다 — 스케줄러/초기 캐시 워밍이 실제
    # DB·Redis·외부 API에 접근하는 걸 막기 위해 컨텍스트매니저 없이 사용.
    app.dependency_overrides[get_db] = _fake_get_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


def test_departments_returns_registry(client):
    resp = client.get("/api/v1/school/departments")

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    data = body["data"]

    by_code = {d["code"]: d for d in data}
    assert by_code["ce"] == {"code": "ce", "label": "컴퓨터공학부", "supported": True}

    others = [d for code, d in by_code.items() if code != "ce"]
    assert len(others) > 0
    for d in others:
        assert d["supported"] is False
        assert isinstance(d["unsupported_reason"], str) and d["unsupported_reason"]


def test_notices_unsupported_but_known_department_returns_400(client):
    """ce 외 학과는 드롭다운엔 노출되지만 아직 미지원 — notices는 400이어야 한다."""
    resp = client.get("/api/v1/school/notices", params={"department": "ee"})

    assert resp.status_code == 400
    assert isinstance(resp.json().get("detail"), str)


def test_notices_valid_department_returns_ok(client):
    fake_notices = [
        {
            "id": 151703,
            "title": "제목",
            "url": "https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do",
            "published_at": "2026-07-16T00:00:00+09:00",
        }
    ]
    with patch("app.api.school.get_notices", new=AsyncMock(return_value=fake_notices)):
        resp = client.get("/api/v1/school/notices", params={"department": "ce"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"] == fake_notices


def test_notices_invalid_department_returns_400_not_empty_list(client):
    """빈 배열이 아니라 명확한 400 에러여야 한다(요구사항 명시)."""
    resp = client.get("/api/v1/school/notices", params={"department": "unknown"})

    assert resp.status_code == 400
    assert resp.json() != []
    assert isinstance(resp.json().get("detail"), str)


def test_notices_requires_department_query_param(client):
    resp = client.get("/api/v1/school/notices")
    assert resp.status_code == 422  # FastAPI 필수 쿼리 파라미터 누락


def test_calendar_returns_wrapped_shape(client):
    fake_calendar = {
        "next": {"title": "기말고사", "start_date": "2026-06-09", "end_date": "2026-06-22"},
        "upcoming": [
            {"title": "하계방학 시작", "start_date": "2026-06-23", "end_date": "2026-06-23"},
        ],
    }
    with patch("app.api.school.get_calendar", new=AsyncMock(return_value=fake_calendar)):
        resp = client.get("/api/v1/school/calendar")

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"] == fake_calendar
    # §CLAUDE.md 규칙: {data} 한 겹이어야 한다 — data.data처럼 두 겹으로 감기면 안 됨.
    assert "data" not in body["data"]


def test_calendar_no_upcoming_events_shape(client):
    with patch(
        "app.api.school.get_calendar",
        new=AsyncMock(return_value={"next": None, "upcoming": []}),
    ):
        resp = client.get("/api/v1/school/calendar")

    assert resp.status_code == 200
    assert resp.json()["data"] == {"next": None, "upcoming": []}
