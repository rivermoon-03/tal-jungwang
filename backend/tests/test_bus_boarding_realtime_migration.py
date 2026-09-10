from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = (
    REPO_ROOT / "scripts" / "prod_migration_20260909_realtime_at_boarding_stops.sql"
)
SQL = MIGRATION_PATH.read_text(encoding="utf-8")

# 위 마이그레이션이 3400 기점(시흥터미널)까지 실시간 출처로 등록한 것을 되돌린다.
REMOVAL_PATH = (
    REPO_ROOT / "scripts" / "prod_migration_20260910_remove_origin_realtime_source.sql"
)
REMOVAL_SQL = REMOVAL_PATH.read_text(encoding="utf-8")


def test_migration_runs_as_one_transaction():
    for sql in (SQL, REMOVAL_SQL):
        assert sql.count("BEGIN;") == 1
        assert sql.count("COMMIT;") == 1


def test_migration_never_touches_raw_timetable_or_history():
    """원천 데이터는 건드리지 않는다.

    이 마이그레이션이 바꾸는 것은 "어디를 관측하고 무엇을 화면에 쓰는가" 뿐이다.
    bus_timetable_entries 와 도착·혼잡 이력은 통계의 원료라 손대지 않는다.
    """
    for table in (
        "bus_timetable_entries",
        "bus_arrival_history",
        "bus_crowding_logs",
        "bus_arrival_stats",
    ):
        for sql in (SQL, REMOVAL_SQL):
            assert f"DELETE FROM {table}" not in sql
            assert f"UPDATE {table}" not in sql


def test_realtime_targets_move_to_boarding_stops():
    """3400 은 기점 정류장, 3401·5602·6502 는 이마트에서 관측한다."""
    for row in (
        "('3400', '224000861', 'to-seoul')",
        "('3401', '224000513', 'to-seoul')",
        "('5602', '224000513', 'to-seoul')",
        "('6502', '224000513', 'to-seoul')",
    ):
        assert row in SQL, row

    # 하류 관측(시흥시청 서울방향)은 끈다. 화면에 닿는 경로가 없고 폴링만 든다.
    assert "SET enabled = FALSE" in SQL
    assert "stop.gbis_station_id = '224000538'" in SQL


def test_downstream_sources_are_replaced_not_kept_alongside():
    """같은 컨텍스트에 하류 관측과 승차 관측이 함께 남으면 대표값 선택이 흔들린다."""
    assert "source.source_role = 'downstream_arrival'" in SQL
    assert "DELETE FROM bus_information_sources" in SQL
    assert "'realtime', 'boarding_arrival'" in SQL


def test_seed_labels_follow_source_role_copy_contract():
    """승차 지점 출처는 '○○ 승차' 로 쓴다(20260801 boarding_labels 계약)."""
    # 줄 끝 주석에도 "승차" 가 들어갈 수 있어 코드 부분만 본다.
    seed_lines = [
        line.split("--")[0].strip()
        for line in SQL.splitlines()
        if line.lstrip().startswith("('")
    ]
    labelled = [line for line in seed_lines if "승차" in line or "도착" in line]
    assert labelled, "라벨이 붙은 시드 행이 있어야 한다"
    for line in labelled:
        assert " 승차'" in line, line
        assert " 도착'" not in line, line


def test_marker_naming_and_route_colors_are_unified():
    # 형제 마커가 전부 장소명인데 이것만 노선번호였다.
    assert "SET display_name = '시화터미널'" in SQL
    assert "marker_key = 'bus_hub_jw_sihwa'" in SQL
    # 같은 노선이 마커마다 다른 색을 쓰던 것을 하나로 맞춘다.
    assert "route_number = '99-2'" in SQL
    assert "route_number = '5602'" in SQL
    # 5200 은 노선만 추가되고 마커 연결이 빠져 지도에 안 떴다.
    assert "'5200'" in SQL


def test_20_1_destination_is_corrected():
    assert "direction_name = '정왕역 방면'" in SQL
    assert "direction_name = '아이파크아파트방면'" in SQL  # WHERE 조건(재실행 안전)


def test_migration_is_rerunnable():
    """같은 파일을 두 번 돌려도 깨지지 않아야 한다."""
    assert SQL.count("ON CONFLICT") >= 2
    assert "NOT EXISTS" in SQL


def test_origin_stop_has_no_realtime_source_after_removal():
    """3400 기점에는 실시간 출처를 두지 않는다.

    20260909 는 3400 기점(시흥터미널, GBIS 224000861)까지 실시간 출처로 넣었다.
    GBIS 가 그 정류장의 3400 에 대해 내려주는 도착정보는 location_no 가 6, 17 인
    차, 즉 아직 6정거장·17정거장 떨어져 들어오고 있는 차다. 기점에서 출발을
    기다리며 서 있는 차가 아니라서 그 숫자는 출발 시각이 아니다. 기점의 답은
    시간표다.
    """
    assert "DELETE FROM bus_information_sources" in REMOVAL_SQL
    assert "source.source_type = 'realtime'" in REMOVAL_SQL
    assert "stop.gbis_station_id = '224000861'" in REMOVAL_SQL
    assert "route.route_number = '3400'" in REMOVAL_SQL
    assert "route.category = '하교'" in REMOVAL_SQL


def test_removal_leaves_realtime_targets_alone():
    """그 정류장은 5200·99-2 때문에 어차피 폴링된다. 대상을 지워도 호출이 안 준다."""
    assert "DELETE FROM bus_realtime_targets" not in REMOVAL_SQL
    assert "UPDATE bus_realtime_targets" not in REMOVAL_SQL


def test_removal_keeps_the_emart_boarding_source():
    """이마트는 하류가 아니라 승차점이라 실시간이 여전히 맞는 답을 준다."""
    assert "224000513" not in REMOVAL_SQL

    statements = REMOVAL_SQL.split("BEGIN;")[1].split("COMMIT;")[0]
    assert statements.count("DELETE") == 1
    assert "INSERT" not in statements
    assert "UPDATE" not in statements
