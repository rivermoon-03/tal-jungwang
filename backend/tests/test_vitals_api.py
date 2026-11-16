import httpx
import pytest

from app.main import app


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_vitals_sample_is_exposed_on_metrics(client):
    res = await client.post("/api/v1/vitals", json={"name": "LCP", "value": 1234, "page": "home"})
    assert res.status_code == 200
    assert res.json()["success"] is True

    metrics = (await client.get("/metrics")).text
    assert 'tj_web_vitals_ms_count{name="LCP",page="home"}' in metrics


@pytest.mark.anyio
async def test_vitals_rejects_unknown_labels(client):
    res = await client.post("/api/v1/vitals", json={"name": "LCP", "value": 10, "page": "anything"})
    assert res.status_code == 422
    res = await client.post("/api/v1/vitals", json={"name": "FID", "value": 10})
    assert res.status_code == 422
