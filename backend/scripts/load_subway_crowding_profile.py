"""stcis(교통카드 빅데이터 통합정보시스템) CSV → subway_crowding_profile 적재 스크립트.

수동 실행 스크립트다 — cron 없음 (fetch_subway_timetable.py 와 같은 성격).
stcis.go.kr 통계는 로그인 후 수동 다운로드만 가능해 자동 수집하지 않는다.
가짜 데이터 시드는 절대 금지 — 실데이터 CSV 가 준비되기 전에는 이 스크립트를
돌리지 않으며, 테이블이 비어 있는 동안 API 는 빈 배열, 프런트는 섹션 미렌더다.

사용법:
    docker compose exec backend python -m scripts.load_subway_crowding_profile <csv경로> [--source stcis-2026-06]

CSV 예상 컬럼 (헤더 필수, UTF-8):
    station_name : 역명 (예: 정왕)
    line_id      : 노선 ID — 1004(4호선) | 1075(수인분당선) | 1093(서해선)
    direction    : up | down
    day_type     : weekday | saturday | sunday
    hour         : 0~23 (시간대 시작 시각)
    passengers   : 해당 시간대 승차+하차 인원 합계 (0 이상 정수)

stcis 원본(역별 시간대별 승하차 인원)은 시간대가 열로 펼쳐진 wide 형태이므로,
위의 long 형태로 전처리한 CSV 를 넣는다. 정규화는 (station_name, line_id,
direction, day_type) 그룹 안에서 최대 passengers 로 나눠 0~1 level 로 만든다
(소수 둘째 자리 반올림, 그룹 max=0 이면 전부 0.0). 같은 PK 행은 upsert 로
덮어쓰고, 적재 후 Redis `subway:crowding:*` 캐시를 best-effort 로 비운다.
"""

import argparse
import asyncio
import csv
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

# 프로젝트 루트를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

KST = ZoneInfo("Asia/Seoul")

REQUIRED_COLUMNS = ("station_name", "line_id", "direction", "day_type", "hour", "passengers")
VALID_DIRECTIONS = {"up", "down"}
VALID_DAY_TYPES = {"weekday", "saturday", "sunday"}


def parse_rows(raw_rows: list[dict]) -> list[dict]:
    """CSV DictReader 행 목록을 검증·형변환한다. 문제 행은 행 번호와 함께 ValueError.

    수동 스크립트라 스킵보다 실패가 낫다 — 잘못된 행이 하나라도 있으면 전체 중단.
    """
    parsed: list[dict] = []
    seen_keys: set[tuple] = set()

    for idx, row in enumerate(raw_rows, start=2):  # 1행은 헤더
        missing = [c for c in REQUIRED_COLUMNS if not (row.get(c) or "").strip()]
        if missing:
            raise ValueError(f"{idx}행: 필수 컬럼 누락 {missing}")

        station = row["station_name"].strip()
        line_id = row["line_id"].strip()
        direction = row["direction"].strip()
        day_type = row["day_type"].strip()

        if direction not in VALID_DIRECTIONS:
            raise ValueError(f"{idx}행: direction 은 up|down 이어야 합니다 (got {direction!r})")
        if day_type not in VALID_DAY_TYPES:
            raise ValueError(
                f"{idx}행: day_type 은 weekday|saturday|sunday 이어야 합니다 (got {day_type!r})"
            )

        try:
            hour = int(row["hour"])
            passengers = int(row["passengers"])
        except ValueError as exc:
            raise ValueError(f"{idx}행: hour/passengers 는 정수여야 합니다 ({exc})") from None
        if not 0 <= hour <= 23:
            raise ValueError(f"{idx}행: hour 는 0~23 이어야 합니다 (got {hour})")
        if passengers < 0:
            raise ValueError(f"{idx}행: passengers 는 0 이상이어야 합니다 (got {passengers})")

        key = (station, line_id, direction, day_type, hour)
        if key in seen_keys:
            raise ValueError(f"{idx}행: 중복 PK {key}")
        seen_keys.add(key)

        parsed.append({
            "station_name": station,
            "line_id": line_id,
            "direction": direction,
            "day_type": day_type,
            "hour": hour,
            "passengers": passengers,
        })
    return parsed


def normalize_levels(rows: list[dict]) -> list[dict]:
    """(역·노선·방향·요일) 그룹별 최대 passengers 로 나눠 0~1 level 을 붙인다.

    - 그룹 최대값이 곧 1.0 이 된다 (그룹 내 상대 혼잡).
    - 그룹 max=0 이면 나눗셈 대신 전부 0.0 (심야 무승객 그룹 등).
    - numeric(3,2) 정밀도에 맞춰 소수 둘째 자리 반올림.
    """
    group_max: dict[tuple, int] = {}
    for r in rows:
        gk = (r["station_name"], r["line_id"], r["direction"], r["day_type"])
        group_max[gk] = max(group_max.get(gk, 0), r["passengers"])

    out: list[dict] = []
    for r in rows:
        gk = (r["station_name"], r["line_id"], r["direction"], r["day_type"])
        mx = group_max[gk]
        level = round(r["passengers"] / mx, 2) if mx > 0 else 0.0
        out.append({**r, "level": level})
    return out


async def upsert(rows: list[dict], source: str) -> int:
    """정규화된 행을 subway_crowding_profile 에 upsert 한다. 반환: 처리 행 수."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    from app.core.cache import close_redis, delete_keys
    from app.core.database import AsyncSessionLocal
    from app.models.subway import SubwayCrowdingProfile

    now = datetime.now(KST)  # KST tz-aware — naive datetime 금지
    values = [
        {
            "station_name": r["station_name"],
            "line_id": r["line_id"],
            "direction": r["direction"],
            "day_type": r["day_type"],
            "hour": r["hour"],
            "level": r["level"],
            "source": source,
            "updated_at": now,
        }
        for r in rows
    ]

    async with AsyncSessionLocal() as db:
        stmt = pg_insert(SubwayCrowdingProfile).values(values)
        stmt = stmt.on_conflict_do_update(
            index_elements=["station_name", "line_id", "direction", "day_type", "hour"],
            set_={
                "level": stmt.excluded.level,
                "source": stmt.excluded.source,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        await db.execute(stmt)
        await db.commit()

    # cache-aside(TTL 6h) 라 없어도 자가회복되지만, 적재 직후 바로 반영되도록
    # best-effort 로 비운다 (delete_keys 는 오류를 삼킨다).
    await delete_keys("subway:crowding:*")
    await close_redis()
    return len(values)


async def main() -> None:
    parser = argparse.ArgumentParser(description="stcis CSV → subway_crowding_profile 적재")
    parser.add_argument("csv_path", help="전처리된 long 형태 CSV 경로")
    parser.add_argument("--source", default="stcis", help='출처 표기 (예: "stcis-2026-06")')
    args = parser.parse_args()

    with open(args.csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = [c.strip() for c in (reader.fieldnames or [])]
        missing = [c for c in REQUIRED_COLUMNS if c not in fieldnames]
        if missing:
            raise SystemExit(f"CSV 헤더에 필수 컬럼이 없습니다: {missing}")
        raw_rows = list(reader)

    if not raw_rows:
        raise SystemExit("CSV 에 데이터 행이 없습니다 — 아무것도 적재하지 않았어요.")

    rows = normalize_levels(parse_rows(raw_rows))
    count = await upsert(rows, args.source)
    print(f"subway_crowding_profile upsert 완료: {count}건 (source={args.source})")


if __name__ == "__main__":
    asyncio.run(main())
