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


# ── 초단기예보 전환 — 강수 판정 입력 교체·낙뢰 승급 ─────────────────────


def test_초단기가_곧_비라면_강수확률이_낮아도_대중교통_권장():
    idx = compute_walk_index(rain_prob=10, temp=22, pm_grade="좋음", rain_soon=True)
    assert idx["level"] == "transit"
    assert idx["reason"] == "곧 비 예보"
    rain_row = next(f for f in idx["factors"] if f["key"] == "rain")
    assert rain_row["decisive"] is True
    assert rain_row["value"] == "10%"  # 표시는 단기예보 확률 그대로


def test_초단기가_비_없음이라면_묵은_강수확률은_무시된다():
    # 단기예보 강수확률 70%가 3시간 묵어 있어도, 초단기가 1~2시간 창에 비 없다면
    # 지수를 끌어내리지 않는다 — 이 전환의 목적 그 자체.
    idx = compute_walk_index(rain_prob=70, temp=22, pm_grade="좋음", rain_soon=False)
    assert idx["level"] == "good"


def test_초단기_없으면_기존_강수확률_임계값으로_폴백():
    idx = compute_walk_index(rain_prob=70, temp=22, pm_grade="좋음", rain_soon=None)
    assert idx["level"] == "transit"
    assert "강수확률 70%" in idx["reason"]


def test_낙뢰는_실내_권장으로_승급하고_행이_추가된다():
    idx = compute_walk_index(rain_prob=0, temp=22, pm_grade="좋음",
                             rain_soon=False, lightning=True)
    assert idx["level"] == "indoor"
    assert idx["reason"] == "낙뢰 예보"
    lgt_row = next(f for f in idx["factors"] if f["key"] == "lightning")
    assert lgt_row["label"] == "낙뢰"
    assert lgt_row["value"] == "감지됨"
    assert lgt_row["decisive"] is True
    # 다른 행의 decisive 는 낙뢰에 밀려 전부 False (decisive 정책 유지)
    assert all(not f["decisive"] for f in idx["factors"] if f["key"] != "lightning")


def test_낙뢰_없으면_행_자체가_없다():
    idx = compute_walk_index(rain_prob=0, temp=22, pm_grade="좋음", rain_soon=False)
    assert [f["key"] for f in idx["factors"]] == ["temp", "rain", "dust"]


def test_출처_라벨은_그대로_실린다():
    idx = compute_walk_index(rain_prob=0, temp=22, pm_grade="좋음",
                             rain_soon=False, source_label="14:30 발표 초단기예보 기준")
    assert idx["source_label"] == "14:30 발표 초단기예보 기준"
    # 구버전 호출(라벨 없음)은 None — 프런트가 출처 줄을 조용히 숨긴다.
    assert compute_walk_index(0, 22, "좋음")["source_label"] is None


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
