"""F5 이동 지수 + 에어코리아 파서 테스트."""
from app.services.external.airkorea import parse_air_response
from app.services.weather import compute_walk_index


def test_걷기_좋음():
    idx = compute_walk_index(rain_prob=10, temp=22, pm_grade="좋음")
    assert idx["level"] == "good"
    assert idx["label"] == "걷기 좋음"


def test_비_예보는_대중교통_권장():
    idx = compute_walk_index(rain_prob=60, temp=27, pm_grade="보통")
    assert idx["level"] == "transit"
    assert "강수확률 60%" in idx["reason"]


def test_미세_매우나쁨은_실내_권장():
    idx = compute_walk_index(rain_prob=0, temp=20, pm_grade="매우나쁨")
    assert idx["level"] == "indoor"
    assert "매우나쁨" in idx["reason"]


def test_미세먼지_없이도_판정된다():
    idx = compute_walk_index(rain_prob=40, temp=25, pm_grade=None)
    assert idx["level"] == "ok"


def test_폭염은_실내_권장():
    assert compute_walk_index(0, 36, "좋음")["level"] == "indoor"


def test_에어코리아_응답_파싱():
    payload = {
        "response": {
            "body": {
                "items": [
                    {"pm10Value": "18", "pm25Value": "11", "pm10Grade1h": "1", "pm25Grade1h": "2"}
                ]
            }
        }
    }
    air = parse_air_response(payload)
    assert air == {"pm10": 18, "pm25": 11, "pm10_grade": "좋음", "pm25_grade": "보통"}


def test_에어코리아_통신장애_값은_None():
    payload = {"response": {"body": {"items": [{"pm10Value": "-", "pm25Value": None}]}}}
    air = parse_air_response(payload)
    assert air["pm10"] is None and air["pm25"] is None


def test_에어코리아_빈_응답은_None():
    assert parse_air_response({"response": {"body": {"items": []}}}) is None
    assert parse_air_response({}) is None
