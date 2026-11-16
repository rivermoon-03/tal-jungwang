from app.services.external.gbis import parse_arrivals

STATION = "224000861"


def _item(dest_id, seq, predict_sec):
    return {
        "routeId": 224000050,
        "routeName": 3400,
        "routeDestId": dest_id,
        "staOrder": seq,
        "predictTimeSec1": predict_sec,
        "predictTime1": predict_sec // 60 if predict_sec else "",
        "locationNo1": 2 if predict_sec else "",
    }


def test_drops_runs_that_end_at_this_stop():
    body = {"busArrivalList": [_item(122000742, 1, ""), _item(224000861, 69, 221)]}
    items = parse_arrivals(body, STATION)
    assert len(items) == 1
    assert items[0]["predict_time_sec1"] == 0


def test_keeps_runs_heading_elsewhere():
    body = {"busArrivalList": _item(122000742, 3, 300)}
    assert parse_arrivals(body, "224000513")[0]["predict_time_sec1"] == 300


def test_empty_body():
    assert parse_arrivals({}, STATION) == []
