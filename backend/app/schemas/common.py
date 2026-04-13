from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    error: ErrorDetail | None = None
    timestamp: datetime

    @classmethod
    def ok(cls, data: Any) -> "ApiResponse":
        return cls(success=True, data=data, timestamp=datetime.now().astimezone())

    @classmethod
    def fail(cls, code: str, message: str) -> "ApiResponse":
        return cls(
            success=False,
            error=ErrorDetail(code=code, message=message),
            timestamp=datetime.now().astimezone(),
        )
