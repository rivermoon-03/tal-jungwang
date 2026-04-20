"""add_destinations_table

Revision ID: 20260421_dest
Revises:
Create Date: 2026-04-21
"""
from alembic import op
import sqlalchemy as sa


revision = "20260421_dest"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "destinations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(30), nullable=False),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("lat", sa.Numeric(9, 6), nullable=True),
        sa.Column("lng", sa.Numeric(9, 6), nullable=True),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("code", name="uq_destinations_code"),
    )


def downgrade() -> None:
    op.drop_table("destinations")
