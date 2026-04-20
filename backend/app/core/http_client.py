"""공유 httpx.AsyncClient — TCP 커넥션 풀 재사용으로 외부 API 레이턴시 절감."""
import httpx

_client: httpx.AsyncClient | None = None

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)  # connect 5s, read/write 10s
_LIMITS = httpx.Limits(max_connections=20, max_keepalive_connections=10)


async def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=_TIMEOUT, limits=_LIMITS)
    return _client


async def close_http_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
