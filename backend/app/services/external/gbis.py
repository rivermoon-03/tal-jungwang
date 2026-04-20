"""경기도 버스도착정보 / 버스위치정보 v2 API 클라이언트."""

from app.core.config import settings
from app.core.http_client import get_http_client

ARRIVAL_URL = "https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2"
LOCATION_URL = "https://apis.data.go.kr/6410000/buslocationservice/v2/getBusLocationListv2"


def _common_params(**extra) -> dict:
    return {"serviceKey": settings.DATA_GO_KR_SERVICE_KEY, "format": "json", **extra}


def _parse_body(data: dict) -> dict:
    return data.get("response", {}).get("msgBody", {})


def _as_list(body: dict, key: str) -> list[dict]:
    items = body.get(key, [])
    if isinstance(items, dict):
        items = [items]
    return items


async def fetch_arrivals(station_id: str) -> list[dict]:
    """정류소의 실시간 버스 도착 정보 조회."""
    params = _common_params(stationId=station_id)
    client = await get_http_client()
    resp = await client.get(ARRIVAL_URL, params=params)
    resp.raise_for_status()

    body = _parse_body(resp.json())
    if not body:
        return []

    results = []
    for item in _as_list(body, "busArrivalList"):
        results.append({
            "route_id": str(item.get("routeId", "")),
            "predict_time1": int(item.get("predictTime1", 0) or 0),
            "predict_time2": int(item.get("predictTime2", 0) or 0),
            "predict_time_sec1": int(item.get("predictTimeSec1", 0) or 0),
            "predict_time_sec2": int(item.get("predictTimeSec2", 0) or 0),
            "location_no1": int(item.get("locationNo1", 0) or 0),
            "location_no2": int(item.get("locationNo2", 0) or 0),
            "remain_seat1": int(item.get("remainSeatCnt1", -1) or -1),
            "low_plate1": item.get("lowPlate1", 0) == 1 or item.get("lowPlate1", "0") == "1",
            "plate_no1": item.get("plateNo1", ""),
            "plate_no2": item.get("plateNo2", ""),
            "crowded1": int(item.get("crowded1") or 0),
            "crowded2": int(item.get("crowded2") or 0),
        })
    return results


async def fetch_bus_locations(route_id: str) -> list[dict]:
    """노선의 실시간 버스 위치 목록 조회.

    v2 API는 좌표를 제공하지 않고 stationId/stationSeq만 반환한다.
    """
    params = _common_params(routeId=route_id)
    client = await get_http_client()
    resp = await client.get(LOCATION_URL, params=params)
    resp.raise_for_status()

    body = _parse_body(resp.json())
    if not body:
        return []

    results = []
    for item in _as_list(body, "busLocationList"):
        results.append({
            "plate_no": item.get("plateNo", ""),
            "station_id": str(item.get("stationId", "")),
            "station_seq": int(item.get("stationSeq", 0) or 0),
            "low_plate": item.get("lowPlate", 0) == 1 or item.get("lowPlate", "0") == "1",
            "crowded": int(item.get("crowded", 0) or 0),
        })
    return results
