"""위젯 3종(교통·학식·학사일정) 페이로드 조립 규칙 테스트.

위젯은 크래시해도 사용자가 원인을 못 보므로, 가공은 전부 서버에서 끝내고
클라이언트는 문자열만 꽂는다. 그 문자열 규칙을 여기서 고정한다.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.api.widget import (
    _cafeteria_payload,
    _calendar_payload,
    _current_meal,
    _direction_col,
    _minutes_text,
    _subway_cols,
    _venues_payload,
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


def test_방향_열은_다음차와_출발시각을_담는다():
    col = _direction_col("shuttle", "등", "↑ 등교",
                         {"depart_at": "08:41:00", "arrive_in_seconds": 240,
                          "next_depart_at": "08:59:00"})
    assert col["value"] == "4분"
    assert col["sub"] == "08:41 출발 · 다음 08:59"
    assert col["empty"] is False


def test_막차면_막차로_표시한다():
    col = _direction_col("shuttle", "하", "↓ 하교",
                         {"depart_at": "20:10:00", "arrive_in_seconds": 600, "is_last": True})
    assert col["sub"] == "20:10 출발 · 막차"


def test_한_방향이_끊겨도_그_열만_저하된다():
    """열 단위 저하 — 위젯 전체가 비지 않는다."""
    col = _direction_col("subway", "서", "↓ 하행", None)
    assert col["empty"] is True
    assert col["sub"] == "오늘 운행 종료"
    assert col["value"] == ""


def test_조회_예외가_들어와도_열은_만들어진다():
    col = _direction_col("shuttle", "등", "↑ 등교", RuntimeError("boom"))
    assert col["empty"] is True


def test_지하철은_역별_상하행_두_열이고_막차를_보여준다():
    result = {
        "up": {"depart_at": "23:00:00", "arrive_in_seconds": 540,
               "destination": "왕십리", "last_depart_at": "23:33"},
        "down": {"depart_at": "23:05:00", "arrive_in_seconds": 30,
                 "destination": "오이도", "last_depart_at": "00:01"},
    }
    cols = _subway_cols(result, "정왕")
    assert [c["label"] for c in cols] == ["↑ 상행", "↓ 하행"]
    assert cols[0]["dest"] == "왕십리"
    assert cols[0]["sub"] == "막차 23:33"
    assert cols[1]["value"] == "곧"


def test_서해선_역은_서해선_키를_읽는다():
    result = {"siheung_up": {"depart_at": "22:00:00", "arrive_in_seconds": 600, "destination": "일산"}}
    cols = _subway_cols(result, "시흥시청")
    assert cols[0]["badge"] == "서"
    assert cols[0]["dest"] == "일산"
    assert cols[1]["empty"] is True  # 하행 데이터 없음 → 그 열만 저하


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


def test_운영정보_탭은_지금_문_연_곳을_마감순으로_준다():
    """학식이 없는 주말·방학에도 위젯이 쓸모를 유지하는 축."""
    # 평일 12시 — 학기 스케줄 기준
    payload = _venues_payload(datetime(2026, 5, 11, 12, tzinfo=KST))
    assert payload["title"] == "지금 영업 중"
    assert payload["items"], "평일 점심엔 최소 한 곳은 열려 있어야 한다"
    # 24시간 매장은 마감이 없어 목록 끝으로 밀린다
    close_texts = [i["sub"] for i in payload["items"]]
    timed = [c for c in close_texts if c.endswith("마감")]
    assert timed == sorted(timed), "마감 임박 순 정렬"


def test_운영정보_탭_새벽에는_24시간_매장만_남는다():
    payload = _venues_payload(datetime(2026, 5, 11, 4, tzinfo=KST))
    subs = [i["sub"] for i in payload["items"]]
    assert all(s == "24시간" for s in subs)


def test_식단이_없으면_빈_문장을_준다():
    payload = _cafeteria_payload({"cafeterias": []}, datetime(2026, 8, 2, 12, tzinfo=KST))
    assert payload["items"] == []
    assert payload["empty_text"] == "오늘은 등록된 식단이 없어요"


def _두_식당_메뉴():
    return {
        "cafeterias": [
            {
                "name": "TIP 학생식당",
                "meals": [{"type": "중식", "time": "11:00~14:00", "by_day": {"3": ["돈까스"]}}],
            },
            {
                "name": "E동 레스토랑",
                "meals": [{"type": "중식", "time": "11:30~13:30", "by_day": {"3": ["제육덮밥"]}}],
            },
        ]
    }


def test_식단은_식당을_골라_보여준다():
    """TIP 지하 / E동은 메뉴도 운영시간도 달라 한쪽만 보면 답이 반쪽이다."""
    noon = datetime(2026, 8, 3, 12, tzinfo=KST)
    tip = _cafeteria_payload(_두_식당_메뉴(), noon, "tip")
    edong = _cafeteria_payload(_두_식당_메뉴(), noon, "edong")
    assert tip["title"] == "TIP 학생식당"
    assert [i["label"] for i in tip["items"]] == ["돈까스"]
    assert edong["title"] == "E동 레스토랑"
    assert [i["label"] for i in edong["items"]] == ["제육덮밥"]
    assert edong["sub"] == "11:30~13:30"
    assert edong["selector"] == {"kind": "place", "value": "edong", "options": ["tip", "edong"]}


def test_고른_식당이_없으면_첫_식당으로_떨어진다():
    """크롤 결과에 E동이 빠진 날에도 위젯이 비지 않는다."""
    menu = {"cafeterias": [_두_식당_메뉴()["cafeterias"][0]]}
    payload = _cafeteria_payload(menu, datetime(2026, 8, 3, 12, tzinfo=KST), "edong")
    assert payload["title"] == "TIP 학생식당"
    assert [i["label"] for i in payload["items"]] == ["돈까스"]


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
