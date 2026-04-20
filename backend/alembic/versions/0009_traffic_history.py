"""traffic_history table

Revision ID: 0009_traffic_history
Revises: 1c6938e66d31
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0009_traffic_history"
down_revision = "1c6938e66d31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "traffic_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("road_name", sa.String(50), nullable=False),
        sa.Column("direction", sa.String(15), nullable=False),
        sa.Column("speed", sa.Numeric(5, 1), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("distance_meters", sa.Integer(), nullable=False),
        sa.Column("congestion", sa.SmallInteger(), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("direction IN ('to_station', 'to_school')", name="ck_traffic_direction"),
        sa.CheckConstraint("congestion BETWEEN 1 AND 4", name="ck_traffic_congestion"),
    )
    op.create_index("idx_traffic_road_dir_time", "traffic_history",
                    ["road_name", "direction", "collected_at"])
    op.create_index("idx_traffic_collected_at", "traffic_history", ["collected_at"])


def downgrade() -> None:
    op.drop_index("idx_traffic_collected_at", "traffic_history")
    op.drop_index("idx_traffic_road_dir_time", "traffic_history")
    op.drop_table("traffic_history")
