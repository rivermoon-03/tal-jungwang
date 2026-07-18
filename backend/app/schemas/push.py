from pydantic import BaseModel


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys
    favorite_codes: list[str] = []


class PushFavoritesUpdateRequest(BaseModel):
    endpoint: str
    favorite_codes: list[str] = []


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class VapidPublicKeyResponse(BaseModel):
    public_key: str
