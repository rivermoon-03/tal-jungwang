"""카카오모빌리티 자동차/도보 길찾기 API 클라이언트."""

import logging

from app.core.config import settings
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

DIRECTIONS_URL = "https://apis-navi.kakaomobility.com/v1/directions"
WALKING_URL    = "https://apis-navi.kakaomobility.com/v1/directions/walking"


async def fetch_driving_route(
    origin_x: float, origin_y: float,
    dest_x: float, dest_y: float,
    priority: str = "RECOMMEND",
) -> dict:
    """자동차 경로 탐색."""
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_MOBILITY_REST_KEY}"}
    params = {
        "origin": f"{origin_x},{origin_y}",
        "destination": f"{dest_x},{dest_y}",
        "priority": priority,
    }

    client = await get_http_client()
    resp = await client.get(DIRECTIONS_URL, headers=headers, params=params)
    resp.raise_for_status()

    data = resp.json()
    routes = data.get("routes", [])
    if not routes:
        return {"duration_seconds": 0, "distance_meters": 0, "toll_fee": 0, "coordinates": []}

    route = routes[0]
    if route.get("result_code") != 0:
        return {"duration_seconds": 0, "distance_meters": 0, "toll_fee": 0, "coordinates": []}

    summary = route.get("summary", {})
    duration = summary.get("duration", 0)
    distance = summary.get("distance", 0)
    fare = summary.get("fare", {})
    toll = fare.get("toll", 0)

    # vertexes 좌표 추출 (flat array → [[lng, lat], ...])
    coordinates = []
    for section in route.get("sections", []):
        for road in section.get("roads", []):
            verts = road.get("vertexes", [])
            for i in range(0, len(verts), 2):
                coordinates.append([verts[i], verts[i + 1]])

    return {
        "duration_seconds": duration,
        "distance_meters": distance,
        "toll_fee": toll,
        "coordinates": coordinates,
    }


async def fetch_walking_route(
    origin_x: float, origin_y: float,
    dest_x: float, dest_y: float,
) -> dict:
    """도보 경로 탐색 (카카오모빌리티).

    origin_x/dest_x = 경도(longitude), origin_y/dest_y = 위도(latitude).
    """
    headers = {"Authorization": f"KakaoAK {settings.KAKAO_MOBILITY_REST_KEY}"}
    params = {
        "origin":      f"{origin_x},{origin_y}",
        "destination": f"{dest_x},{dest_y}",
    }

    try:
        client = await get_http_client()
        resp = await client.get(WALKING_URL, headers=headers, params=params)
        resp.raise_for_status()
    except Exception as e:
        logger.warning("[kakao walking] HTTP 오류: %s", e)
        return {"duration_seconds": 0, "distance_meters": 0, "coordinates": []}

    data = resp.json()
    routes = data.get("routes", [])
    if not routes:
        logger.warning("[kakao walking] routes 없음. 응답: %s", data)
        return {"duration_seconds": 0, "distance_meters": 0, "coordinates": []}
    if routes[0].get("result_code") != 0:
        logger.warning("[kakao walking] result_code=%s", routes[0].get("result_code"))
        return {"duration_seconds": 0, "distance_meters": 0, "coordinates": []}

    summary = routes[0].get("summary", {})
    duration = summary.get("duration", 0)
    distance = summary.get("distance", 0)

    coordinates = []
    for section in routes[0].get("sections", []):
        for road in section.get("roads", []):
            verts = road.get("vertexes", [])
            for i in range(0, len(verts), 2):
                coordinates.append([verts[i], verts[i + 1]])

    return {
        "duration_seconds": duration,
        "distance_meters": distance,
        "coordinates": coordinates,
    }
