"""subway direction CHECK 제약에 서해선 방향값 추가

Revision ID: 0003_subway_direction_seohaeson
Revises: 0002_add_more_tables
Create Date: 2026-04-14
"""
from alembic import op

revision = "0003_subway_direction_seohaeson"
down_revision = "0002_add_more_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(
        "subway_timetable_entries_direction_check",
        "subway_timetable_entries",
    )
    op.create_check_constraint(
        "subway_timetable_entries_direction_check",
        "subway_timetable_entries",
        "direction = ANY (ARRAY["
        "'up','down','line4_up','line4_down',"
        "'choji_up','choji_dn','siheung_up','siheung_dn'"
        "])",
    )


def downgrade() -> None:
    op.drop_constraint(
        "subway_timetable_entries_direction_check",
        "subway_timetable_entries",
    )
    op.create_check_constraint(
        "subway_timetable_entries_direction_check",
        "subway_timetable_entries",
        "direction = ANY (ARRAY['up','down','line4_up','line4_down'])",
    )
