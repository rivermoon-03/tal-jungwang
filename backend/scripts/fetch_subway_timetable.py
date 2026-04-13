"""TAGO API에서 정왕역 지하철 시간표를 가져와 DB에 저장하는 스크립트.

사용법:
    docker compose exec backend python -m scripts.fetch_subway_timetable
"""

import asyncio
import os
import sys
from datetime import datetime, time, timezone

import httpx

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete, text
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.subway import SubwayTimetableEntry

TAGO_BASE = "https://apis.data.go.kr/1613000/SubwayInfo/GetSubwaySttnAcctoSchdulList"

# 정왕역 역 ID
SUINBUNDANG_ID = "MTRKRK1K257"  # 수인분당선
LINE4_ID = "MTRKR4455"          # 4호선

# dailyTypeCode: 01=평일, 02=토요일, 03=일요일/공휴일
# upDownTypeCode: U=상행, D=하행
# (station_id, daily, ud, day_type, direction)
COMBOS = [
    # 수인분당선: 상행(왕십리), 하행(인천)
    (SUINBUNDANG_ID, "01", "U", "weekday", "up"),
    (SUINBUNDANG_ID, "01", "D", "weekday", "down"),
    (SUINBUNDANG_ID, "02", "U", "saturday", "up"),
    (SUINBUNDANG_ID, "02", "D", "saturday", "down"),
    (SUINBUNDANG_ID, "03", "U", "sunday", "up"),
    (SUINBUNDANG_ID, "03", "D", "sunday", "down"),
    # 4호선: 상행(당고개/진접), 하행(오이도)
    (LINE4_ID, "01", "U", "weekday", "line4_up"),
    (LINE4_ID, "01", "D", "weekday", "line4_down"),
    (LINE4_ID, "02", "U", "saturday", "line4_up"),
    (LINE4_ID, "02", "D", "saturday", "line4_down"),
    (LINE4_ID, "03", "U", "sunday", "line4_up"),
    (LINE4_ID, "03", "D", "sunday", "line4_down"),
]


async def fetch_timetable(
    client: httpx.AsyncClient,
    station_id: str,
    daily_code: str,
    ud_code: str,
) -> list[dict]:
    params = {
        "serviceKey": settings.DATA_GO_KR_SERVICE_KEY,
        "subwayStationId": station_id,
        "dailyTypeCode": daily_code,
        "upDownTypeCode": ud_code,
        "numOfRows": 500,
        "_type": "json",
    }
    resp = await client.get(TAGO_BASE, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
    if isinstance(items, dict):
        items = [items]
    return items


async def main():
    now = datetime.now(timezone.utc)
    total = 0

    async with httpx.AsyncClient() as client:
        async with AsyncSessionLocal() as db:
            # 기존 데이터 전부 삭제
            await db.execute(delete(SubwayTimetableEntry))
            print("기존 지하철 시간표 삭제 완료")

            for station_id, daily_code, ud_code, day_type, direction in COMBOS:
                items = await fetch_timetable(client, station_id, daily_code, ud_code)
                count = 0

                for item in items:
                    dep_str = item.get("depTime", "")
                    if not dep_str or len(dep_str) < 6:
                        continue

                    hh = int(dep_str[:2])
                    mm = int(dep_str[2:4])
                    ss = int(dep_str[4:6])
                    dep_time = time(hh, mm, ss)

                    destination = item.get("endSubwayStationNm", "") or ""
                    # 4호선 상행은 TAGO에서 목적지가 비어 있는 경우가 많음
                    if not destination and direction == "line4_up":
                        destination = "당고개"

                    entry = SubwayTimetableEntry(
                        direction=direction,
                        day_type=day_type,
                        departure_time=dep_time,
                        destination=destination,
                        updated_at=now,
                    )
                    db.add(entry)
                    count += 1

                total += count
                print(f"  {day_type}/{direction}: {count}건")

            await db.commit()

    print(f"\n총 {total}건 저장 완료")


if __name__ == "__main__":
    asyncio.run(main())
