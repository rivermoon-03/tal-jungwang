"""GBIS API로 시흥33·20-1·시흥1번 노선 및 정류장 ID를 DB에 업데이트하는 스크립트.

사용법:
    docker compose exec backend python -m scripts.register_gbis_ids

전제조건:
    - DB가 실행 중이고 시드 데이터가 이미 입력되어 있어야 함
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import update
from app.core.database import AsyncSessionLocal
from app.models.bus import BusRoute, BusStop

# GBIS에서 확인된 ID (2026-04-13 수동 확인)
ROUTE_IDS = {
    "시흥33": "224000062",
    "20-1": "224000023",
    "시흥1": "213000006",
}

STATION_IDS = {
    "한국공학대학교": "224000639",
    "이마트 (6502·시흥1번 정류장)": "224000513",
}


async def main():
    print("=== GBIS ID DB 업데이트 ===\n")

    async with AsyncSessionLocal() as session:
        async with session.begin():
            for route_number, gbis_route_id in ROUTE_IDS.items():
                await session.execute(
                    update(BusRoute)
                    .where(BusRoute.route_number == route_number)
                    .values(gbis_route_id=gbis_route_id)
                )
                print(f"  bus_routes: '{route_number}' → gbis_route_id='{gbis_route_id}'")

            for name, gbis_station_id in STATION_IDS.items():
                await session.execute(
                    update(BusStop)
                    .where(BusStop.name == name)
                    .values(gbis_station_id=gbis_station_id)
                )
                print(f"  bus_stops: '{name}' → gbis_station_id='{gbis_station_id}'")

    print("\n완료!")


if __name__ == "__main__":
    asyncio.run(main())
