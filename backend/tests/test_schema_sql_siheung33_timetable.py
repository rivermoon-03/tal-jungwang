"""시흥33 은 시간표 없이 실시간만으로 답한다.

발행 시간표가 없는 노선인데 bus_timetable_entries 에 하교 평일 60건이 정적으로
들어 있었다. 2026-04-20 공지가 밝힌 대로 그 값의 출처는 이 앱 자신이다 —
관측한 도착 기록을 시간표 표에 굳혀 넣은 것이고 다섯 달째 갱신되지 않았다.
앱의 정보 출처 모델도 이 노선에 시간표 출처를 두지 않는데 상세 시트만 이 표를
직접 읽어, 유도한 값을 확정 시각표처럼 보여주고 있었다.
"""
from __future__ import annotations

import pathlib
import re

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SCHEMA_SQL = (REPO_ROOT / "scripts" / "schema.sql").read_text(encoding="utf-8")
MIGRATION = (
    REPO_ROOT / "scripts" / "prod_migration_20260910_drop_siheung33_timetable.sql"
).read_text(encoding="utf-8")

# schema.sql 시드에서 시흥33 의 route id.
SIHEUNG33_ROUTE_ID = 2

_TIMETABLE_ROW = re.compile(
    r"^INSERT INTO bus_timetable_entries "
    r"\(id, route_id, stop_id, day_type, departure_time, note\) VALUES \((\d+), (\d+), ",
    re.MULTILINE,
)


def test_시흥33_route_id_가_2_다():
    """아래 검사들이 옳은 노선을 보고 있는지 먼저 고정한다."""
    assert (
        f"VALUES ({SIHEUNG33_ROUTE_ID}, '시흥33'" in SCHEMA_SQL
        or f"({SIHEUNG33_ROUTE_ID}, '시흥33'," in SCHEMA_SQL
    )


def test_schema_sql_에_시흥33_시간표_행이_없다():
    route_ids = [int(m.group(2)) for m in _TIMETABLE_ROW.finditer(SCHEMA_SQL)]
    assert route_ids, "시간표 시드 자체가 사라졌다면 파싱이 깨진 것이다"
    assert SIHEUNG33_ROUTE_ID not in route_ids


def test_다른_노선_시간표는_남아_있다():
    """이 정리가 시간표 시드 전체를 지운 것이 아님을 확인한다."""
    route_ids = {int(m.group(2)) for m in _TIMETABLE_ROW.finditer(SCHEMA_SQL)}
    assert len(route_ids) >= 3


def test_시흥33_실시간_출처는_그대로다():
    """시간표만 걷어내고 실시간은 건드리지 않는다."""
    assert "'realtime', 'boarding_arrival'" in SCHEMA_SQL
    # 마이그레이션이 실시간 쪽 표를 건드리지 않는다.
    assert "bus_realtime_targets" not in _statements(MIGRATION)
    assert "bus_information_sources" not in _statements(MIGRATION)


def test_마이그레이션은_트랜잭션이고_시간표만_지운다():
    body = _statements(MIGRATION)
    assert "BEGIN;" in MIGRATION and "COMMIT;" in MIGRATION
    assert "DELETE FROM bus_timetable_entries" in body
    assert "'시흥33'" in body
    # 다른 노선을 함께 지우지 않는다.
    for other in ("'시흥1'", "'20-1'", "'11-A'", "'5200'", "'99-2'", "'3400'"):
        assert other not in body, f"{other} 까지 지우고 있다"
    # 삽입이나 갱신은 없다.
    assert "INSERT" not in body.upper()
    assert "UPDATE" not in body.upper()


def _statements(sql: str) -> str:
    """주석을 뺀 실제 실행문만 남긴다."""
    return "\n".join(
        line for line in sql.splitlines() if not line.strip().startswith("--")
    )
