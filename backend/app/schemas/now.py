from pydantic import BaseModel


class NowDeparture(BaseModel):
    """통합 출발 정보 한 건.

    Now 탭에서 버스·셔틀·지하철을 하나의 리스트로 섞어 보여주기 위한 표준 레코드.
    """
    source: str                      # "bus" | "shuttle" | "subway"
    mode: str                        # "city_bus" | "wide_bus" | "shuttle" | "subway_k4" | "subway_seohae"
    route_number: str                # "시흥33", "3401", "셔틀", "수인분당선 상행"
    route_name: str | None = None
    origin_name: str | None = None
    destination_name: str | None = None
    arrival_type: str                # "realtime" | "timetable"
    arrive_in_seconds: int | None = None
    depart_at: str | None = None     # "HH:MM" if timetable
    is_realtime: bool = False
    crowded: int = 0                 # 1~4, 0 = unknown
    board_stop_name: str | None = None


class NowDeparturesResponse(BaseModel):
    mode: str                        # "등교" | "하교" | "지하철"
    selection_key: str               # "등교:campus" | "하교:jeongwang" | "지하철:정왕" ...
    updated_at: str
    departures: list[NowDeparture]
