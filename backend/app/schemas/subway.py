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


class SubwayNextTrain(BaseModel):
    depart_at: str  # "HH:MM"
    arrive_in_seconds: int
    destination: str


class SubwayNextResponse(BaseModel):
    up: SubwayNextTrain | None = None
    down: SubwayNextTrain | None = None
    line4_up: SubwayNextTrain | None = None
    line4_down: SubwayNextTrain | None = None
