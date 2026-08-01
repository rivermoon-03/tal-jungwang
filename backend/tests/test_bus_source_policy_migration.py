from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
CORRECTION_SQL = (
    REPO_ROOT / "scripts" / "prod_migration_20260801_bus_source_policy_corrections.sql"
).read_text(encoding="utf-8")
INITIAL_SQL = (
    REPO_ROOT / "scripts" / "prod_migration_20260801_bus_information_sources.sql"
).read_text(encoding="utf-8")


def test_correction_keeps_raw_timetables_but_removes_unverified_product_sources():
    assert "DELETE FROM bus_information_sources" in CORRECTION_SQL
    assert "route.route_number IN ('시흥1', '시흥33')" in CORRECTION_SQL
    assert "source.source_type = 'timetable'" in CORRECTION_SQL
    assert "DELETE FROM bus_timetable_entries" not in CORRECTION_SQL


def test_99_2_wolgot_context_and_both_realtime_stops_are_seeded():
    for sql in (INITIAL_SQL, CORRECTION_SQL):
        assert "'99-2'" in sql
        assert "'to-wolgot'" in sql
        assert "'224000861'" in sql
        assert "'224000513'" in sql


def test_siheung_33_city_hall_context_uses_school_boarding_realtime():
    expected = (
        "'시흥33','to-siheung-city-hall','realtime','boarding_arrival',"
        "'224000639','한국공학대학교 도착'"
    )
    assert expected in CORRECTION_SQL
