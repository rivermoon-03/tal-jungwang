from pydantic import BaseModel


class MapMarker(BaseModel):
    id: str
    type: str  # "bus_station" | "shuttle_stop" | "subway_station"
    name: str
    lat: float
    lng: float
    extra: dict | None = None


class MapMarkersResponse(BaseModel):
    markers: list[MapMarker]
