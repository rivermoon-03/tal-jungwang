from pydantic import BaseModel


class WidgetItem(BaseModel):
    """세로 목록형 위젯(학식 메뉴·매장, 학사일정)의 한 줄."""

    kind: str        # menu | menu_more | venue | calendar
    badge: str = ""  # 배지 텍스트("D-2") — 없으면 배지를 안 그린다
    label: str       # 본문 한 줄("고기국수" / "맘스터치" / "2학기 수강신청")
    value: str = ""  # 우측 값 — 목록형은 대개 비어 있다
    sub: str = ""    # 보조 설명(마감 시각·기간 등)


class WidgetColumn(BaseModel):
    """교통 위젯의 좌우 2열 중 한 열(등교/하교, 상행/하행).

    한 방향이 끊겨도 반대 열은 그대로 그린다(열 단위 저하) — empty=True면
    value 대신 sub("오늘 운행 종료")만 표시한다.
    """

    kind: str          # shuttle | subway
    badge: str = ""    # 노선 배지("수"/"서") 또는 방향 배지("등"/"하")
    label: str         # "↑ 등교" / "↓ 하행"
    dest: str = ""     # 지하철 방면("왕십리")
    value: str = ""    # "4분" / "곧"
    sub: str = ""      # "08:41 출발 · 다음 08:59" / "막차 23:33"
    empty: bool = False


class WidgetSelector(BaseModel):
    """헤더 세그먼트(셔틀 캠퍼스 / 지하철 역 / 식단 식당)."""

    kind: str            # campus | station | place
    value: str
    options: list[str]


class WidgetResponse(BaseModel):
    type: str                 # transit | cafeteria | calendar
    mode: str = ""            # transit 전용: shuttle | subway
    view: str = ""            # cafeteria 전용: menu | venues
    title: str                # 위젯 헤더
    sub: str = ""             # 헤더 보조(학식 운영시간 등)
    meal: str = ""            # 학식 전용: 조식 | 중식 | 석식 | "N곳"
    updated_at: str           # "HH:MM"
    selector: WidgetSelector | None = None
    columns: list[WidgetColumn] = []  # 교통 전용
    items: list[WidgetItem] = []      # 학식·학사일정 전용
    empty_text: str | None = None     # 내용이 없을 때 그대로 찍을 문장
