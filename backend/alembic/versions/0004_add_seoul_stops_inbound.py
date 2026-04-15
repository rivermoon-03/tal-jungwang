"""3400/6502 서울쪽 정류장 및 강남→시화 / 사당→이마트 inbound 시간표 추가

Revision ID: 0004_add_seoul_stops_inbound
Revises: 0003_subway_direction_seohaeson
Create Date: 2026-04-15
"""
from alembic import op


revision = "0004_add_seoul_stops_inbound"
down_revision = "0003_subway_direction_seohaeson"
branch_labels = None
depends_on = None


# 3400 평일 강남 → 시화 (평일 표의 `강남역` 컬럼 순서대로)
_3400_GANGNAM_WEEKDAY = [
    "07:00", "07:30", "07:55", "08:15", "08:30", "08:50", "09:15", "09:40", "10:10",
    "10:35", "11:00", "11:30", "11:55", "12:20", "12:45", "13:10", "13:35", "14:00",
    "14:25", "14:50", "15:20", "15:45", "16:10", "16:40", "17:05", "17:30", "17:55",
    "18:20", "18:45", "19:10", "19:40", "20:10", "20:35", "21:00", "21:25", "21:50",
    "22:15", "22:40", "23:05", "23:30", "23:50", "00:10", "00:30",
]

# 3400 평일 사당역 14번 출구 전세버스 2편
_3400_SADANG_WEEKDAY_CHARTER = ["19:00", "19:30"]

# 6502 평일 사당역 14번 출구 → 이마트
_6502_SADANG_WEEKDAY = [
    "06:00", "06:30", "06:55",
    "07:20", "07:35", "07:50",
    "08:10", "08:50",
    "09:10", "09:30", "09:50",
    "10:10", "10:35",
    "11:05", "11:30",
    "12:00", "12:30",
    "13:00", "13:30",
    "14:00", "14:30",
    "15:30",
    "16:10", "16:40",
    "17:15", "17:40",
    "18:00", "18:20", "18:35",
    "19:05", "19:35",
    "20:00", "20:25", "20:55",
    "21:25", "21:50",
    "22:20", "22:50",
    "23:20",
]

# 6502 토·일·공휴일 사당역 14번 출구 → 이마트
_6502_SADANG_HOLIDAY = [
    "06:30",
    "07:10", "07:50",
    "08:30",
    "09:10", "09:55",
    "10:35",
    "11:10", "11:40",
    "12:10", "12:50",
    "13:30",
    "14:10", "14:50",
    "15:30",
    "16:05", "16:45",
    "17:25",
    "18:05", "18:40",
    "19:15", "19:55",
    "20:35",
    "21:15", "21:55",
    "22:35",
    "23:05", "23:30",
]


def _quote_time(t: str) -> str:
    return f"'{t}'"


def upgrade() -> None:
    # ── 1. 서울쪽 정류장 2개 INSERT (이미 있으면 건너뜀) ──────────────
    op.execute(
        """
        INSERT INTO bus_stops (name, gbis_station_id, lat, lng) VALUES
          ('사당역 14번 출구',      NULL, 37.476654, 126.982610),
          ('강남역 3400 정류장',    NULL, 37.498427, 127.029829)
        ON CONFLICT DO NOTHING;
        """
    )

    # ── 2. bus_stop_routes (정류장 ↔ 노선 연결) ──────────────────────
    op.execute(
        """
        INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
        SELECT s.id, r.id FROM bus_stops s, bus_routes r
        WHERE (s.name = '사당역 14번 출구'   AND r.route_number = '6502')
           OR (s.name = '사당역 14번 출구'   AND r.route_number = '3400')
           OR (s.name = '강남역 3400 정류장' AND r.route_number = '3400')
        ON CONFLICT DO NOTHING;
        """
    )

    # ── 3. 시간표 INSERT ──────────────────────────────────────────────

    # 3400 평일 강남 → 시화
    vals_3400_gn = ", ".join(f"({_quote_time(t)})" for t in _3400_GANGNAM_WEEKDAY)
    op.execute(
        f"""
        INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
        SELECT r.id, s.id, 'weekday', t.dt::TIME
        FROM bus_routes r, bus_stops s,
             (VALUES {vals_3400_gn}) AS t(dt)
        WHERE r.route_number = '3400'
          AND s.name = '강남역 3400 정류장';
        """
    )

    # 3400 평일 사당 전세버스 2편 (note='전세버스')
    vals_3400_sd = ", ".join(f"({_quote_time(t)})" for t in _3400_SADANG_WEEKDAY_CHARTER)
    op.execute(
        f"""
        INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time, note)
        SELECT r.id, s.id, 'weekday', t.dt::TIME, '전세버스'
        FROM bus_routes r, bus_stops s,
             (VALUES {vals_3400_sd}) AS t(dt)
        WHERE r.route_number = '3400'
          AND s.name = '사당역 14번 출구';
        """
    )

    # 6502 평일 사당 → 이마트
    vals_6502_wd = ", ".join(f"({_quote_time(t)})" for t in _6502_SADANG_WEEKDAY)
    op.execute(
        f"""
        INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
        SELECT r.id, s.id, 'weekday', t.dt::TIME
        FROM bus_routes r, bus_stops s,
             (VALUES {vals_6502_wd}) AS t(dt)
        WHERE r.route_number = '6502'
          AND s.name = '사당역 14번 출구';
        """
    )

    # 6502 토·일·공휴일 사당 → 이마트
    vals_6502_hd = ", ".join(f"({_quote_time(t)})" for t in _6502_SADANG_HOLIDAY)
    op.execute(
        f"""
        INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
        SELECT r.id, s.id, d.day_type, t.dt::TIME
        FROM bus_routes r, bus_stops s,
             (VALUES ('saturday'), ('sunday')) AS d(day_type),
             (VALUES {vals_6502_hd}) AS t(dt)
        WHERE r.route_number = '6502'
          AND s.name = '사당역 14번 출구';
        """
    )


def downgrade() -> None:
    # 새로 추가한 시간표 엔트리 제거 → 정류장 ↔ 노선 연결 제거 → 정류장 제거
    op.execute(
        """
        DELETE FROM bus_timetable_entries
        WHERE stop_id IN (
            SELECT id FROM bus_stops
            WHERE name IN ('사당역 14번 출구', '강남역 3400 정류장')
        );
        """
    )
    op.execute(
        """
        DELETE FROM bus_stop_routes
        WHERE bus_stop_id IN (
            SELECT id FROM bus_stops
            WHERE name IN ('사당역 14번 출구', '강남역 3400 정류장')
        );
        """
    )
    op.execute(
        """
        DELETE FROM bus_stops
        WHERE name IN ('사당역 14번 출구', '강남역 3400 정류장');
        """
    )
