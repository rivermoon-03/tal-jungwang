from typing import Literal

from pydantic import BaseModel, Field

# bus_full/bus_no_show: F6 실시간 신호 제보 — Discord 릴레이에 더해 Redis 카운터로
# 같은 정류장·노선 카드에 30분간 경고 뱃지를 띄운다.
ReportCategory = Literal[
    "route_error", "shuttle_full", "timetable_change", "other", "bus_full", "bus_no_show"
]


class ReportCreate(BaseModel):
    category: ReportCategory
    message: str = Field(..., min_length=1, max_length=500)
    contact: str | None = Field(None, max_length=100)
    # F6 신호 제보 컨텍스트(bus_full/bus_no_show일 때만 의미)
    route_no: str | None = Field(None, max_length=20)
    station_key: str | None = Field(None, max_length=40)  # gbis_station_id 등


class ReportOut(BaseModel):
    category: ReportCategory
    delivered: bool


class ActiveBusReport(BaseModel):
    route_no: str
    kind: Literal["bus_full", "bus_no_show"]
    count: int
    minutes_ago: int  # 마지막 제보 경과(분)
