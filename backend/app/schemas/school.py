from datetime import date, datetime

from pydantic import BaseModel


class DepartmentOut(BaseModel):
    code: str
    label: str
    supported: bool = True
    unsupported_reason: str | None = None


class DepartmentNoticeOut(BaseModel):
    id: int
    title: str
    url: str
    published_at: datetime

    model_config = {"from_attributes": True}


class CalendarEventOut(BaseModel):
    title: str
    start_date: date
    end_date: date | None

    model_config = {"from_attributes": True}


class CalendarOut(BaseModel):
    next: CalendarEventOut | None
    upcoming: list[CalendarEventOut]
