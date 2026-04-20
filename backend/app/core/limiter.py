import os

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _client_ip(request: Request) -> str:
    # 프로덕션(nginx/Railway edge 뒤)에서만 프록시 헤더를 신뢰한다.
    # 개발 환경에서 신뢰하면 X-Forwarded-For 스푸핑으로 rate limit 우회 가능.
    if os.environ.get("ENVIRONMENT") == "production":
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
