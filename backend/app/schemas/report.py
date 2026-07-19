from typing import Literal

from pydantic import BaseModel, Field

ReportCategory = Literal["route_error", "shuttle_full", "timetable_change", "other"]


class ReportCreate(BaseModel):
    category: ReportCategory
    message: str = Field(..., min_length=1, max_length=500)
    contact: str | None = Field(None, max_length=100)


class ReportOut(BaseModel):
    category: ReportCategory
    delivered: bool
