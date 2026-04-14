from datetime import datetime
from pydantic import BaseModel


class NoticeOut(BaseModel):
    id: int
    title: str
    content: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NoticeCreate(BaseModel):
    title: str
    content: str | None = None
    is_active: bool = True


class NoticeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_active: bool | None = None


class AppLinkOut(BaseModel):
    id: int
    icon: str
    label: str
    url: str
    sort_order: int

    model_config = {"from_attributes": True}


class AppLinkCreate(BaseModel):
    icon: str
    label: str
    url: str
    sort_order: int = 0
    is_active: bool = True


class AppLinkUpdate(BaseModel):
    icon: str | None = None
    label: str | None = None
    url: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class AppInfoOut(BaseModel):
    version: str
    description: str | None
    feedback_url: str | None

    model_config = {"from_attributes": True}


class AppInfoUpdate(BaseModel):
    version: str | None = None
    description: str | None = None
    feedback_url: str | None = None
