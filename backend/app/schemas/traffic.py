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
