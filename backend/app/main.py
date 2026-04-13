import ipaddress
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import admin, bus, dashboard, map, recommend, route, shuttle, subway, traffic
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.cache import close_redis
from app.core.config import settings
from app.core.limiter import limiter
from app.core.scheduler import start_scheduler, stop_scheduler


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
    start_scheduler()
    yield
    stop_scheduler()
    await close_redis()


app = FastAPI(
    title="정왕 교통 허브 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
app.include_router(dashboard.router)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")


@app.middleware("http")
async def restrict_metrics(request: Request, call_next):
    """내부 네트워크(Docker, localhost)에서만 /metrics 접근 허용."""
    if request.url.path == "/metrics":
        client_host = request.client.host if request.client else ""
        if not _is_private(client_host):
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
