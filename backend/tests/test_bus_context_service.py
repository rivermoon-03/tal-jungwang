from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.bus import BusCommuteContext, BusInformationSource, BusRoute, BusStop
from app.services.bus_context import get_commute_contexts


@pytest.mark.asyncio
async def test_get_commute_contexts_serializes_each_information_station():
    route = BusRoute(id=1, route_number="3400", category="하교", route_name=None)
    terminal = BusStop(
        id=17, name="한국공학대학교 시흥터미널", sub_name=None,
        gbis_station_id="224000861", lat=Decimal("37.1"), lng=Decimal("126.1"),
    )
    emart = BusStop(
        id=2, name="이마트", sub_name=None,
        gbis_station_id="224000513", lat=Decimal("37.2"), lng=Decimal("126.2"),
    )
    context = BusCommuteContext(
        id=1, bus_route_id=1, group_key="to-seoul",
        origin_label="시흥터미널", destination_label="강남역",
        journey_labels=["시흥터미널", "이마트", "강남역"], sort_order=1,
    )
    context.route = route
    context.sources = [
        BusInformationSource(
            id=1, context_id=1, source_type="timetable", source_role="departure",
            bus_stop_id=17, display_label="시흥터미널 출발",
            travel_direction="to-seoul", sort_order=1, stop=terminal,
        ),
        BusInformationSource(
            id=2, context_id=1, source_type="realtime", source_role="boarding_arrival",
            bus_stop_id=2, display_label="이마트 도착",
            travel_direction="to-seoul", sort_order=2, stop=emart,
        ),
    ]
    scalars = MagicMock()
    scalars.all.return_value = [context]
    result = MagicMock()
    result.scalars.return_value = scalars
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)

    contexts = await get_commute_contexts(db, category="하교", group_key="to-seoul")

    assert contexts[0].route_number == "3400"
    assert contexts[0].journey_labels == ["시흥터미널", "이마트", "강남역"]
    assert [(source.type, source.stop_id) for source in contexts[0].sources] == [
        ("timetable", 17),
        ("realtime", 2),
    ]
