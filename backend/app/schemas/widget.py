from pydantic import BaseModel


class WidgetItem(BaseModel):
    kind: str        # bus | shuttle | subway | menu | menu_more | calendar
    badge: str = ""  # 배지 텍스트("33"/"등"/"D-2") — 없으면 배지를 안 그린다
    label: str       # 본문 한 줄("20-1" / "고기국수" / "2학기 수강신청")
    value: str = ""  # 우측 값("4분"/"곧") — 학식·일정은 비어 있다
    sub: str = ""    # 보조 설명(행선지·기간·막차 등)


class WidgetResponse(BaseModel):
    type: str                 # transit | cafeteria | calendar
    mode: str = ""            # transit 전용: bus | shuttle | subway
    title: str                # 위젯 헤더
    sub: str = ""             # 헤더 보조(학식 운영시간 등)
    meal: str = ""            # 학식 전용: 조식 | 중식 | 석식
    updated_at: str           # "HH:MM"
    items: list[WidgetItem]
    empty_text: str | None = None  # items가 비었을 때 그대로 찍을 문장
