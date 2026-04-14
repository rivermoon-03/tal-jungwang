from pydantic import BaseModel


class ShuttleTime(BaseModel):
    depart_at: str  # "HH:MM"
    note: str | None = None


class ShuttleDirection(BaseModel):
    direction: int  # 0=등교, 1=하교
    times: list[ShuttleTime]


class ShuttleScheduleResponse(BaseModel):
    schedule_type: str
    schedule_name: str
    valid_from: str  # "YYYY-MM-DD"
    valid_until: str  # "YYYY-MM-DD"
    directions: list[ShuttleDirection]


class ShuttleNextResponse(BaseModel):
    direction: int  # 0=등교, 1=하교
    depart_at: str  # "HH:MM:SS"
    arrive_in_seconds: int
    is_last: bool
    note: str | None = None
