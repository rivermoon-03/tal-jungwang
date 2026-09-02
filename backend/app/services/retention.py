"""로그성 테이블 보존 정책.

bus_crowding_logs / bus_arrival_history / traffic_history / subway_arrival_history는
보존 기간 없이 계속 쌓이기만 해서 DB 용량을 무한히 잠식한다. 매일 나이틀리로
오래된 행을 배치 삭제해 정리한다 (scheduler.py의 log_retention_purge job에서만 호출).

주의: 이 모듈은 스케줄러 전용이다. prod DB에 직접 실행하는 경로를 만들지 말 것.
"""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# 한 배치당 삭제 행 수 (락 최소화)
_BATCH_SIZE = 5000
# 무한루프 방지 상한 (배치 횟수)
_MAX_BATCHES = 10000

# (테이블명, 시각 컬럼, 보존기간) — 컷오프는 서버측 now()로 계산해 tz 이슈 회피
_RETENTION_TARGETS: list[tuple[str, str, str]] = [
    ("bus_crowding_logs", "recorded_at", "90 days"),
    ("bus_arrival_history", "arrived_at", "90 days"),
    ("traffic_history", "collected_at", "180 days"),
    # subway_arrival_history(A5)는 아직 조회 경로가 없다 — 현재는
    # subway_realtime.py의 도착 판정 로직이 적재만 하는 write-only 상태이고,
    # 모델 docstring(app/models/subway.py)이 밝힌 용도는 "추후 요일별 다이아
    # 정본화(실측 기반 시간표 보정)의 원료"다. lookback 창이 아직 정해지지
    # 않았으므로, 같은 실측 도착 이력 성격의 형제 테이블 bus_arrival_history
    # (마찬가지로 통계 집계 원료, 90일 보존)와 동일한 기간을 보수적 기본값으로
    # 맞춘다.
    ("subway_arrival_history", "arrived_at", "90 days"),
]


async def _purge_table_batched(
    session: AsyncSession, table: str, time_column: str, retention: str
) -> int:
    """table에서 time_column < now() - retention 인 행을 배치로 삭제.

    각 배치 후 commit해 트랜잭션/락 보유 시간을 최소화한다.
    """
    delete_sql = text(
        f"""
        DELETE FROM {table}
        WHERE ctid IN (
            SELECT ctid FROM {table}
            WHERE {time_column} < now() - interval '{retention}'
            LIMIT :batch_size
        )
        """
    )

    total_deleted = 0
    for _ in range(_MAX_BATCHES):
        result = await session.execute(delete_sql, {"batch_size": _BATCH_SIZE})
        await session.commit()
        deleted = result.rowcount or 0
        total_deleted += deleted
        if deleted < _BATCH_SIZE:
            break
    else:
        logger.warning(
            "%s 삭제가 배치 상한(%d회)에 도달 — 다음 실행에서 이어서 정리됨",
            table, _MAX_BATCHES,
        )

    return total_deleted


async def purge_old_logs(session: AsyncSession) -> dict[str, int]:
    """로그 테이블에서 보존기간을 초과한 행을 배치 삭제한다.

    Returns:
        테이블명 → 삭제된 행 수. 그 테이블 정리가 실패했으면 -1.
    """
    summary: dict[str, int] = {}
    for table, time_column, retention in _RETENTION_TARGETS:
        # 테이블 하나가 실패해도 나머지는 정리한다. 예전에는 예외가 그대로 올라와
        # 뒤쪽 테이블이 통째로 건너뛰어졌다 — 마이그레이션이 아직 안 간 환경에서
        # 없는 테이블 하나 때문에 보존정책 전체가 멈추는 식이다.
        try:
            summary[table] = await _purge_table_batched(
                session, table, time_column, retention
            )
        except Exception:
            await session.rollback()
            logger.exception("%s 보존정책 정리 실패 — 나머지 테이블은 계속 진행", table)
            summary[table] = -1

    logger.info("로그 보존정책 정리 완료: %s", summary)
    return summary
