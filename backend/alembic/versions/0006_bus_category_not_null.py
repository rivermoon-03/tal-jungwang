"""bus_routes.category NOT NULL (after backfill)

Revision ID: 0006_bus_category_not_null
Revises: 0005_bus_category_sub_name
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa


revision = "0006_bus_category_not_null"
down_revision = "0005_bus_category_sub_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 안전장치: 누락된 row가 있으면 '기타'로 채움 (Phase 2/3/6 백필 후여야 함)
    op.execute("UPDATE bus_routes SET category='기타' WHERE category IS NULL")
    op.alter_column("bus_routes", "category", existing_type=sa.String(length=20), nullable=False)


def downgrade() -> None:
    op.alter_column("bus_routes", "category", existing_type=sa.String(length=20), nullable=True)
