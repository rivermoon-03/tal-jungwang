from pydantic import BaseModel, Field


class ShuttleTime(BaseModel):
    depart_at: str  # "HH:MM"
    note: str | None = None
    variant: str | None = None  # seasonal(계절학기) | reduced(단축근무) | normal(정상근무) | None=공통


class ShuttleDirection(BaseModel):
    direction: int  # 0=본교 등교, 1=본교 하교, 2=제2 등교, 3=제2 하교
    times: list[ShuttleTime]


class ShuttleScheduleResponse(BaseModel):
    schedule_type: str
    schedule_name: str
    valid_from: str  # "YYYY-MM-DD"
    valid_until: str  # "YYYY-MM-DD"
    is_holiday: bool = Field(default=False)
    holiday_name: str | None = Field(default=None)
    directions: list[ShuttleDirection]


class ShuttlePeriodItem(BaseModel):
    id: int
    period_type: str  # SEMESTER | VACATION | EXAM | HOLIDAY | SUSPENDED | SEASONAL
    name: str
    start_date: str  # "YYYY-MM-DD"
    end_date: str  # "YYYY-MM-DD"
    priority: int
    notice_message: str | None = None


class ShuttlePeriodsResponse(BaseModel):
    periods: list[ShuttlePeriodItem]


class ShuttleNextResponse(BaseModel):
    direction: int  # 0=본교 등교, 1=본교 하교, 2=제2 등교, 3=제2 하교
    depart_at: str  # "HH:MM:SS"
    arrive_in_seconds: int
    is_last: bool
    note: str | None = None
    next_depart_at: str | None = None  # "HH:MM:SS" — 다음 다음 셔틀
    next_arrive_in_seconds: int | None = None
