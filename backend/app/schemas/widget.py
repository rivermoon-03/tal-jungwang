from pydantic import BaseModel


class WidgetItem(BaseModel):
    kind: str    # shuttle | bus | subway
    label: str   # "셔틀 등교" / "20-1" / "정왕역"
    value: str   # "4분" / "곧" / "08:41"
    sub: str = ""  # 보조 설명(행선지·막차 표시 등)


class WidgetResponse(BaseModel):
    updated_at: str          # "HH:MM" — 위젯 하단 갱신 시각
    direction: str           # 등교 | 하교
    items: list[WidgetItem]
    empty_text: str | None = None  # items가 비었을 때 위젯에 그대로 찍을 문장
