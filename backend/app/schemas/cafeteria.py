from pydantic import BaseModel


class CafeteriaMeal(BaseModel):
    type: str                          # "중식" | "석식" | "천원의 아침밥"
    time: str | None = None            # "11:00~14:00"
    by_day: dict[str, list[str]]       # {"11": ["제육볶음면", ...], "16": ["미운영"]}


class CafeteriaSection(BaseModel):
    name: str                          # "TIP 학생식당" | "E동 레스토랑"
    meals: list[CafeteriaMeal]


class CafeteriaMenuResponse(BaseModel):
    week_start: str                    # "5.11" (시트명, M.DD)
    year: int                          # 캐시 시점 KST 연도로 보강
    source_file: str
    fetched_at: str                    # ISO8601 (KST)
    cafeterias: list[CafeteriaSection]
