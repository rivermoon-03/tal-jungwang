import pytest
from app.services.bus_collector import _predict_sec_from_item


@pytest.mark.parametrize(
    "item, suffix, expected",
    [
        ({"predict_time_sec1": 180, "predict_time1": 5}, "1", 180),
        ({"predict_time_sec2": 90, "predict_time2": 2}, "2", 90),

        ({"predict_time_sec1": 0, "predict_time1": 3}, "1", 150),
        ({"predict_time_sec1": 0, "predict_time1": 1}, "1", 30),
        ({"predict_time_sec2": 0, "predict_time2": 5}, "2", 270),

        ({"predict_time_sec1": 0, "predict_time1": 0}, "1", 0),

        ({"predict_time_sec1": 0, "predict_time1": None}, "1", 0),

        ({}, "1", 0),
    ],
)
def test_predict_sec_from_item(item, suffix, expected):
    assert _predict_sec_from_item(item, suffix) == expected
