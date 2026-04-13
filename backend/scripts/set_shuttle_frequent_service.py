"""
shuttle_timetable_entries 테이블에서
17:00 ~ 18:00 구간 항목들의 note를 "수시운행"으로 업데이트한다.

실행:
  cd backend
  python -m scripts.set_shuttle_frequent_service
"""

import asyncio
from datetime import time

from sqlalchemy import update

from app.core.database import engine
from app.models.shuttle import ShuttleTimetableEntry


async def main() -> None:
    async with engine.begin() as conn:
        result = await conn.execute(
            update(ShuttleTimetableEntry)
            .where(
                ShuttleTimetableEntry.departure_time >= time(17, 0),
                ShuttleTimetableEntry.departure_time <= time(18, 0),
            )
            .values(note="수시운행")
            .returning(ShuttleTimetableEntry.id)
        )
        updated_ids = result.fetchall()

    print(f"업데이트된 항목: {len(updated_ids)}개")
    if updated_ids:
        print(f"  IDs: {[r[0] for r in updated_ids]}")


if __name__ == "__main__":
    asyncio.run(main())
