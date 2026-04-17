"""TMAP 보행자 경로안내 API 클라이언트."""

from app.core.config import settings
from app.core.http_client import get_http_client

PEDESTRIAN_URL = "https://apis.openapi.sk.com/tmap/routes/pedestrian"


async def fetch_walking_route(
    start_x: float, start_y: float,
    end_x: float, end_y: float,
    start_name: str = "출발지",
    end_name: str = "도착지",
) -> dict:
    """보행자 경로 탐색. GeoJSON 형태로 반환."""
    headers = {"appKey": settings.TMAP_APP_KEY}
    body = {
        "startX": str(start_x),
        "startY": str(start_y),
        "endX": str(end_x),
        "endY": str(end_y),
        "startName": start_name,
        "endName": end_name,
        "reqCoordType": "WGS84GEO",
        "resCoordType": "WGS84GEO",
        "searchOption": "0",
    }

    client = await get_http_client()
    resp = await client.post(
        f"{PEDESTRIAN_URL}?version=1",
        headers=headers,
        json=body,
    )
    resp.raise_for_status()

    data = resp.json()
    features = data.get("features", [])

    if not features:
        return {"duration_seconds": 0, "distance_meters": 0, "coordinates": []}

    # 첫 번째 feature의 properties에 총 거리/시간 정보
    props = features[0].get("properties", {})
    total_distance = int(props.get("totalDistance", 0))
    total_time = int(props.get("totalTime", 0))

    # LineString 좌표 추출
    coordinates = []
    for f in features:
        geom = f.get("geometry", {})
        if geom.get("type") == "LineString":
            coordinates.extend(geom.get("coordinates", []))

    return {
        "duration_seconds": total_time,
        "distance_meters": total_distance,
        "coordinates": coordinates,  # [[lng, lat], ...]
    }


DRIVING_URL = "https://apis.openapi.sk.com/tmap/routes"


async def fetch_driving_traffic(
    start_x: float, start_y: float,
    end_x: float, end_y: float,
) -> dict:
    """자동차 경로 탐색. 구간별 도로명·거리·소요시간 반환."""
    headers = {"appKey": settings.TMAP_APP_KEY}
    body = {
        "startX": str(start_x),
        "startY": str(start_y),
        "endX": str(end_x),
        "endY": str(end_y),
        "reqCoordType": "WGS84GEO",
        "resCoordType": "WGS84GEO",
        "searchOption": "0",
    }

    client = await get_http_client()
    resp = await client.post(
        f"{DRIVING_URL}?version=1",
        headers=headers,
        json=body,
    )
    resp.raise_for_status()

    data = resp.json()
    features = data.get("features", [])
    if not features:
        return {"duration_seconds": 0, "distance_meters": 0, "segments": []}

    props = features[0].get("properties", {})
    total_distance = int(props.get("totalDistance", 0))
    total_time = int(props.get("totalTime", 0))

    # 구간별 도로명, 거리, 시간 추출
    segments = []
    for f in features:
        geom = f.get("geometry", {})
        p = f.get("properties", {})
        if geom.get("type") == "LineString":
            dist = int(p.get("distance", 0))
            time_sec = int(p.get("time", 0))
            segments.append({
                "road_name": p.get("name", ""),
                "distance": dist,
                "time": time_sec,
                "speed": round(dist / time_sec * 3.6, 1) if time_sec > 0 else 0,
                "coordinates": geom.get("coordinates", []),
            })

    return {
        "duration_seconds": total_time,
        "distance_meters": total_distance,
        "segments": segments,
    }
