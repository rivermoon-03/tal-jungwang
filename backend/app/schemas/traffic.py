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


class TrafficFlowResponse(BaseModel):
    road_name: str       # "마유로"
    day_type: str        # "weekday" | "weekend"
    sample_days: int     # 집계에 포함된 서로 다른 날짜의 수
    points: list[TrafficFlowPoint]
