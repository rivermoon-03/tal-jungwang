from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class RouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    destination_name: str | None = None


class WalkingRouteResponse(BaseModel):
    duration_seconds: int
    distance_meters: int
    coordinates: list  # [[lng, lat], ...]


class DrivingRouteResponse(BaseModel):
    duration_seconds: int
    distance_meters: int
    toll_fee: int
    taxi_fee: int | None = None
    coordinates: list
