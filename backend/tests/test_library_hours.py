"""도서관 열람실 개관시간 파서(F7) — pyxis 배너 응답 기반."""
from app.services.external.tukorea_library import parse_library_hours


def test_배너_응답을_열람실_시간으로_파싱한다():
    payload = {
        "data": {
            "list": [
                {"name": "자료열람실(3층)", "description": "[방학] 평일 09:30 ~ 17:30"},
                {"name": "채움<br>(스터디 라운지)", "description": "[방학] 평일 09:30 ~ 17:30"},
                {"name": "제1일반열람실", "description": "[방학] 미개방"},
            ]
        }
    }
    rooms = parse_library_hours(payload)
    assert rooms[0] == {
        "room": "자료열람실(3층)",
        "period": "방학",
        "hours": "평일 09:30 ~ 17:30",
        "closed": False,
    }
    # <br> 태그는 공백으로 정리된다
    assert rooms[1]["room"] == "채움 (스터디 라운지)"
    assert rooms[2]["closed"] is True


def test_빈_응답은_빈_목록():
    assert parse_library_hours({}) == []
    assert parse_library_hours({"data": {"list": []}}) == []
