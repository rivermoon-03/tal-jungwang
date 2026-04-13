import re
from typing import Literal

from pydantic import BaseModel, field_validator

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _validate_date(v: str | None) -> str | None:
    if v is None:
        return v
    if not _DATE_RE.match(v):
        raise ValueError("날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    # fromisoformat으로 실제 날짜 유효성 검증
    from datetime import date
    try:
        date.fromisoformat(v)
    except ValueError:
        raise ValueError(f"유효하지 않은 날짜: {v}")
    return v


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ScheduleCreate(BaseModel):
    type: str
    name: str
    valid_from: str  # "YYYY-MM-DD"
    valid_until: str  # "YYYY-MM-DD"
    priority: int = 0
    notice_message: str | None = None

    @field_validator("valid_from", "valid_until")
    @classmethod
    def validate_date(cls, v: str) -> str:
        return _validate_date(v)  # type: ignore[return-value]


class ScheduleUpdate(BaseModel):
    type: str | None = None
    name: str | None = None
    valid_from: str | None = None
    valid_until: str | None = None
    priority: int | None = None
    notice_message: str | None = None

    @field_validator("valid_from", "valid_until")
    @classmethod
    def validate_date(cls, v: str | None) -> str | None:
        return _validate_date(v)


class ScheduleResponse(BaseModel):
    id: int
    type: str
    name: str
    valid_from: str
    valid_until: str
    priority: int
    notice_message: str | None = None


DayType = Literal["weekday", "saturday", "sunday"]


class TimetableUpload(BaseModel):
    direction: str
    day_type: DayType = "weekday"
    times: list[dict]  # [{"depart_at": "HH:MM", "note": null}, ...]
