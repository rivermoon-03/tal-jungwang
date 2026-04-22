import pytest
from app.services.subway_realtime import parse_rows

SAMPLE_ROWS = [
    # 4호선 상행 — 진입중 (subwayId 1004)
    {
        "subwayId": "1004",
        "updnLine": "상행",
        "trainLineNm": "불암산행 - 신길온천방면",
        "btrainNo": "4590",
        "bstatnNm": "불암산",
        "arvlMsg2": "전역 도착",
        "arvlMsg3": "오이도",
        "arvlCd": "5",
    },
    # 수인분당선 상행 — 운행중 (subwayId 1075)
    {
        "subwayId": "1075",
        "updnLine": "상행",
        "trainLineNm": "왕십리행 - 신길온천방면",
        "btrainNo": "6542",
        "bstatnNm": "왕십리",
        "arvlMsg2": "[4]번째 전역 (소래포구)",
        "arvlMsg3": "소래포구",
        "arvlCd": "99",
    },
    # 같은 열차 중복 (subwayId 1004, btrainNo 동일) — 제거되어야 함
    {
        "subwayId": "1004",
        "updnLine": "상행",
        "trainLineNm": "왕십리행 - 신길온천방면",
        "btrainNo": "6542",
        "bstatnNm": "왕십리",
        "arvlMsg2": "[4]번째 전역 (소래포구)",
        "arvlMsg3": "소래포구",
        "arvlCd": "99",
    },
    # 4호선 하행
    {
        "subwayId": "1004",
        "updnLine": "하행",
        "trainLineNm": "오이도행 - 오이도방면",
        "btrainNo": "4567",
        "bstatnNm": "오이도",
        "arvlMsg2": "정왕 진입",
        "arvlMsg3": "정왕",
        "arvlCd": "0",
    },
]

def test_parse_deduplicates_by_train_no():
    result = parse_rows(SAMPLE_ROWS)
    train_nos = [item["train_no"] for item in result]
    assert len(train_nos) == len(set(train_nos)), "btrainNo 기준 중복이 제거되어야 함"

def test_parse_line_classification():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    assert by_no["4590"]["line"] == "4호선"
    assert by_no["6542"]["line"] == "수인분당선"

def test_parse_status_code_mapping():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    assert by_no["4590"]["status_code"] == 5
    assert by_no["4567"]["status_code"] == 0

def test_parse_color_by_line():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    assert by_no["4590"]["color"] == "#1B5FAD"
    assert by_no["6542"]["color"] == "#F5A623"

def test_parse_destination():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    assert by_no["4590"]["destination"] == "불암산"
    assert by_no["6542"]["destination"] == "왕십리"
