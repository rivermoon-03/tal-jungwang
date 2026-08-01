"""통학 버스 정보 source 모델 계약 테스트."""

from app.models import bus as bus_models


def test_bus_information_source_models_exist():
    assert hasattr(bus_models, "BusCommuteContext")
    assert hasattr(bus_models, "BusInformationSource")
    assert hasattr(bus_models, "BusRealtimeTarget")


def test_information_source_keeps_timetable_and_realtime_stops_separate():
    context = bus_models.BusCommuteContext(
        bus_route_id=1,
        group_key="to-seoul",
        origin_label="시흥터미널",
        destination_label="강남역",
        journey_labels=["시흥터미널", "이마트", "강남역"],
    )
    context.sources = [
        bus_models.BusInformationSource(
            source_type="timetable",
            source_role="departure",
            bus_stop_id=17,
            display_label="시흥터미널 승차",
            travel_direction="to-seoul",
        ),
        bus_models.BusInformationSource(
            source_type="realtime",
            source_role="downstream_arrival",
            bus_stop_id=2,
            display_label="이마트 도착",
            travel_direction="to-seoul",
        ),
    ]

    assert context.sources[0].bus_stop_id == 17
    assert context.sources[1].bus_stop_id == 2
    assert context.sources[0].source_type == "timetable"
    assert context.sources[1].source_type == "realtime"


def test_realtime_target_requires_explicit_travel_direction():
    target = bus_models.BusRealtimeTarget(
        bus_route_id=7,
        bus_stop_id=18,
        travel_direction="to-seoul",
        enabled=True,
    )

    assert target.travel_direction == "to-seoul"
    assert target.enabled is True
