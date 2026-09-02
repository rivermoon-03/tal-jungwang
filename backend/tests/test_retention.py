"""로그성 테이블 보존정책(retention.py) — subway_arrival_history 누락 회귀 테스트.

subway_arrival_history가 _RETENTION_TARGETS에서 빠져 있으면 나이틀리 정리
대상에서 제외되어 무한히 쌓인다. 대상 목록 구성과 보존기간 값을 확인한다.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import retention


def test_subway_arrival_history가_보존_대상에_포함된다():
    tables = [target[0] for target in retention._RETENTION_TARGETS]
    assert "subway_arrival_history" in tables


def test_subway_arrival_history의_시각_컬럼과_보존기간은_arrived_at_90일이다():
    """형제 테이블 bus_arrival_history와 동일한 lookback 근거(90일)를 따른다."""
    target = next(
        t for t in retention._RETENTION_TARGETS if t[0] == "subway_arrival_history"
    )
    assert target == ("subway_arrival_history", "arrived_at", "90 days")


def test_기존_3개_테이블도_여전히_대상에_남아있다():
    tables = [target[0] for target in retention._RETENTION_TARGETS]
    assert tables == [
        "bus_crowding_logs",
        "bus_arrival_history",
        "traffic_history",
        "subway_arrival_history",
    ]


@pytest.mark.asyncio
async def test_purge_old_logs는_subway_arrival_history_결과도_요약에_담는다():
    """purge_old_logs가 4개 테이블 모두에 대해 배치 삭제를 호출하고
    반환 요약에 subway_arrival_history 키가 포함되는지 확인한다."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.execute.return_value.rowcount = 0
    session.commit = AsyncMock()

    summary = await retention.purge_old_logs(session)

    assert set(summary.keys()) == {
        "bus_crowding_logs",
        "bus_arrival_history",
        "traffic_history",
        "subway_arrival_history",
    }
    assert summary["subway_arrival_history"] == 0


@pytest.mark.asyncio
async def test_한_테이블이_실패해도_나머지는_정리한다():
    """마이그레이션이 아직 안 간 환경에서 없는 테이블 하나 때문에 보존정책
    전체가 멈추면 안 된다. 실패한 테이블만 -1 로 표시하고 나머지는 진행한다."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()

    calls: list[str] = []

    async def execute(sql, params=None):
        stmt = str(sql)
        calls.append(stmt)
        if "traffic_history" in stmt:
            raise RuntimeError('relation "traffic_history" does not exist')
        result = MagicMock()
        result.rowcount = 0
        return result

    session.execute = AsyncMock(side_effect=execute)

    summary = await retention.purge_old_logs(session)

    assert summary["traffic_history"] == -1
    assert summary["bus_crowding_logs"] == 0
    assert summary["bus_arrival_history"] == 0
    # 실패한 테이블 뒤에 오는 것도 건너뛰지 않는다.
    assert summary["subway_arrival_history"] == 0
    assert session.rollback.await_count == 1
