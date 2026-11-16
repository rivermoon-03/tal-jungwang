"""공유 httpx.AsyncClient — TCP 커넥션 풀 재사용으로 외부 API 레이턴시 절감."""
import httpx

from app.core.config import settings

_client: httpx.AsyncClient | None = None

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)  # connect 5s, read/write 10s
_LIMITS = httpx.Limits(max_connections=20, max_keepalive_connections=10)


def _proxy_mounts(proxy_url: str) -> dict[str, httpx.AsyncHTTPTransport] | None:
    """data.go.kr 요청만 한국 출구 프록시로 보낸다. 다른 외부 API 는 직접 나간다."""
    if not proxy_url:
        return None
    return {"https://apis.data.go.kr": httpx.AsyncHTTPTransport(proxy=proxy_url, limits=_LIMITS)}


async def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=_TIMEOUT, limits=_LIMITS, mounts=_proxy_mounts(settings.DATA_GO_KR_PROXY))
    return _client


async def close_http_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
