# 실행: cd backend && python -m scripts.reset_shuttle_timetable
# Docker: docker compose exec backend python -m scripts.reset_shuttle_timetable
"""
셔틀 노선 + 시간표 전체 초기화 후 재시딩.

기존 shuttle_routes / shuttle_timetable_entries 전부 삭제 후
하교(학교→정왕역) / 등교(정왕역→학교) 두 노선을 올바르게 삽입한다.
"""

import asyncio
from datetime import date, time

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.models.shuttle import SchedulePeriod, ShuttleRoute, ShuttleTimetableEntry

# ── 하교: 학교 출발 → 정왕역 ──────────────────────────────────
OUTBOUND_ROUTE = "정왕역행 (하교)"
OUTBOUND_DESC  = "한국공학대학교/경기과학기술대학교 출발 → 정왕역"

OUTBOUND_WEEKDAY: list[tuple[time, str | None]] = [
    # 9시
    (time( 9,  0), None), (time( 9, 20), None), (time( 9, 40), None),
    # 10시
    (time(10,  0), None), (time(10,  5), None), (time(10, 10), None),
    (time(10, 20), None), (time(10, 40), None), (time(10, 50), None),
    # 11시
    (time(11,  0), None), (time(11, 10), None), (time(11, 20), None),
    (time(11, 40), None), (time(11, 50), None),
    # 12시
    (time(12,  0), None), (time(12, 10), None), (time(12, 20), None),
    (time(12, 40), None), (time(12, 50), None),
    # 13시
    (time(13,  0), None), (time(13, 10), None), (time(13, 20), None),
    (time(13, 40), None), (time(13, 50), None),
    # 14시
    (time(14,  0), None), (time(14, 10), None), (time(14, 30), None),
    (time(14, 50), None),
    # 15시
    (time(15,  0), None), (time(15, 10), None), (time(15, 30), None),
    (time(15, 50), None),
    # 16시
    (time(16, 10), None), (time(16, 20), None), (time(16, 30), None),
    (time(16, 40), None), (time(16, 50), None),
    # 17시 수시운행 (17:00~18:00)
    (time(17,  0), "수시운행"), (time(17, 10), "수시운행"),
    (time(17, 20), "수시운행"), (time(17, 30), "수시운행"),
    (time(17, 40), "수시운행"), (time(17, 50), "수시운행"),
    (time(18,  0), "수시운행"),
    # 18시 (18:00은 수시운행에 포함되므로 18:10부터)
    (time(18, 10), None), (time(18, 20), None),
    (time(18, 30), None), (time(18, 40), None), (time(18, 50), None),
    # 19시
    (time(19,  5), None), (time(19, 15), None), (time(19, 30), None),
    (time(19, 45), None),
    # 20시
    (time(20,  5), None), (time(20, 25), None), (time(20, 45), None),
    # 21시
    (time(21,  0), None), (time(21, 20), None), (time(21, 48), None),
    # 22시
    (time(22, 10), None), (time(22, 40), None),
]

# ── 등교: 정왕역 출발 → 학교 ──────────────────────────────────
INBOUND_ROUTE = "학교행 (등교)"
INBOUND_DESC  = "정왕역 출발 → 한국공학대학교/경기과학기술대학교"

