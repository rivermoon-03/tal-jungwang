from pydantic import BaseModel


class Destination(BaseModel):
    code: str
    name: str
    kind: str           # "subway_station" | "area"
    lat: float | None = None
    lng: float | None = None
    sort_order: int
