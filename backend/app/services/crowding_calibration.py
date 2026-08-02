"""노선별 혼잡도 표시 보정.

GBIS `crowded` 가 현장과 어긋나는 조합이 있다. 시흥1 하교는 이마트 도착 시점에 이미
만차인데 GBIS 는 17시 91.2%, 18시 98.0% 를 값 1로 준다(2026-08-02 프로덕션 확인).
어떤 임계값도 1을 혼잡으로 만들 수 없으므로 표시 하한을 DB에 두고 표시 시점에만
적용한다. 원천 로그와 사전집계는 건드리지 않는다.

이 값은 센서 관측이 아니라 사람이 넣은 단언이다. 그대로 섞으면 관측값인 척하게 되므로
보정이 실제로 값을 올린 경우에만 `estimated=True` 를 돌려주고, 화면이 출처를 구분해
표기한다. `reason` 은 DB에서 NOT NULL 이라 왜 넣었는지가 남는다.

설계: docs/superpowers/specs/2026-08-02-bus-crowding-thresholds-design.md §5
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bus import BusCrowdingCalibration

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CalibrationRule:
    """`bus_stop_id`/`day_type` 이 None 이면 해당 축 전체에 적용한다."""

    route_id: int
    stop_id: int | None
    day_type: str | None
    hour_from: int
    hour_to: int
    min_level: int
    reason: str

    def matches(self, *, route_id: int, stop_id: int | None, day_type: str | None, hour: int) -> bool:
        if self.route_id != route_id:
            return False
        if self.stop_id is not None and self.stop_id != stop_id:
            return False
        if self.day_type is not None and self.day_type != day_type:
            return False
        # 양끝 포함 — 16~19 는 19:59 까지를 뜻한다.
        return self.hour_from <= hour <= self.hour_to


async def load_calibrations(db: AsyncSession) -> list[CalibrationRule]:
    """전체 보정 규칙을 읽는다. 규칙 수가 한 자릿수라 필터 없이 전부 가져온다.

    테이블이 아직 없는 배포(마이그레이션 미적용) 에서도 혼잡도 조회가 죽으면 안 되므로
    조회 실패는 "보정 없음"으로 떨어뜨린다. `crowding_flow._compute_from_precomputed`
    와 같은 방식이다.
    """
    try:
        rows = (await db.execute(select(BusCrowdingCalibration))).scalars().all()
    except (ProgrammingError, DBAPIError) as exc:
        logger.warning("bus_crowding_calibrations 조회 실패, 보정 없이 진행: %s", exc)
        await db.rollback()
        return []

    return [
        CalibrationRule(
            route_id=row.bus_route_id,
            stop_id=row.bus_stop_id,
            day_type=row.day_type,
            hour_from=row.hour_from,
            hour_to=row.hour_to,
            min_level=row.min_level,
            reason=row.reason,
        )
        for row in rows
    ]


def apply_calibration(
    level: int | None,
    rules: list[CalibrationRule],
    *,
    route_id: int,
    stop_id: int | None,
    day_type: str | None,
    hour: int,
) -> tuple[int | None, bool]:
    """관측 등급에 표시 하한을 적용한다 → `(표시 등급, estimated)`.

    하한이지 대입이 아니다 — 관측값이 이미 하한 이상이면 그대로 둔다. 관측 자체가
    없으면(None) 보정도 하지 않는다. 없는 값을 지어내는 것과 낮게 나온 값을 끌어올리는
    것은 다른 일이다.
    """
    if level is None:
        return None, False

    matched = [
        r.min_level
        for r in rules
        if r.matches(route_id=route_id, stop_id=stop_id, day_type=day_type, hour=hour)
    ]
    if not matched:
        return level, False

    floor = max(matched)
    if floor <= level:
        return level, False
    return floor, True
