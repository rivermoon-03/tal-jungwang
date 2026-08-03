from typing import Literal

from pydantic import BaseModel


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class LastTrainPreference(BaseModel):
    """정왕역 막차 알림(B1) 프리퍼런스. lead_min은 프론트 칩(15/30/60)과 동일한 화이트리스트."""

    enabled: bool = False
    lead_min: Literal[15, 30, 60] = 30


class PushPreferences(BaseModel):
    """구독별 알림 프리퍼런스. 새 알림 종류가 생기면 최상위 필드를 추가한다."""

    last_train: LastTrainPreference = LastTrainPreference()


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: PushKeys
    favorite_codes: list[str] = []
    # 구독 생성 시점에 프리퍼런스를 함께 넣을 수 있다(생략하면 기존 값 유지/빈 dict).
    preferences: PushPreferences | None = None


class PushFavoritesUpdateRequest(BaseModel):
    endpoint: str
    favorite_codes: list[str] = []


class PushPreferencesUpdateRequest(BaseModel):
    endpoint: str
    preferences: PushPreferences


class PushUnsubscribeRequest(BaseModel):
    endpoint: str


class VapidPublicKeyResponse(BaseModel):
    public_key: str
