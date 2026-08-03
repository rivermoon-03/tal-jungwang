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


class TrafficIncident(BaseModel):
    """통학축 돌발상황(B3). occurred_at은 KST tz-aware ISO 문자열."""

    type: str                  # "accident" | "construction"
    road_name: str
    message: str
    occurred_at: str | None


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
    hour: int                  # 0..23
    minute: int                # 0 | 30 (half-hour buckets)
    crowded: float | None      # 1.0..4.0 평균 — 호환용. 표시에는 쓰지 않는다
    # 표시 기준. 이 버킷 도착 버스 중 혼잡(등급 3 이상) 비율 0.0~1.0.
    # 평균은 하한이 1이라 값 1인 버스와 3인 버스가 섞이면 2("보통")로 뭉개진다.
    # 분포가 아직 집계되지 않은 버킷은 null (평균으로 추정하지 않는다).
    ratio: float | None = None
    samples: int               # 해당 버킷의 차량 접근 수
    # 관측이 아니라 bus_crowding_calibrations 의 표시 하한이 값을 올린 경우 true.
    # 화면이 "경험 기준"으로 출처를 구분해 표기한다.
    estimated: bool = False
    reliable: bool = True      # 표본이 충분한가(부족하면 화면이 "정보 부족" 표시)


class CrowdingFlowResponse(BaseModel):
    route_no: str                # "시흥33" | "20-1" | "11-A" …
    route_direction: str | None  # "시흥시청방면" …
    stop_name: str | None        # "한국공학대학교" | "이마트"
    day_type: str                # "weekday" | "weekend"
    sample_days: int
    total_samples: int
    points: list[CrowdingFlowPoint]
