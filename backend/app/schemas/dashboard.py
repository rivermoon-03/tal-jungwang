from typing import Any

from pydantic import BaseModel


class DashboardResponse(BaseModel):
    shuttle: dict[str, Any] | None
    bus: dict[str, Any] | None
    subway: dict[str, Any] | None
    updated_at: str
