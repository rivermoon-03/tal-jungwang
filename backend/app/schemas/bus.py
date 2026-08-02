from datetime import datetime
from typing import Literal

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
    lat: float
    lng: float


class BusRouteSummary(BaseModel):
    route_id: int
    route_number: str
    route_name: str | None = None
    direction_name: str | None = None
    category: str | None = None
    is_realtime: bool
    gbis_route_id: str | None = None
    stops: list[BusRouteStop] = []


class BusInformationSourceResponse(BaseModel):
    id: int
    type: Literal["timetable", "realtime"]
    role: str
    stop_id: int
    station_label: str
    display_label: str
    travel_direction: str


class BusCommuteContextResponse(BaseModel):
    id: int
    route_id: int
    route_number: str
    category: str
    group_key: str
    origin_label: str
    destination_label: str
    journey_labels: list[str]
    sources: list[BusInformationSourceResponse]


class ArrivalStats(BaseModel):
    # 사전 집계(bus_arrival_stats) 풀 페이로드는 분위수·tolerance까지 모두 채운다.
    # ±2시간 윈도우 fallback(bus_arrival_history)은 mean_min + sample_size만 채우고
    # is_low_sample=True 플래그를 단다. 프론트는 is_low_sample로 표시 분기를 선택.
    tolerance_min: int | None = None
    p10_min: int | None = None
    p50_min: int | None = None
    p90_min: int | None = None
    mean_min: int
    sample_size: int
    is_low_sample: bool = False
    computed_at: datetime | None = None


class BusArrival(BaseModel):
    route_id: int
    route_no: str
    destination: str | None = None
    category: str | None = None  # "등교" | "하교" | "기타"
    travel_direction: str | None = None  # 명시적인 GBIS 관측 진행 방향
    arrival_type: str  # "realtime" | "timetable"
    depart_at: str | None = None  # "HH:MM" (timetable)
    arrive_in_seconds: int | None = None
    is_tomorrow: bool = False  # 오늘 시간표 소진 후 내일 첫차인 경우 True
    crowded: int = 0  # 혼잡도 (0=정보없음, 1=여유, 2=보통, 3=혼잡, 4=매우혼잡)
    # bus_crowding_calibrations 의 표시 하한이 crowded 를 올린 경우 true.
    # 관측값이 아니라는 뜻이므로 화면이 "경험 기준"으로 구분해 표기한다.
    crowded_estimated: bool = False
    avg_interval_minutes: int | None = None  # 현재 시각 ±120분 윈도우 평균 배차 간격(분)
    stats: ArrivalStats | None = None
    # 이 정류장에서의 승차 지점 문구(bus_information_sources 기준, source_role 정규화).
    # 프런트가 정류장별 노선 라벨을 상수로 복제하지 않게 한다. 행선지 라벨은 한 노선이
    # 여러 방면 그룹에 속할 수 있어(3401·5602) 정류장 단위로 확정되지 않으므로 내보내지 않는다.
    boarding_label: str | None = None  # 예: "시흥터미널 승차"


class BusExpectedRoute(BaseModel):
    """이 정류장이 취급하는 노선. 오늘 도착 정보가 없어도 목록 기준으로 쓴다."""

    route_id: int
    route_no: str
    category: str | None = None
    boarding_label: str | None = None


class BusArrivalsResponse(BaseModel):
    station_id: int
    station_name: str
    updated_at: str
    arrivals: list[BusArrival]
    expected_routes: list[BusExpectedRoute] = []


class BusTimetableResponse(BaseModel):
    route_id: int
    route_name: str
    schedule_type: str  # "weekday" | "saturday" | "sunday"
    stop_id: int | None = None
    stop_name: str | None = None
    times: list[str]  # ["07:00", "07:30", ...]
    notes: list[str | None] = []
    direction_name: str | None = None
    category: str | None = None
    origin_stop_name: str | None = None  # 기점 출발 정류장명
    is_realtime: bool = False
    gbis_route_id: str | None = None
