from unittest.mock import AsyncMock, patch

import fakeredis
import pytest

from app.services import bus_monitor, gbis_quota
from app.services.gbis_quota import alert_level, check_quota


@pytest.mark.parametrize(
    ("remaining", "level"),
    [(9889, None), (1001, None), (1000, 1000), (950, 1000), (900, 900), (899, 900), (101, 200), (100, 100), (1, 100), (0, 0), (None, None)],
)
def test_alert_level(remaining, level):
    assert alert_level(remaining) == level


@pytest.mark.anyio
async def test_alerts_once_per_step():
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    post = AsyncMock()
    with patch.object(gbis_quota, "get_redis", AsyncMock(return_value=fake)), patch.object(bus_monitor, "_post", post):
        for remaining in (1500, 1000, 990, 950, 900, 899, 850):
            await check_quota({"X-RateLimit-Remaining": str(remaining), "X-RateLimit-Limit": "10000"}, "arrival")
    sent = [c.args[0] for c in post.await_args_list]
    assert len(sent) == 2
    assert "남은 1000회" in sent[0] and "한도 10000회" in sent[0]
    assert "남은 900회" in sent[1]


@pytest.mark.anyio
async def test_missing_header_and_redis_errors_are_ignored():
    with patch.object(gbis_quota, "get_redis", AsyncMock(side_effect=ConnectionError("down"))):
        await check_quota({}, "arrival")
        await check_quota({"X-RateLimit-Remaining": "500"}, "arrival")
