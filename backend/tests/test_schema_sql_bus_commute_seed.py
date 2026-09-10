from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = (REPO_ROOT / "scripts" / "schema.sql").read_text(encoding="utf-8")


def test_schema_sql_seeds_bus_commute_contexts():
    # schema.sql만으로 DB를 새로 띄우면 이 INSERT가 없어서 시간표 화면의
    # 통학 컨텍스트가 통째로 비었다(해당 그룹의 버스가 없어요).
    # bus_commute_contexts는 CREATE TABLE만 있고 시드는
    # prod_migration_20260801_bus_information_sources.sql에만 있었다.
    # prod_migration_20260904_dedupe_hagyo_bus_commute_contexts.sql이
    # 하교 방면 탭을 없애며 시흥33/3401/5602의 부분 여정 중복 3행을 지워
    # 20행에서 17행이 됐다.
    assert "INSERT INTO bus_commute_contexts" in SCHEMA_SQL
    assert SCHEMA_SQL.count("INSERT INTO bus_commute_contexts (id,") == 17


def test_schema_sql_seeds_bus_information_sources():
    # 위 컨텍스트 정리로 딸린 출처 5행(시흥33 1행 + 3401·5602 각 2행)도
    # 함께 지워져 27행에서 22행이 됐다.
    # prod_migration_20260909_realtime_at_boarding_stops.sql 이 3400 기점 관측과
    # 6502 이마트 관측을 새로 넣어 24행이 됐다(3401·5602 는 하류 관측 행을
    # 승차점 행으로 바꾼 것이라 개수가 늘지 않는다).
    # prod_migration_20260910_remove_origin_realtime_source.sql 이 그중 3400 기점
    # 관측 1행을 되돌려 23행이 됐다.
    assert "INSERT INTO bus_information_sources" in SCHEMA_SQL
    assert SCHEMA_SQL.count("INSERT INTO bus_information_sources (id,") == 23


def test_schema_sql_seeds_bus_realtime_targets():
    # 20260909 로 승차점 관측 4건(3400 시흥터미널, 3401/5602/6502 이마트) 추가.
    assert "INSERT INTO bus_realtime_targets" in SCHEMA_SQL
    assert SCHEMA_SQL.count("INSERT INTO bus_realtime_targets (id,") == 18


def test_schema_sql_sets_sequences_for_new_seeded_tables():
    # 예전에 시드 후 setval을 안 해서 다음 INSERT가 이미 쓰인 id와 충돌한 적이
    # 있다(Key (id)=(122) already exists). 세 시퀀스 모두 값을 명시해야 한다.
    assert "SELECT pg_catalog.setval('bus_commute_contexts_id_seq', 20, true);" in SCHEMA_SQL
    assert "SELECT pg_catalog.setval('bus_information_sources_id_seq', 36, true);" in SCHEMA_SQL
    assert "SELECT pg_catalog.setval('bus_realtime_targets_id_seq', 19, true);" in SCHEMA_SQL


def test_schema_sql_bus_stops_sequence_covers_prod_migration_20260801_stops():
    # 224000538 / 224000567 정류장은 prod_migration_20260801_bus_information_sources.sql
    # 로 id 18, 19에 추가됐다. bus_stops_id_seq가 옛 값 17에 머물러 있으면
    # schema.sql로 새로 만든 DB에서 다음 정류장 INSERT가 PK 충돌을 낸다.
    assert "INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (18, '시흥시청역(서울방향)', '224000538'" in SCHEMA_SQL
    assert "INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (19, '이마트(반대편)', '224000567'" in SCHEMA_SQL
    assert "SELECT pg_catalog.setval('bus_stops_id_seq', 19, true);" in SCHEMA_SQL
    assert "SELECT pg_catalog.setval('bus_stops_id_seq', 17, true);" not in SCHEMA_SQL


