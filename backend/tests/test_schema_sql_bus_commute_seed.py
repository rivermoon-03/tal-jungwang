from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = (REPO_ROOT / "scripts" / "schema.sql").read_text(encoding="utf-8")


def test_schema_sql_seeds_bus_commute_contexts():
    # schema.sql만으로 DB를 새로 띄우면 이 INSERT가 없어서 시간표 화면의
    # 통학 컨텍스트가 통째로 비었다(해당 그룹의 버스가 없어요).
    # bus_commute_contexts는 CREATE TABLE만 있고 시드는
    # prod_migration_20260801_bus_information_sources.sql에만 있었다.
    assert "INSERT INTO bus_commute_contexts" in SCHEMA_SQL
    assert SCHEMA_SQL.count("INSERT INTO bus_commute_contexts (id,") == 20


def test_schema_sql_seeds_bus_information_sources():
    assert "INSERT INTO bus_information_sources" in SCHEMA_SQL
    assert SCHEMA_SQL.count("INSERT INTO bus_information_sources (id,") == 27


def test_schema_sql_seeds_bus_realtime_targets():
    assert "INSERT INTO bus_realtime_targets" in SCHEMA_SQL
    assert SCHEMA_SQL.count("INSERT INTO bus_realtime_targets (id,") == 14


def test_schema_sql_sets_sequences_for_new_seeded_tables():
    # 예전에 시드 후 setval을 안 해서 다음 INSERT가 이미 쓰인 id와 충돌한 적이
    # 있다(Key (id)=(122) already exists). 세 시퀀스 모두 값을 명시해야 한다.
    assert "SELECT pg_catalog.setval('bus_commute_contexts_id_seq', 20, true);" in SCHEMA_SQL
    assert "SELECT pg_catalog.setval('bus_information_sources_id_seq', 32, true);" in SCHEMA_SQL
    assert "SELECT pg_catalog.setval('bus_realtime_targets_id_seq', 15, true);" in SCHEMA_SQL


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
    # "시화터미널"로 바꾸고 20-1 하교 컨텍스트(context_id=2)의 timetable source를
    # 지웠다. schema.sql 시드는 옛 마이그레이션이 아니라 이 결과 상태를 담아야 한다.
    assert "'한국공학대학교 시흥터미널'" not in SCHEMA_SQL
    assert (
        "INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (17, '시화터미널', '224000861'"
        in SCHEMA_SQL
    )
    assert (
        "INSERT INTO bus_information_sources (id, context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order) VALUES (18, 2, 'realtime'"
        in SCHEMA_SQL
    )
    assert "context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order) VALUES (17, 2, 'timetable'" not in SCHEMA_SQL
