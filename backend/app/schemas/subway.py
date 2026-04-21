from pydantic import BaseModel


class SubwayTime(BaseModel):
    depart_at: str  # "HH:MM"
    destination: str


class SubwayTimetableResponse(BaseModel):
    station: str
    day_type: str  # weekday | saturday | sunday
    updated_at: str | None
    up: list[SubwayTime]          # 수인분당선 상행 (왕십리)
    down: list[SubwayTime]        # 수인분당선 하행 (인천)
    line4_up: list[SubwayTime]    # 4호선 상행 (당고개/진접)
    line4_down: list[SubwayTime]  # 4호선 하행 (오이도)
    choji_up: list[SubwayTime]    # 서해선 초지 상행 (소사)
    choji_dn: list[SubwayTime]    # 서해선 초지 하행 (원시)
    siheung_up: list[SubwayTime]  # 서해선 시흥시청 상행 (소사)
    siheung_dn: list[SubwayTime]  # 서해선 시흥시청 하행 (원시)


class SubwayNextTrain(BaseModel):
    depart_at: str  # "HH:MM"
    arrive_in_seconds: int
    destination: str
    next_depart_at: str | None = None  # "HH:MM" — 다음 다음 열차
    next_arrive_in_seconds: int | None = None


class SubwayNextResponse(BaseModel):
    up: SubwayNextTrain | None = None
    down: SubwayNextTrain | None = None
    line4_up: SubwayNextTrain | None = None
    line4_down: SubwayNextTrain | None = None
    choji_up: SubwayNextTrain | None = None
    choji_dn: SubwayNextTrain | None = None
    siheung_up: SubwayNextTrain | None = None
    siheung_dn: SubwayNextTrain | None = None
