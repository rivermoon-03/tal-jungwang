from pydantic import BaseModel


class RoadTraffic(BaseModel):
    road_name: str
    direction: str          # "to_station" | "to_school"
    congestion: float       # 0~4 (0: 정보없음, 1: 원활, 2: 서행, 3: 지체, 4: 정체)
    congestion_label: str   # "원활" | "서행" | "지체" | "정체" | "정보없음"
    speed: float            # km/h
    duration_seconds: int
    distance_meters: int


class TrafficResponse(BaseModel):
    roads: list[RoadTraffic]
    updated_at: str


class TrafficFlowPoint(BaseModel):
    hour: int            # 0..23
    minute: int          # 0 | 30 (half-hour buckets)
    congestion: float    # 1.0..4.0 averaged
    speed: float         # km/h averaged


class TrafficFlowResponse(BaseModel):
    road_name: str       # "마유로"
    day_type: str        # "weekday" | "weekend"
    sample_days: int     # 집계에 포함된 서로 다른 날짜의 수
    points: list[TrafficFlowPoint]


class CrowdingFlowPoint(BaseModel):
    hour: int           # 0..23
    minute: int         # 0 | 30 (half-hour buckets)
    crowded: float      # 1.0..4.0 (1=여유, 2=보통, 3=혼잡, 4=매우혼잡)
    samples: int        # 해당 버킷에 집계된 로그 수


class CrowdingFlowResponse(BaseModel):
    route_no: str                # "시흥33" | "20-1" | "11-A" …
    route_direction: str | None  # "시흥시청방면" …
    stop_name: str | None        # "한국공학대학교" | "이마트"
    day_type: str                # "weekday" | "weekend"
    sample_days: int
    total_samples: int
    points: list[CrowdingFlowPoint]
