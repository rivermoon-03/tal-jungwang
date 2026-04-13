from pydantic import BaseModel


class TransportOption(BaseModel):
    available: bool
    total_seconds: int | None = None
    route_no: str | None = None
    wait_seconds: int | None = None
    ride_seconds: int | None = None
    walk_to_station_seconds: int | None = None
    traffic_state: str | None = None


class RecommendResponse(BaseModel):
    recommended: str  # "bus" | "walking" | "subway"
    message: str
    comparison: dict[str, TransportOption]
    updated_at: str
