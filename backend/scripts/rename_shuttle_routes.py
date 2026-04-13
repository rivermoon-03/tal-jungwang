# 실행: cd backend && python -m scripts.rename_shuttle_routes
# Docker: docker compose exec backend python -m scripts.rename_shuttle_routes
"""
셔틀 노선 표시명 변경
  정왕역방면   → 하교 (정왕역행)
  정왕역→학교 → 등교 (학교행)
"""

import asyncio

from sqlalchemy import update

from app.core.database import AsyncSessionLocal
from app.models.shuttle import ShuttleRoute

RENAMES = [
    ("정왕역방면",   "하교 (정왕역행)"),
    ("정왕역→학교", "등교 (학교행)"),
]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            for old_name, new_name in RENAMES:
                result = await session.execute(
                    update(ShuttleRoute)
                    .where(ShuttleRoute.route_name == old_name)
                    .values(route_name=new_name)
                    .returning(ShuttleRoute.id)
                )
                row = result.fetchone()
                if row:
                    print(f"  [{row[0]}] '{old_name}' → '{new_name}'")
                else:
                    print(f"  (건너뜀) '{old_name}' — 해당 노선 없음")

    print("완료.")


if __name__ == "__main__":
    asyncio.run(main())
