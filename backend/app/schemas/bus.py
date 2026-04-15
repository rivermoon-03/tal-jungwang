from pydantic import BaseModel


class BusStationRoute(BaseModel):
    route_number: str
    route_name: str | None = None
    is_realtime: bool


class BusStationResponse(BaseModel):
    station_id: int
    name: str
    sub_name: str | None = None
    lat: float
    lng: float
    routes: list[BusStationRoute]


class BusRouteStop(BaseModel):
    stop_id: int
    name: str
    sub_name: str | None = None


class BusRouteSummary(BaseModel):
    route_id: int
    route_number: str
    route_name: str | None = None
    direction_name: str | None = None
    category: str | None = None
    is_realtime: bool
    gbis_route_id: str | None = None
    stops: list[BusRouteStop] = []


class BusArrival(BaseModel):
    route_id: int
    route_no: str
    destination: str | None = None
    arrival_type: str  # "realtime" | "timetable"
    depart_at: str | None = None  # "HH:MM" (timetable)
    arrive_in_seconds: int | None = None
    is_tomorrow: bool = False  # 오늘 시간표 소진 후 내일 첫차인 경우 True


class BusArrivalsResponse(BaseModel):
    station_id: int
    station_name: str
    updated_at: str
    arrivals: list[BusArrival]


class BusTimetableResponse(BaseModel):
    route_id: int
    route_name: str
    schedule_type: str  # "weekday" | "saturday" | "sunday"
    stop_id: int | None = None
    stop_name: str | None = None
    times: list[str]  # ["07:00", "07:30", ...]
    notes: list[str | None] = []
