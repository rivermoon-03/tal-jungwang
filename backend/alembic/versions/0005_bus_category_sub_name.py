"""bus_routes.category, bus_stops.sub_name (nullable)

Revision ID: 0005_bus_category_sub_name
Revises: 0004_add_seoul_stops_inbound
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa


revision = "0005_bus_category_sub_name"
down_revision = "0004_add_seoul_stops_inbound"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bus_routes", sa.Column("category", sa.String(length=20), nullable=True))
    op.add_column("bus_stops", sa.Column("sub_name", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("bus_stops", "sub_name")
    op.drop_column("bus_routes", "category")
