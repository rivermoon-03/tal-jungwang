"""map_markers + map_marker_routes + seed

Revision ID: 0007_map_markers
Revises: 0006_bus_category_not_null
Create Date: 2026-04-15
"""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = "0007_map_markers"
down_revision = "0006_bus_category_not_null"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "map_markers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("marker_key", sa.String(length=50), nullable=False, unique=True),
        sa.Column("marker_type", sa.String(length=20), nullable=False),
        sa.Column("display_name", sa.String(length=50), nullable=False),
        sa.Column("lat", sa.Numeric(9, 6), nullable=False),
        sa.Column("lng", sa.Numeric(9, 6), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ui_meta", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "map_marker_routes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("marker_id", sa.Integer(),
                  sa.ForeignKey("map_markers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("route_number", sa.String(length=20), nullable=False),
        sa.Column("route_color", sa.String(length=10), nullable=True),
        sa.Column("badge_text", sa.String(length=10), nullable=True),
        sa.Column("outbound_stop_id", sa.Integer(),
                  sa.ForeignKey("bus_stops.id"), nullable=True),
        sa.Column("inbound_stop_id", sa.Integer(),
                  sa.ForeignKey("bus_stops.id"), nullable=True),
        sa.Column("ui_meta", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("idx_map_marker_routes_marker", "map_marker_routes", ["marker_id"])

    # ───── 백필 ─────
    for m in _seed_markers():
        op.execute(sa.text(_marker_insert_sql()).bindparams(
            marker_key=m["marker_key"],
            marker_type=m["marker_type"],
            display_name=m["display_name"],
            lat=m["lat"], lng=m["lng"],
            sort_order=m["sort_order"],
            ui_meta=json.dumps(m.get("ui_meta", {}), ensure_ascii=False),
        ))
        for idx, r in enumerate(m.get("routes", [])):
            op.execute(sa.text(_route_insert_sql(r)).bindparams(
                marker_key=m["marker_key"],
                route_number=r["route_number"],
                route_color=r.get("route_color"),
                badge_text=r.get("badge_text"),
                ui_meta=json.dumps(r.get("ui_meta", {}), ensure_ascii=False),
                sort_order=r.get("sort_order", idx * 10),
                **({"outbound_stop_name": r["outbound_stop_name"]}
                   if "outbound_stop_name" in r else {}),
                **({"inbound_stop_name": r["inbound_stop_name"]}
                   if "inbound_stop_name" in r else {}),
            ))


def downgrade() -> None:
    op.drop_index("idx_map_marker_routes_marker", "map_marker_routes")
    op.drop_table("map_marker_routes")
    op.drop_table("map_markers")


def _marker_insert_sql() -> str:
    return """
        INSERT INTO map_markers
          (marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta)
        VALUES
          (:marker_key, :marker_type, :display_name, :lat, :lng,
           :sort_order, CAST(:ui_meta AS JSONB))
    """


def _route_insert_sql(r: dict) -> str:
    out_expr = (
        "(SELECT id FROM bus_stops WHERE name = :outbound_stop_name LIMIT 1)"
        if "outbound_stop_name" in r else "NULL"
    )
    in_expr = (
        "(SELECT id FROM bus_stops WHERE name = :inbound_stop_name LIMIT 1)"
        if "inbound_stop_name" in r else "NULL"
    )
    return f"""
        INSERT INTO map_marker_routes
          (marker_id, route_number, route_color, badge_text,
           outbound_stop_id, inbound_stop_id, ui_meta, sort_order)
        VALUES
          ((SELECT id FROM map_markers WHERE marker_key = :marker_key),
           :route_number, :route_color, :badge_text,
           {out_expr}, {in_expr}, CAST(:ui_meta AS JSONB), :sort_order)
    """


def _seed_markers() -> list[dict]:
    return [
        {
            "marker_key": "shuttle_to_school", "marker_type": "shuttle",
            "display_name": "등교", "lat": 37.351134, "lng": 126.742043,
            "sort_order": 10,
            "ui_meta": {"direction": 0, "routeCode": "등교",
                        "routeColor": "#FF385C", "showLive": True},
        },
        {
            "marker_key": "shuttle_from_school", "marker_type": "shuttle",
            "display_name": "하교", "lat": 37.339343, "lng": 126.73279,
            "sort_order": 20,
            "ui_meta": {"direction": 1, "routeCode": "하교",
                        "routeColor": "#FF385C", "showLive": True},
        },
        {
            "marker_key": "jeongwang_station", "marker_type": "subway",
            "display_name": "정왕역", "lat": 37.352618, "lng": 126.742747,
            "sort_order": 30,
            "ui_meta": {"routeCode": "수인분당", "routeColor": "#F5A623",
                        "showLive": True, "chipVariant": "subwayMulti"},
        },
        {
            "marker_key": "tec_bus_stop", "marker_type": "bus",
            "display_name": "한국공대", "lat": 37.341633, "lng": 126.731252,
            "sort_order": 40,
            "ui_meta": {"routeCode": "33번", "routeColor": "#0891B2",
                        "showLive": True, "liveInaccurate": True},
        },
        # 정왕측 허브 (학교 근처 시각적 배치)
        {
            "marker_key": "bus_hub_jw_sihwa", "marker_type": "bus_seoul",
            "display_name": "3400", "lat": 37.342546, "lng": 126.735365,
            "sort_order": 50,
            "ui_meta": {},
            "routes": [
                {
                    "route_number": "3400", "route_color": "#DC2626", "badge_text": "G",
                    "outbound_stop_name": "시화", "inbound_stop_name": "강남역",
                    "ui_meta": {"outboundSegment": "서울행", "inboundSegment": "정왕행",
                                "outboundDirLabel": "학교 → 강남행",
                                "inboundDirLabel": "강남 → 학교행",
                                "spineLeft": "시화", "spineRight": "강남",
                                "outboundActiveSide": "right",
                                "inboundActiveSide": "left"},
                },
            ],
        },
        {
            "marker_key": "bus_hub_jw_emart", "marker_type": "bus_seoul",
            "display_name": "이마트", "lat": 37.345999, "lng": 126.737995,
            "sort_order": 60,
            "ui_meta": {},
            "routes": [
                {
                    "route_number": "6502", "route_color": "#DC2626", "badge_text": "G",
                    "outbound_stop_name": "이마트", "inbound_stop_name": "사당역",
                    "ui_meta": {"outboundSegment": "서울행", "inboundSegment": "정왕행",
                                "outboundDirLabel": "이마트 → 사당행",
                                "inboundDirLabel": "사당 → 이마트행",
                                "spineLeft": "이마트", "spineRight": "사당",
                                "outboundActiveSide": "right",
                                "inboundActiveSide": "left"},
                },
                {
                    "route_number": "3401", "route_color": "#DC2626", "badge_text": "G",
                    "outbound_stop_name": "이마트", "inbound_stop_name": "석수역",
                    "ui_meta": {"outboundSegment": "서울행", "inboundSegment": "정왕행",
                                "outboundDirLabel": "이마트 → 석수행",
                                "inboundDirLabel": "석수 → 이마트행",
                                "spineLeft": "이마트", "spineRight": "석수",
                                "outboundActiveSide": "right",
                                "inboundActiveSide": "left"},
                },
            ],
        },
        # 서울측 허브
        {
            "marker_key": "bus_hub_sl_gangnam", "marker_type": "bus_seoul",
            "display_name": "강남역", "lat": 37.498427, "lng": 127.029829,
            "sort_order": 70,
            "ui_meta": {},
            "routes": [
                {
                    "route_number": "3400", "route_color": "#DC2626", "badge_text": "G",
                    "outbound_stop_name": "강남역", "inbound_stop_name": "시화",
                    "ui_meta": {"outboundSegment": "정왕행", "inboundSegment": "서울행",
                                "outboundDirLabel": "강남 → 학교행",
                                "inboundDirLabel": "학교 → 강남행",
                                "spineLeft": "시화", "spineRight": "강남",
                                "outboundActiveSide": "left",
                                "inboundActiveSide": "right"},
                },
            ],
        },
        {
            "marker_key": "bus_hub_sl_sadang", "marker_type": "bus_seoul",
            "display_name": "사당역", "lat": 37.476654, "lng": 126.982610,
            "sort_order": 80,
            "ui_meta": {"extraPillText": "3400도 탑승 가능"},
            "routes": [
                {
                    "route_number": "6502", "route_color": "#DC2626", "badge_text": "G",
                    "outbound_stop_name": "사당역", "inbound_stop_name": "이마트",
                    "ui_meta": {"outboundSegment": "정왕행", "inboundSegment": "서울행",
                                "outboundDirLabel": "사당 → 이마트행",
                                "inboundDirLabel": "이마트 → 사당행",
                                "spineLeft": "이마트", "spineRight": "사당",
                                "outboundActiveSide": "left",
                                "inboundActiveSide": "right"},
                },
            ],
        },
        {
            "marker_key": "bus_hub_sl_seoksu", "marker_type": "bus_seoul",
            "display_name": "석수역", "lat": 37.434876, "lng": 126.902779,
            "sort_order": 90,
            "ui_meta": {},
            "routes": [
                {
                    "route_number": "3401", "route_color": "#DC2626", "badge_text": "G",
                    "outbound_stop_name": "석수역", "inbound_stop_name": "이마트",
                    "ui_meta": {"outboundSegment": "정왕행", "inboundSegment": "서울행",
                                "outboundDirLabel": "석수 → 이마트행",
                                "inboundDirLabel": "이마트 → 석수행",
                                "spineLeft": "이마트", "spineRight": "석수",
                                "outboundActiveSide": "left",
                                "inboundActiveSide": "right"},
                },
            ],
        },
        {
            "marker_key": "choji_station", "marker_type": "seohae",
            "display_name": "초지역", "lat": 37.319819, "lng": 126.80775,
            "sort_order": 100,
            "ui_meta": {"routeCode": "서해선", "routeColor": "#75bf43",
                        "badgeText": "서", "showLive": True, "tabId": "choji"},
        },
        {
            "marker_key": "siheung_station", "marker_type": "seohae",
            "display_name": "시흥시청역", "lat": 37.381656, "lng": 126.805878,
            "sort_order": 110,
            "ui_meta": {"routeCode": "서해선", "routeColor": "#75bf43",
                        "badgeText": "서", "showLive": True, "tabId": "siheung"},
        },
    ]