INBOUND_WEEKDAY: list[tuple[time, str | None]] = [
    # 08:40~10:00 수시운행
    (time( 8, 40), "수시운행"), (time( 8, 50), "수시운행"),
    (time( 9,  0), "수시운행"), (time( 9, 10), "수시운행"),
    (time( 9, 20), "수시운행"), (time( 9, 30), "수시운행"),
    (time( 9, 40), "수시운행"), (time( 9, 50), "수시운행"),
    (time(10,  0), "수시운행"),
    # 10시
    (time(10, 10), None), (time(10, 15), None), (time(10, 20), None),
    (time(10, 30), None), (time(10, 50), None),
    # 11시
    (time(11,  0), None), (time(11, 10), None), (time(11, 20), None),
    (time(11, 30), None), (time(11, 50), None),
    # 12시
    (time(12,  0), None), (time(12, 10), None), (time(12, 20), None),
    (time(12, 30), None), (time(12, 50), None),
    # 13시
    (time(13,  0), None), (time(13, 10), None), (time(13, 20), None),
    (time(13, 30), None), (time(13, 50), None),
    # 14시
    (time(14,  0), None), (time(14, 10), None), (time(14, 20), None),
    (time(14, 40), None),
    # 15시
    (time(15,  0), None), (time(15, 10), None), (time(15, 20), None),
    (time(15, 40), None),
    # 16시
    (time(16,  0), None), (time(16, 20), None), (time(16, 30), None),
    (time(16, 40), None), (time(16, 50), None),
    # 17~21시: 하교 버스 회차편
    (time(17, 10), "회차편 · 학교 수시운행 출발"),   # 수시운행 회차
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


async def _upsert_route(session, name: str, desc: str) -> int:
    row = (await session.execute(
        select(ShuttleRoute).where(ShuttleRoute.route_name == name)
    )).scalar_one_or_none()
    if row is None:
        route = ShuttleRoute(route_name=name, description=desc)
        session.add(route)
        await session.flush()
        return route.id
    return row.id


async def _seed_entries(session, route_id: int, periods, timetable):
    await session.execute(
        delete(ShuttleTimetableEntry).where(
            ShuttleTimetableEntry.shuttle_route_id == route_id,
            ShuttleTimetableEntry.day_type == "weekday",
        )
    )
    for period in periods:
        for dep_time, note in timetable:
            session.add(ShuttleTimetableEntry(
                schedule_period_id=period.id,
                shuttle_route_id=route_id,
                day_type="weekday",
                departure_time=dep_time,
                note=note,
            ))


async def main() -> None:
    today = date.today()

    async with AsyncSessionLocal() as session:
        async with session.begin():

            # 1. 기존 잘못된 노선(이전 이름들) 및 그 항목 삭제
            stale_names = ["정왕역방면", "정왕역→학교", "등교 (학교행)", "하교 (정왕역행)"]
            for name in stale_names:
                route = (await session.execute(
                    select(ShuttleRoute).where(ShuttleRoute.route_name == name)
                )).scalar_one_or_none()
                if route:
                    await session.execute(
                        delete(ShuttleTimetableEntry).where(
                            ShuttleTimetableEntry.shuttle_route_id == route.id
                        )
                    )
                    await session.delete(route)
                    print(f"  삭제: '{name}'")

            # 2. 활성 SchedulePeriod 조회
            periods = (await session.execute(
                select(SchedulePeriod)
                .where(
                    SchedulePeriod.start_date <= today,
                    SchedulePeriod.end_date >= today,
                )
                .order_by(SchedulePeriod.priority.desc())
            )).scalars().all()

            if not periods:
                print("활성 SchedulePeriod 없음. 중단.")
                return
            print(f"\n활성 기간 {len(periods)}개:")
            for p in periods:
                print(f"  [{p.id}] {p.name} ({p.start_date}~{p.end_date})")

            # 3. 하교 노선 시딩
            out_id = await _upsert_route(session, OUTBOUND_ROUTE, OUTBOUND_DESC)
            await _seed_entries(session, out_id, periods, OUTBOUND_WEEKDAY)
            print(f"\n하교 ({OUTBOUND_ROUTE}) id={out_id}: {len(periods) * len(OUTBOUND_WEEKDAY)}개 삽입")

            # 4. 등교 노선 시딩
            in_id = await _upsert_route(session, INBOUND_ROUTE, INBOUND_DESC)
            await _seed_entries(session, in_id, periods, INBOUND_WEEKDAY)
            print(f"등교 ({INBOUND_ROUTE}) id={in_id}: {len(periods) * len(INBOUND_WEEKDAY)}개 삽입")

    print("\n완료.")


if __name__ == "__main__":
    asyncio.run(main())
