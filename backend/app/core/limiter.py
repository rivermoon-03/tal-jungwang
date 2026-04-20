from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _client_ip(request: Request) -> str:
    # backend는 nginx/Railway edge 뒤에만 노출되므로 프록시 헤더를 신뢰한다.
    # 이게 없으면 모든 사용자가 프록시 IP 하나로 묶여 rate limit 공유됨.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",", 1)[0].strip()
        if first:
            return first
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip)
