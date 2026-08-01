import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bus import BusCommuteContext, BusInformationSource
from app.schemas.bus import BusCommuteContextResponse, BusInformationSourceResponse


BOARDING_SOURCE_ROLES = {"departure", "boarding_arrival"}
BOARDING_LABEL_SUFFIX = re.compile(r"\s+(?:출발|도착)$")


def _normalize_source_display_label(source_role: str, display_label: str) -> str:
    """승차 지점 정보는 정보 방식과 무관하게 같은 용어로 표시한다."""
    if source_role not in BOARDING_SOURCE_ROLES:
        return display_label

    station_label = BOARDING_LABEL_SUFFIX.sub("", display_label).rstrip()
    if station_label == display_label:
        return display_label
    return f"{station_label} 승차"


async def get_commute_contexts(
    db: AsyncSession,
    *,
    category: str,
    group_key: str,
) -> list[BusCommuteContextResponse]:
    """통학 여정과 정보가 관측되는 정류장을 함께 반환한다."""
    stmt = (
        select(BusCommuteContext)
        .options(
            selectinload(BusCommuteContext.route),
            selectinload(BusCommuteContext.sources).selectinload(BusInformationSource.stop),
        )
        .join(BusCommuteContext.route)
        .where(
            BusCommuteContext.group_key == group_key,
            BusCommuteContext.route.has(category=category),
        )
        .order_by(BusCommuteContext.sort_order, BusCommuteContext.id)
    )
    contexts = (await db.execute(stmt)).scalars().all()

    return [
        BusCommuteContextResponse(
            id=context.id,
            route_id=context.bus_route_id,
            route_number=context.route.route_number,
            category=context.route.category,
            group_key=context.group_key,
            origin_label=context.origin_label,
            destination_label=context.destination_label,
            journey_labels=context.journey_labels,
            sources=[
                BusInformationSourceResponse(
                    id=source.id,
                    type=source.source_type,
                    role=source.source_role,
                    stop_id=source.bus_stop_id,
                    station_label=source.stop.name,
                    display_label=_normalize_source_display_label(
                        source.source_role,
                        source.display_label,
                    ),
                    travel_direction=source.travel_direction,
                )
                for source in context.sources
            ],
        )
        for context in contexts
    ]
