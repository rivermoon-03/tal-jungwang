"""Now 탭 오케스트레이터.

버스·셔틀·지하철 출발 정보를 하나의 통합된 `NowDeparture` 리스트로 합친다.
기존 서비스(get_bus_arrivals, shuttle.get_next, subway.get_next)의 캐시를 재사용하므로
외부 API 호출 부담은 없다.
"""
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.now import NowDeparture
from app.services.bus import get_arrivals as get_bus_arrivals
from app.services.shuttle import get_next as get_next_shuttle
from app.services.subway import get_next as get_next_subway


# 광역버스 번호 집합 — mode 라벨링용. wide_bus 아닌 건 city_bus.
_WIDE_BUS_NUMBERS: set[str] = {"3400", "3401", "6502", "5602", "5601", "M6410"}

# 등교/하교 탭에서 폴링할 주요 정류장.
# CLAUDE.md의 GBIS 매핑에 따라 gbis_station_id를 int 값으로 전달한다.
#   - 한국공학대학교 : 224000639
#   - 이마트          : 224000513
CAMPUS_STOP_GBIS_IDS: list[tuple[str, int]] = [
    ("한국공학대학교", 224000639),
    ("이마트", 224000513),
]


def _bus_mode(route_no: str) -> str:
    return "wide_bus" if route_no in _WIDE_BUS_NUMBERS else "city_bus"


async def _bus_departures_for_mode(
    db: AsyncSession,
    now: datetime,
    mode: str,
    destination_code: str | None,
) -> list[NowDeparture]:
    """`mode`(등교|하교)에 맞는 카테고리의 버스 도착 정보를 모든 주요 정류장에서 긁어온다."""
    out: list[NowDeparture] = []
    for display, gbis_station_id in CAMPUS_STOP_GBIS_IDS:
        result = await get_bus_arrivals(db, gbis_station_id, now.date(), now.time())
        if not result:
            continue
        for a in result.get("arrivals", []):
            # 카테고리(방향) 필터 — 기타(Other)는 제외
            if mode == "등교" and a.get("category") != "등교":
                continue
            if mode == "하교" and a.get("category") != "하교":
                continue

            route_no = a.get("route_no", "")
            out.append(
                NowDeparture(
                    source="bus",
                    mode=_bus_mode(route_no),
                    route_number=route_no,
                    route_name=a.get("destination"),
                    origin_name=display,
                    destination_name=a.get("destination"),
                    arrival_type=a.get("arrival_type", "timetable"),
                    arrive_in_seconds=a.get("arrive_in_seconds"),
                    depart_at=a.get("depart_at"),
                    is_realtime=a.get("arrival_type") == "realtime",
                    crowded=a.get("crowded", 0),
                    board_stop_name=display,
                )
            )
    return out


# 셔틀 방향 코드 → UI 라벨
_SHUTTLE_DIRECTION_LABEL = {
    0: "정왕역 → 학교",
    1: "학교 → 정왕역",
}


async def _shuttle_departures(db: AsyncSession, now: datetime) -> list[NowDeparture]:
    """양방향 다음 셔틀을 NowDeparture로 변환."""
    out: list[NowDeparture] = []
    for direction in (0, 1):
        nxt = await get_next_shuttle(db, now.date(), now.time(), direction)
        if not nxt:
            continue
        label = _SHUTTLE_DIRECTION_LABEL.get(direction, "셔틀")
        out.append(
            NowDeparture(
                source="shuttle",
                mode="shuttle",
                route_number="셔틀",
                route_name=label,
                origin_name=label.split(" → ")[0] if "→" in label else None,
                destination_name=label.split(" → ")[1] if "→" in label else None,
                arrival_type="timetable",
                arrive_in_seconds=nxt.get("arrive_in_seconds"),
                depart_at=(nxt.get("depart_at") or "")[:5] or None,
                is_realtime=False,
                board_stop_name=label.split(" → ")[0] if "→" in label else None,
            )
        )
    return out


# 지하철 방향 코드 → (노선 코드, 방향 라벨)
# station_code 인자는 현재 정왕 단일 역만 지원 — 서해선/4호선/수인분당선은
# subway service가 단일 응답으로 묶어서 반환한다.
_SUBWAY_DIRECTIONS: list[tuple[str, str, str]] = [
    # (key_in_service_response, mode, direction_label)
    ("up", "subway_k4", "수인분당선 상행 — 왕십리 방면"),
    ("down", "subway_k4", "수인분당선 하행 — 인천 방면"),
    ("line4_up", "subway_k4", "4호선 상행 — 당고개 방면"),
    ("line4_down", "subway_k4", "4호선 하행 — 오이도 방면"),
    ("choji_up", "subway_seohae", "서해선 초지역 상행"),
    ("choji_dn", "subway_seohae", "서해선 초지역 하행"),
    ("siheung_up", "subway_seohae", "서해선 시흥시청역 상행"),
    ("siheung_dn", "subway_seohae", "서해선 시흥시청역 하행"),
]


async def _subway_departures(
    db: AsyncSession, station_code: str, now: datetime
) -> list[NowDeparture]:
    """지하철 다음 열차들을 NowDeparture 리스트로 변환.

    `subway.get_next`는 여러 방향의 다음 열차를 dict로 반환하므로
    그걸 각각 한 레코드로 펼친다. station_code 인자는 현재 "정왕" 고정.
    """
    nexts = await get_next_subway(db, now.date(), now.time())
    if not nexts:
        return []

    out: list[NowDeparture] = []
    for key, mode, label in _SUBWAY_DIRECTIONS:
        item = nexts.get(key)
        if not item:
            continue
        out.append(
            NowDeparture(
                source="subway",
                mode=mode,
                route_number=label.split(" ")[0],  # "수인분당선" | "4호선" | "서해선"
                route_name=label,
                origin_name=station_code or "정왕",
                destination_name=item.get("destination"),
                arrival_type="timetable",
                arrive_in_seconds=item.get("arrive_in_seconds"),
                depart_at=item.get("depart_at"),
                is_realtime=False,
                board_stop_name=station_code or "정왕",
            )
        )
    return out


def _sort_key(d: NowDeparture) -> int:
    """arrive_in_seconds 오름차순 정렬. 값 없으면 맨 뒤."""
    if d.arrive_in_seconds is not None:
        return d.arrive_in_seconds
    return 10**9


async def get_now_departures(
    db: AsyncSession,
    mode: str,                        # "등교" | "하교" | "지하철"
    destination_code: str | None,
    subway_station: str | None,
    now: datetime,
) -> list[NowDeparture]:
    """mode에 맞춰 관련 source를 병합하고 arrive_in_seconds 오름차순 정렬."""
    if mode in ("등교", "하교"):
        buses = await _bus_departures_for_mode(db, now, mode, destination_code)
        shuttles = await _shuttle_departures(db, now)
        return sorted(buses + shuttles, key=_sort_key)
    elif mode == "지하철":
        trains = await _subway_departures(db, subway_station or "정왕", now)
        return sorted(trains, key=_sort_key)
    return []
