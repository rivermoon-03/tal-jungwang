import ipaddress
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import admin, bus, dashboard, map, more, recommend, route, shuttle, subway, traffic, weather
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.cache import close_redis
from app.core.config import settings
from app.core.discord_logging import install_discord_logging
from app.core.http_client import close_http_client
from app.core.limiter import limiter
from app.core.scheduler import start_scheduler, stop_scheduler

install_discord_logging(settings.DISCORD_ERROR_WEBHOOK_URL)


# ── 내부 네트워크 판별 ─────────────────────────────────────────────────────

_PRIVATE_NETS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
]

def _is_private(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        if addr.version == 6 and addr == ipaddress.ip_address("::1"):
            return True
        return any(addr in net for net in _PRIVATE_NETS)
    except ValueError:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from app.services.bus_collector import poll_and_collect
    from app.services.map_markers import get_markers
    from app.services.shuttle import get_schedule
    from app.services.subway import needs_refresh, refresh_timetable
    from app.services.weather import refresh_weather_cache
    from app.core.database import AsyncSessionLocal
    from datetime import date

    start_scheduler()

    async def _initial_tasks():
        await asyncio.sleep(3)  # DB/Redis 연결 안정화 대기

        try:
            await refresh_weather_cache()
            logger.info("초기 날씨 캐시 로드 완료")
        except Exception:
            logger.exception("초기 날씨 캐시 로드 실패")

        try:
            await poll_and_collect()
            logger.info("초기 버스 폴링 완료")
        except Exception:
            logger.exception("초기 버스 폴링 실패")

        try:
            async with AsyncSessionLocal() as db:
                if await needs_refresh(db):
                    total = await refresh_timetable(db)
                    logger.info("초기 지하철 시간표 로드 완료: %d건", total)
                else:
                    logger.info("지하철 시간표 이미 존재 — 초기 로드 생략")
        except Exception:
            logger.exception("초기 지하철 시간표 로드 실패")

        # 셔틀·마커 캐시 워밍업 (cache-aside 항목, 첫 사용자 cold miss 방지)
        try:
            async with AsyncSessionLocal() as db:
                await get_schedule(db, date.today(), None)
                logger.info("초기 셔틀 시간표 캐시 완료")
        except Exception:
            logger.exception("초기 셔틀 캐시 로드 실패")

        try:
            async with AsyncSessionLocal() as db:
                await get_markers(db)
                logger.info("초기 지도 마커 캐시 완료")
        except Exception:
            logger.exception("초기 마커 캐시 로드 실패")

    asyncio.create_task(_initial_tasks())

    yield
    stop_scheduler()
    await close_redis()
    await close_http_client()


app = FastAPI(
    title="정왕 교통 허브 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(shuttle.router)
app.include_router(subway.router)
app.include_router(bus.router)
app.include_router(map.router)
app.include_router(route.router)
app.include_router(recommend.router)
app.include_router(admin.router)
app.include_router(traffic.router)
app.include_router(more.router)
app.include_router(dashboard.router)
app.include_router(weather.router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.middleware("http")
async def restrict_metrics(request: Request, call_next):
    """/metrics 접근 제어: 내부 네트워크 또는 유효한 Bearer 토큰만 허용."""
    if request.url.path == "/metrics":
        client_host = request.client.host if request.client else ""
        if not _is_private(client_host):
            token = settings.METRICS_TOKEN
            auth = request.headers.get("Authorization", "")
            if not token or auth != f"Bearer {token}":
                return Response(status_code=404)
    return await call_next(request)


@app.get("/health", tags=["health"])
async def health():
    from app.core.cache import get_redis
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text

    checks: dict[str, str] = {}

    try:
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception:
        checks["db"] = "error"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, **checks}
