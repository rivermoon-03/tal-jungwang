"""위젯 경량 엔드포인트 — 행 조립 규칙 테스트.

위젯은 크래시해도 사용자가 원인을 못 보므로, 가공은 전부 서버에서 끝내고
클라이언트는 문자열만 꽂는다. 그 문자열 규칙을 여기서 고정한다.
"""
from app.api.widget import _bus_row, _minutes_text, _shuttle_row, _subway_row


def test_분_표기():
    assert _minutes_text(0) == "곧"
    assert _minutes_text(59) == "곧"
    assert _minutes_text(60) == "1분"
    assert _minutes_text(250) == "4분"
    assert _minutes_text(None) is None


def test_셔틀_행_막차_표시():
    row = _shuttle_row(
        {"depart_at": "08:41:00", "arrive_in_seconds": 240, "is_last": True}, "등교"
    )
    assert row == {"kind": "shuttle", "label": "셔틀 등교", "value": "4분", "sub": "08:41 · 막차"}


def test_셔틀_정보_없으면_행이_없다():
    assert _shuttle_row(None, "등교") is None
    assert _shuttle_row({"depart_at": None}, "등교") is None


def test_버스_행은_실시간_있는_첫_노선을_고른다():
    result = {
        "arrivals": [
            {"route_no": "11-A", "arrive_in_seconds": None, "destination": "정왕역"},
            {"route_no": "20-1", "arrive_in_seconds": 300, "destination": "아이파크아파트"},
        ]
    }
    assert _bus_row(result) == {
        "kind": "bus",
        "label": "20-1",
        "value": "5분",
        "sub": "아이파크아파트",
    }


def test_내일_첫차만_있으면_버스_행은_없다():
    result = {"arrivals": [{"route_no": "20-1", "arrive_in_seconds": 0, "is_tomorrow": True}]}
    assert _bus_row(result) is None


def test_지하철_행은_상행을_쓴다():
    result = {"up": {"arrive_in_seconds": 540, "destination": "왕십리"}}
    assert _subway_row(result) == {
        "kind": "subway",
        "label": "정왕역",
        "value": "9분",
        "sub": "왕십리 방면",
    }


def test_조회_예외는_행_없음으로_흡수된다():
    """한 소스가 죽어도 나머지 줄은 살아야 한다 — 예외 객체가 들어와도 None."""
    exc = RuntimeError("boom")
    assert _shuttle_row(exc, "등교") is None
    assert _bus_row(exc) is None
    assert _subway_row(exc) is None