def test_schema_sql_reflects_20260903_stop_name_and_20_1_source_migration():
    # prod_migration_20260903_stop_name_and_20_1_source.sql이 정류장 17번 이름을
    # "시흥터미널"로 바꾸고 20-1 하교 컨텍스트(context_id=2)의 timetable source를
    # 지웠다. schema.sql 시드는 옛 마이그레이션이 아니라 이 결과 상태를 담아야 한다.
    assert "'한국공학대학교 시흥터미널'" not in SCHEMA_SQL
    assert (
        "INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (17, '시흥터미널', '224000861'"
        in SCHEMA_SQL
    )
    assert (
        "INSERT INTO bus_information_sources (id, context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order) VALUES (18, 2, 'realtime'"
        in SCHEMA_SQL
    )
    assert "context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order) VALUES (17, 2, 'timetable'" not in SCHEMA_SQL


def test_schema_sql_reflects_20260904_dedupe_hagyo_bus_commute_contexts_migration():
    # 하교 화면이 방면 탭 없이 노선당 한 줄(경유지 표기)로 통합되며, 같은 노선이
    # 여러 방면에 중복 노출되던 컨텍스트를 지웠다. 시흥33/3401/5602는 각각
    # 하교에서 더 긴 여정(journey_labels) 쪽 컨텍스트 하나만 남아야 한다.
    assert "'to-jeongwang', '한국공학대학교', '정왕역', '[\"한국공학대학교\", \"정왕역\"]', 30" not in SCHEMA_SQL
    assert "'to-siheung-city-hall', '이마트', '시흥시청역', '[\"이마트\", \"시흥시청역\"]', 20" not in SCHEMA_SQL
    assert "'to-siheung-city-hall', '이마트', '시흥시청역', '[\"이마트\", \"시흥시청역\"]', 30" not in SCHEMA_SQL
    assert (
        "INSERT INTO bus_commute_contexts (id, bus_route_id, group_key, origin_label, destination_label, journey_labels, sort_order) VALUES (4, 2, 'to-siheung-city-hall', '한국공학대학교', '시흥시청역', '[\"한국공학대학교\", \"정왕역\", \"시흥시청역\"]', 10);"
        in SCHEMA_SQL
    )


def _seeded(table: str, columns: str) -> list[str]:
    prefix = f"INSERT INTO {table} ({columns}) VALUES ("
    return [
        line[len(prefix):].rstrip(");")
        for line in SCHEMA_SQL.splitlines()
        if line.startswith(prefix)
    ]


def test_schema_sql_reflects_20260909_realtime_at_boarding_stops_migration():
    """실시간 관측점은 학생이 타는 정류장이어야 한다.

    2026-09-09 이전에는 3400 이 승차점(시흥터미널)이 아니라 하류(이마트)에서,
    3401·5602 는 승차점(이마트)이 아니라 하류(시흥시청 서울방향)에서 관측됐고
    6502 는 관측 자체가 없었다. 하류 관측은 "놓친 버스가 어디쯤 갔는지"를 알려
    줄 뿐 "내 정류장에 언제 오는지"에 답하지 못한다.
    """
    sources = _seeded(
        "bus_information_sources",
        "id, context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order",
    )

    # 화면에 쓰는 실시간 출처에 하류 관측은 남지 않는다.
    assert not [row for row in sources if "'downstream_arrival'" in row]

    # context 5=3400, 7=3401, 9=5602, 10=6502 (전부 하교 서울 방면)
    # stop 17=시흥터미널, 2=이마트
    expected = [
        "2, 5, 'realtime', 'boarding_arrival', 2,",     # 3400 이마트 승차
        "34, 7, 'realtime', 'boarding_arrival', 2,",    # 3401
        "35, 9, 'realtime', 'boarding_arrival', 2,",    # 5602
        "36, 10, 'realtime', 'boarding_arrival', 2,",   # 6502, 예전엔 관측 자체가 없었다
    ]
    for row in expected:
        assert any(seeded.startswith(row) for seeded in sources), row

    targets = _seeded(
        "bus_realtime_targets", "id, bus_route_id, bus_stop_id, travel_direction, enabled"
    )
    # route 1=3400, 7=3401, 11=5602, 6=6502
    for row in ["16, 1, 17,", "17, 7, 2,", "18, 11, 2,", "19, 6, 2,"]:
        assert any(t.startswith(row) and t.endswith("true") for t in targets), row

    # 하류 관측 대상(stop 18)은 꺼져 있어야 한다 — 폴링 한 건이 줄어든다.
    for row in ["5, 7, 18,", "6, 11, 18,"]:
        assert any(t.startswith(row) and t.endswith("false") for t in targets), row


