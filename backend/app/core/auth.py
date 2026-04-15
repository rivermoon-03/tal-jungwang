"""공유 JWT 인증 유틸리티."""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

bearer = HTTPBearer()


def verify_token(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> str:
    try:
        payload = jwt.decode(
            cred.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return sub
