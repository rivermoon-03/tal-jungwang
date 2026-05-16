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


class SubwayRealtimeItem(BaseModel):
    line: str          # "4호선" | "수인분당선"
    direction: str     # "상행" | "하행"
    destination: str   # 종착역명 (예: "불암산", "왕십리")
    status_code: int   # arvlCd: 0=진입, 1=도착, 2=출발, 5=전역도착, 99=운행중
    status_msg: str    # 표시용 메시지 (예: "전역 도착", "[4]번째 전역 (소래포구)")
    current_station: str  # arvlMsg3: 현재 열차가 있는 역명
    train_no: str      # btrainNo
    color: str         # 호선 색상 hex


class SubwayRealtimeStationPayload(BaseModel):
    """역별 실시간 도착정보 + graceful degradation 메타.

    items: SubwayRealtimeItem과 유사한 dict 목록 (parse_rows 출력).
    stale: True면 현재 API 호출은 비었고 last_success fallback을 반환 중.
    last_successful_realtime_at: 마지막으로 비어있지 않은 응답을 받은 시각 (ISO8601 KST).
                                  fresh 응답이면 같은 시각, 5분 내 last_success 없으면 None.
    """
    items: list[dict]
    stale: bool
    last_successful_realtime_at: str | None = None
