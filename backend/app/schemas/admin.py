import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

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

_TIME_RE = re.compile(r"^\d{2}:\d{2}$")


class TimeEntry(BaseModel):
    depart_at: str
    note: str | None = None

    @field_validator("depart_at")
    @classmethod
    def validate_time(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError("시간 형식은 HH:MM 이어야 합니다.")
        h, m = int(v[:2]), int(v[3:])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("유효하지 않은 시간 값입니다.")
        return v


class TimetableUpload(BaseModel):
    direction: str
    day_type: DayType = "weekday"
    times: list[TimeEntry] = Field(..., max_length=200)


# ── Bus Admin ────────────────────────────────────────────────
# AI/스크립트에서도 사용 가능하도록 명확한 필드명과 검증을 유지한다.


class BusRouteCreate(BaseModel):
    route_number: str = Field(..., min_length=1, max_length=20, description="노선 번호. 예: '3400', '시흥33'")
    route_name: str | None = Field(None, max_length=100, description="노선 설명")
    direction_name: str | None = Field(None, max_length=50, description="방향 이름. 예: '강남→시화'")
    is_realtime: bool = Field(False, description="True=GBIS 실시간, False=시간표 기반")
    gbis_route_id: str | None = Field(None, max_length=20, description="GBIS 노선 ID (실시간일 때 필수)")


class BusRouteUpdate(BaseModel):
    route_number: str | None = Field(None, min_length=1, max_length=20)
    route_name: str | None = None
    direction_name: str | None = None
    is_realtime: bool | None = None
    gbis_route_id: str | None = None


class BusRouteOut(BaseModel):
    id: int
    route_number: str
    route_name: str | None
    direction_name: str | None
    is_realtime: bool
    gbis_route_id: str | None
    stop_count: int = 0
    timetable_count: int = 0

    model_config = {"from_attributes": True}


class BusStopCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    gbis_station_id: str | None = Field(None, max_length=20)
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class BusStopUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    gbis_station_id: str | None = None
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)


class BusStopOut(BaseModel):
    id: int
    name: str
    gbis_station_id: str | None
    lat: float
    lng: float

    model_config = {"from_attributes": True}


class BusStopRouteCreate(BaseModel):
    bus_stop_id: int
    bus_route_id: int


class BusTimetableEntryIn(BaseModel):
    stop_id: int | None = None
    stop_name: str | None = None
    day_type: DayType
    times: list[str] = Field(..., min_length=1, max_length=300, description="HH:MM 문자열 배열")
    note: str | None = Field(None, max_length=100)

    @field_validator("times")
    @classmethod
    def validate_times(cls, v: list[str]) -> list[str]:
        for t in v:
            if not _TIME_RE.match(t):
                raise ValueError(f"시간 형식은 HH:MM 이어야 합니다: '{t}'")
            h, m = int(t[:2]), int(t[3:])
            if not (0 <= h <= 23 and 0 <= m <= 59):
                raise ValueError(f"유효하지 않은 시간 값: '{t}'")
        return v


class BusTimetableUpload(BaseModel):
    mode: Literal["replace", "append"] = Field(
        "replace",
        description="replace=해당 (stop,day_type) 항목 전부 교체 / append=추가만",
    )
    entries: list[BusTimetableEntryIn] = Field(..., min_length=1, max_length=50)


class BusTimetableEntryOut(BaseModel):
    id: int
    route_id: int
    stop_id: int
    stop_name: str
    day_type: DayType
    departure_time: str  # HH:MM
    note: str | None = None
