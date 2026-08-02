"""위젯 3종(교통·학식·학사일정) 페이로드 조립 규칙 테스트.

위젯은 크래시해도 사용자가 원인을 못 보므로, 가공은 전부 서버에서 끝내고
클라이언트는 문자열만 꽂는다. 그 문자열 규칙을 여기서 고정한다.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.api.widget import (
    _bus_rows,
    _cafeteria_payload,
    _calendar_payload,
    _current_meal,
    _minutes_text,
    _shuttle_rows,
    _subway_rows,
)

KST = ZoneInfo("Asia/Seoul")


# ── 공통 ───────────────────────────────────────────────────────────────


def test_분_표기():
    assert _minutes_text(0) == "곧"
    assert _minutes_text(59) == "곧"
    assert _minutes_text(60) == "1분"
    assert _minutes_text(250) == "4분"
    assert _minutes_text(None) is None


def test_한시간_넘으면_시간으로_접는다():
    """4×2 칸이 좁아 '183분' 같은 표기를 쓰지 않는다."""
    assert _minutes_text(3600 * 3) == "3시간"


# ── 교통 ───────────────────────────────────────────────────────────────


def test_버스는_실시간_있는_노선만_최대_3개():
    result = {
        "arrivals": [
            {"route_no": "11-A", "arrive_in_seconds": None, "destination": "정왕역"},
            {"route_no": "시흥33", "arrive_in_seconds": 30, "destination": "시흥시청방면"},
            {"route_no": "20-1", "arrive_in_seconds": 420, "destination": "아이파크"},
            {"route_no": "5602", "arrive_in_seconds": 900, "destination": "서울"},
            {"route_no": "3400", "arrive_in_seconds": 1200, "destination": "강남"},
        ]
    }
    rows = _bus_rows(result)
    assert [r["label"] for r in rows] == ["시흥33", "20-1", "5602"]
    assert rows[0]["value"] == "곧"


def test_내일_첫차는_버스_행에서_제외된다():
    result = {"arrivals": [{"route_no": "20-1", "arrive_in_seconds": 0, "is_tomorrow": True}]}
    assert _bus_rows(result) == []


def test_셔틀은_방향별_행과_기간명을_싣는다():
    results = [
        {"depart_at": "08:41:00", "arrive_in_seconds": 240},
        {"depart_at": "09:10:00", "arrive_in_seconds": 1980, "is_last": True},
        None,
    ]
    schedule = {"schedule_name": "여름방학 · 단축근무"}
    rows = _shuttle_rows(results, schedule)
    assert [r["label"] for r in rows] == ["정왕역 → 학교", "학교 → 정왕역"]
    assert rows[0]["value"] == "4분"
    assert rows[1]["sub"] == "09:10 출발 · 막차"
    assert rows[0]["period"] == "여름방학 · 단축근무"  # 헤더용 힌트


def test_지하철은_막차를_부제에_붙인다():
    result = {"up": {"arrive_in_seconds": 540, "destination": "왕십리", "last_depart_at": "23:52"}}
    rows = _subway_rows(result)
    assert rows[0]["label"] == "왕십리 방면"
    assert rows[0]["value"] == "9분"
    assert rows[0]["sub"] == "상행 · 막차 23:52"


def test_조회_실패는_빈_행으로_흡수된다():
    """한 소스가 죽어도 위젯이 통째로 비지 않아야 한다."""
    assert _bus_rows(None) == []
    assert _subway_rows(None) == []
    assert _shuttle_rows([None, None, None], None) == []


# ── 학식 ───────────────────────────────────────────────────────────────


def test_시각별_끼니_선택():
    assert _current_meal(datetime(2026, 8, 3, 9, tzinfo=KST)) == "조식"
    assert _current_meal(datetime(2026, 8, 3, 12, tzinfo=KST)) == "중식"
    assert _current_meal(datetime(2026, 8, 3, 18, tzinfo=KST)) == "석식"


def test_학식은_메인_2개와_나머지_한줄로_접는다():
    menu = {
        "cafeterias": [
            {
                "name": "TIP 학생식당",
                "meals": [
                    {
                        "type": "중식",
                        "time": "11:00~14:00",
                        "by_day": {"3": ["고기국수", "타코야끼", "후랑크볶음", "락교", "배추김치"]},
                    }
                ],
            }
        ]
    }
    payload = _cafeteria_payload(menu, datetime(2026, 8, 3, 12, tzinfo=KST))
    assert payload["meal"] == "중식"
    assert [i["label"] for i in payload["items"]] == [
        "고기국수",
        "타코야끼",
        "후랑크볶음 · 락교 · 배추김치",
    ]
    assert payload["sub"] == "11:00~14:00"


def test_식단이_없으면_빈_문장을_준다():
    payload = _cafeteria_payload({"cafeterias": []}, datetime(2026, 8, 2, 12, tzinfo=KST))
    assert payload["items"] == []
    assert payload["empty_text"] == "오늘은 등록된 식단이 없어요"


# ── 학사일정 ───────────────────────────────────────────────────────────


def test_학사일정_D_day와_기간_표기():
    calendar = {
        "next": {"title": "2학기 수강신청", "start_date": "2026-08-04", "end_date": "2026-08-06"},
        "upcoming": [
            {"title": "2학기 등록기간", "start_date": "2026-08-18", "end_date": "2026-08-24"},
        ],
    }
    payload = _calendar_payload(calendar, date(2026, 8, 2))
    assert payload["items"][0]["badge"] == "D-2"
    assert payload["items"][0]["sub"] == "8/4 ~ 8/6"
    assert payload["items"][1]["badge"] == "D-16"


def test_진행_중인_일정은_D_day_대신_진행중():
    calendar = {"next": {"title": "수강정정", "start_date": "2026-08-01", "end_date": "2026-08-05"}}
    payload = _calendar_payload(calendar, date(2026, 8, 3))
    assert payload["items"][0]["badge"] == "진행 중"


def test_일정이_없으면_빈_문장을_준다():
    payload = _calendar_payload({"next": None, "upcoming": []}, date(2026, 8, 2))
    assert payload["items"] == []
    assert payload["empty_text"] == "다가오는 일정이 없어요"
