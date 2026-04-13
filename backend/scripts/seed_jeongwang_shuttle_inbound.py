# 실행: cd backend && python -m scripts.seed_jeongwang_shuttle_inbound
# Docker: docker compose exec backend python -m scripts.seed_jeongwang_shuttle_inbound
"""
정왕역 → 학교(등교) 노선 평일 시간표를 seed한다.

동작 순서:
  1. 현재 활성 SchedulePeriod 전체 조회 (우선순위 순)
  2. ShuttleRoute에 route_name="정왕역→학교" 가 없으면 INSERT
  3. 해당 route_id + day_type="weekday" 로 등록된 ShuttleTimetableEntry가
     있으면 전부 DELETE 후 재삽입 (멱등성 보장)
  4. 평일 시간표를 모든 활성 SchedulePeriod에 대해 삽입
"""

import asyncio
from datetime import date, time

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.models.shuttle import SchedulePeriod, ShuttleRoute, ShuttleTimetableEntry

ROUTE_NAME = "등교 (학교행)"
ROUTE_DESCRIPTION = "정왕역 출발 → 한국공학대학교/경기과학기술대학교 (등교)"
DAY_TYPE = "weekday"

# (departure_time, note)
WEEKDAY_TIMETABLE: list[tuple[time, str | None]] = [
    # 수시운행 블록 08:40 ~ 10:00
    (time(8, 40),  "수시운행"),
    (time(8, 50),  "수시운행"),
    (time(9, 0),   "수시운행"),
    (time(9, 10),  "수시운행"),
    (time(9, 20),  "수시운행"),
    (time(9, 30),  "수시운행"),
    (time(9, 40),  "수시운행"),
    (time(9, 50),  "수시운행"),
    (time(10, 0),  "수시운행"),
    # 일반 시간
    (time(10, 10), None),
    (time(10, 15), None),
    (time(10, 20), None),
    (time(10, 30), None),
    (time(10, 50), None),
    (time(11, 0),  None),
    (time(11, 10), None),
    (time(11, 20), None),
    (time(11, 30), None),
    (time(11, 50), None),
    (time(12, 0),  None),
    (time(12, 10), None),
    (time(12, 20), None),
    (time(12, 30), None),
    (time(12, 50), None),
    (time(13, 0),  None),
    (time(13, 10), None),
    (time(13, 20), None),
    (time(13, 30), None),
    (time(13, 50), None),
    (time(14, 0),  None),
    (time(14, 10), None),
    (time(14, 20), None),
    (time(14, 40), None),
    (time(15, 0),  None),
    (time(15, 10), None),
    (time(15, 20), None),
    (time(15, 40), None),
    (time(16, 0),  None),
    (time(16, 20), None),
    (time(16, 30), None),
    (time(16, 40), None),
    (time(16, 50), None),
    # 17:10: 학교→역 수시운행 회차편 (17:00~18:00 수시운행 버스 회차)
    (time(17, 10), "회차편 · 학교 수시운행 출발"),
    # 18:00 이후 고정편 회차 (학교 출발 +10분)
    (time(18, 10), "회차편 · 학교 18:00 출발"),
    (time(18, 20), "회차편 · 학교 18:10 출발"),
    (time(18, 30), "회차편 · 학교 18:20 출발"),
    (time(18, 40), "회차편 · 학교 18:30 출발"),
    (time(18, 50), "회차편 · 학교 18:40 출발"),
    (time(19,  0), "회차편 · 학교 18:50 출발"),
    (time(19, 15), "회차편 · 학교 19:05 출발"),
    (time(19, 25), "회차편 · 학교 19:15 출발"),
    (time(19, 40), "회차편 · 학교 19:30 출발"),
    (time(19, 55), "회차편 · 학교 19:45 출발"),
    (time(20, 15), "회차편 · 학교 20:05 출발"),
    (time(20, 35), "회차편 · 학교 20:25 출발"),
    (time(20, 55), "회차편 · 학교 20:45 출발"),
    (time(21, 10), "회차편 · 학교 21:00 출발"),
    (time(21, 30), "회차편 · 학교 21:20 출발"),
    (time(21, 58), "회차편 · 학교 21:48 출발"),
    # 막차
    (time(22, 17), "막차"),
]


async def main() -> None:
    today = date.today()

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # 1. 현재 활성 SchedulePeriod 조회 (우선순위 내림차순)
            period_rows = await session.execute(
                select(SchedulePeriod)
                .where(
                    SchedulePeriod.start_date <= today,
                    SchedulePeriod.end_date >= today,
                )
                .order_by(SchedulePeriod.priority.desc())
            )
            periods = period_rows.scalars().all()

            if not periods:
                print("활성 SchedulePeriod가 없습니다. 시드를 중단합니다.")
                return

            print(f"활성 SchedulePeriod {len(periods)}개 발견:")
            for p in periods:
                print(f"  - [{p.id}] {p.name} ({p.start_date} ~ {p.end_date}, priority={p.priority})")

            # 2. ShuttleRoute upsert
            route_row = await session.execute(
                select(ShuttleRoute).where(ShuttleRoute.route_name == ROUTE_NAME)
            )
            route = route_row.scalar_one_or_none()

            if route is None:
                new_route = ShuttleRoute(route_name=ROUTE_NAME, description=ROUTE_DESCRIPTION)
                session.add(new_route)
                await session.flush()  # id 확보
                route_id: int = new_route.id
                print(f"\nShuttleRoute 신규 생성: id={route_id}, name='{ROUTE_NAME}'")
            else:
                route_id = route.id
                print(f"\nShuttleRoute 기존 사용: id={route_id}, name='{ROUTE_NAME}'")

            # 3. 기존 항목 삭제 (멱등성)
            delete_result = await session.execute(
                delete(ShuttleTimetableEntry).where(
                    ShuttleTimetableEntry.shuttle_route_id == route_id,
                    ShuttleTimetableEntry.day_type == DAY_TYPE,
                )
            )
            deleted_count: int = delete_result.rowcount
            if deleted_count:
                print(f"기존 항목 {deleted_count}개 삭제 완료 (재삽입 준비)")

            # 4. 평일 시간표를 모든 활성 SchedulePeriod에 삽입
            for period in periods:
                for departure_time, note in WEEKDAY_TIMETABLE:
                    session.add(ShuttleTimetableEntry(
                        schedule_period_id=period.id,
                        shuttle_route_id=route_id,
                        day_type=DAY_TYPE,
                        departure_time=departure_time,
                        note=note,
                    ))

            inserted_count = len(periods) * len(WEEKDAY_TIMETABLE)
            print(f"\n삽입 완료: {len(periods)}개 기간 × {len(WEEKDAY_TIMETABLE)}개 시간 = {inserted_count}개")

    print("\n시드 완료.")


if __name__ == "__main__":
    asyncio.run(main())