def test_schema_sql_reflects_20260910_remove_origin_realtime_source_migration():
    """기점에는 실시간 출처를 두지 않는다.

    3400 의 기점은 시흥터미널(stop 17, GBIS 224000861)이다. GBIS 가 그 정류장의
    3400 에 대해 내려주는 도착정보는 location_no 가 6, 17 인 차, 즉 아직 들어오고
    있는 차다. 기점에서 출발을 기다리며 서 있는 차가 아니라서 그 숫자는 출발 시각이
    아니다. 기점의 답은 시간표(평일 08:00, 08:30, 09:00, 09:30, 10:00)다.
    """
    sources = _seeded(
        "bus_information_sources",
        "id, context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order",
    )

    origin_realtime = [
        row
        for row in sources
        if row.split(", ")[1] == "5"
        and "'realtime'" in row
        and row.split(", ")[4] == "17"
    ]
    assert not origin_realtime, origin_realtime

    # 시간표는 남는다. 기점에서 학생이 보는 것은 이 쪽이다.
    assert any(
        row.startswith("1, 5, 'timetable', 'departure', 17,") for row in sources
    )
    # 이마트 승차 실시간은 그대로다. 하류가 아니라 승차점이라 답이 맞다.
    assert any(
        row.startswith("2, 5, 'realtime', 'boarding_arrival', 2,") for row in sources
    )

    # 폴링 대상은 건드리지 않는다. 그 정류장은 5200(route 17)과 99-2(route 15)
    # 때문에 어차피 불리고 있어 3400 행을 지워도 API 호출이 줄지 않는다.
    targets = _seeded(
        "bus_realtime_targets", "id, bus_route_id, bus_stop_id, travel_direction, enabled"
    )
    assert any(t.startswith("16, 1, 17,") and t.endswith("true") for t in targets)


def test_schema_sql_marker_and_route_naming_is_consistent():
    """같은 노선은 어느 화면에서나 같은 색과 이름으로 그린다."""
    # 형제 마커가 전부 장소명인데 이것만 노선번호였다.
    assert "'bus_hub_jw_sihwa', 'bus_seoul', '시흥터미널'" in SCHEMA_SQL

    marker_routes = _seeded(
        "map_marker_routes",
        "id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order",
    )
    # 99-2 가 마커마다 다른 색·배지를 달고 있었다.
    for row in [r for r in marker_routes if "'99-2'" in r]:
        assert "'#0891B2'" in row, row
        assert "'L'" not in row, row
    # 5602 는 목록에서 파랑인데 지도에서만 빨강이었다.
    for row in [r for r in marker_routes if "'5602'" in r]:
        assert "'#2563EB'" in row, row
    # 5200 은 노선만 추가되고 마커 연결이 빠져 지도에 안 떴다.
    assert any("'5200'" in row for row in marker_routes)
    # 강남역 마커의 3400 inbound 가 gbis id 없는 stop 1 을 가리켰다.
    assert not any("'3400'" in row and ", 6, 1, " in row for row in marker_routes)


def test_schema_sql_20_1_destination_matches_the_actual_terminus():
    """20-1 의 정류장 목록에 '아이파크아파트' 는 없다.

    한국공학대(#137) 에서 정왕역 방향으로 타면 이마트 · 시흥세무서 다음이
    정왕역(#140) 종점이다.
    """
    assert "'아이파크아파트방면'" not in SCHEMA_SQL
    assert "VALUES (3, '20-1', '시흥20-1번', '정왕역 방면'" in SCHEMA_SQL
