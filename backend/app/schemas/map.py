from pydantic import BaseModel


class MapMarkerRouteEntry(BaseModel):
    route_number: str
    route_color: str | None = None
    badge_text: str | None = None
    outbound_stop_id: int | None = None
    outbound_stop_gbis_id: str | None = None
    inbound_stop_id: int | None = None
    ui_meta: dict = {}


class MapMarker(BaseModel):
    key: str                        # marker_key — frontend 식별자
    type: str                       # bus | bus_seoul | shuttle | subway | seohae
    name: str
    lat: float
    lng: float
    ui_meta: dict = {}
    routes: list[MapMarkerRouteEntry] = []


class MapMarkersResponse(BaseModel):
    markers: list[MapMarker]
