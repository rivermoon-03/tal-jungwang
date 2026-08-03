"""버스 도착정보 백그라운드 수집기.

45초 간격으로 GBIS API를 폴링하여(02:00~03:59 제외):
1. Redis에 도착정보 캐시 (프론트 응답용, TTL 100초 — 1회 미싱 버퍼)
2. 이전 상태와 비교하여 도착 판정 → DB 기록
"""

import asyncio
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.cache import get_redis
from app.core.database import AsyncSessionLocal
from app.models.bus import (
    BusArrivalHistory,
    BusCrowdingLog,
    BusEtaSample,
    BusRealtimeTarget,
    BusRoute,
)
from app.services.external.gbis import fetch_arrivals

from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

# 이전 폴링에서 predictTimeSec이 이 값 이하였던 차량이 사라지면 도착으로 판정
ARRIVAL_THRESHOLD_SEC = 90

# 이전 폴링에 없었던 차량이 이번에 이 값 이하로 처음 등장하면 도착으로 추정
# (폴링 간격 45초 안에 등장·도착·출발이 끝나는 경우 대비)
FIRST_SIGHT_ARRIVAL_SEC = 30

CACHE_TTL = 100  # 캐시 TTL (초) — 폴링 간격(45초)의 2.2배 (1회 미싱 버퍼)

# 혼잡도 로그는 (stop_id, plate)당 이 간격(초)에 한 번만 저장 (crowding_flow.py가
# 30분 버킷 집계만 하므로 5분 해상도로 충분 — DB 무한증가 방지)
CROWDING_THROTTLE_SEC = 300

# ── ETA 자가 채점 예측 버퍼 ───────────────────────────────────────────────
# 폴링마다 plate별 (관측시각 epoch, 예측초)를 Redis list에 쌓아 두고, 도착 판정
# (detected) 시 회수해 오차 샘플(bus_eta_samples)로 변환한다. TTL 15분 — 예측
# 리드타임 상한이자, 도착을 못 잡은 차량의 버퍼가 다음 운행에 섞이지 않는 상한.
ETA_PRED_TTL = 900
# plate당 버퍼 상한. 45초 폴링 × 15분 ≈ 20건 + 여유 (LTRIM으로 오래된 것부터 버림)
ETA_PRED_MAX = 40


def _eta_pred_key(station_id: str, plate: str) -> str:
    return f"bus:eta_pred:{station_id}:{plate}"


async def _record_eta_predictions(redis, station_id: str, records: list[tuple[str, int]], now: datetime) -> None:
    """이번 폴링의 plate별 예측을 버퍼에 적재. 실패해도 폴링 본류를 막지 않는다."""
    if not records:
        return
    now_epoch = int(now.timestamp())
    try:
        pipe = redis.pipeline()
        for plate, sec in records:
            key = _eta_pred_key(station_id, plate)
            pipe.rpush(key, json.dumps([now_epoch, sec]))
            pipe.ltrim(key, -ETA_PRED_MAX, -1)
            pipe.expire(key, ETA_PRED_TTL)
        await pipe.execute()
    except Exception:
        logger.warning("ETA 예측 버퍼 적재 실패 (정류장 %s)", station_id, exc_info=True)


async def _collect_eta_samples(
    redis,
    station_id: str,
    stop_id: int,
    arrived: list[tuple[str, str]],
    now: datetime,
) -> list[BusEtaSample]:
    """도착 확정(detected) plate들의 예측 버퍼를 회수해 오차 샘플로 변환한다.

    arrived: (plate_no, route_number) 목록.
    각 예측 (t, p)에 대해 error_sec = 실제도착 epoch − (t + p), lead_sec = p.
    """
    if not arrived:
        return []

    pipe = redis.pipeline()
    for plate, _ in arrived:
        pipe.lrange(_eta_pred_key(station_id, plate), 0, -1)
    raw_lists = await pipe.execute()

    # 회수한 버퍼는 즉시 삭제 — 같은 차량의 다음 운행에 재사용되면 안 된다
    del_pipe = redis.pipeline()
    for plate, _ in arrived:
        del_pipe.delete(_eta_pred_key(station_id, plate))
    await del_pipe.execute()

    arrived_epoch = int(now.timestamp())
    samples: list[BusEtaSample] = []
    for (plate, route_number), raw in zip(arrived, raw_lists):
        for entry in raw or []:
            try:
                observed_epoch, predicted_sec = json.loads(entry)
                observed_epoch = int(observed_epoch)
                predicted_sec = int(predicted_sec)
            except (TypeError, ValueError):
                continue
            if predicted_sec <= 0:
                continue
            samples.append(BusEtaSample(
                route_number=route_number,
                station_id=stop_id,
                plate_no=plate,
                lead_sec=predicted_sec,
                error_sec=arrived_epoch - (observed_epoch + predicted_sec),
                observed_at=datetime.fromtimestamp(observed_epoch, tz=_KST),
            ))
    return samples

def _predict_sec_from_item(item: dict, suffix: str) -> int:
    """GBIS 응답 한 건에서 predictTimeSec(suffix) 추출. 누락 시 분 단위 폴백.

    분 단위 폴백은 중간값 보정으로 평균 +30s bias 제거 → max(0, minutes*60 - 30).
    """
    sec = int(item.get(f"predict_time_sec{suffix}", 0) or 0)
    if sec:
        return sec
    minutes = item.get(f"predict_time{suffix}", 0) or 0
    return max(0, int(minutes) * 60 - 30)


# 노선번호별 최소 폴링 간격 (초). 빈 dict = 전 노선 매 사이클 처리.
ROUTE_POLL_INTERVALS: dict[str, int] = {}


async def _is_route_due(redis, stop_id: int, route_id: int, route_number: str) -> bool:
    interval = ROUTE_POLL_INTERVALS.get(route_number)
    if not interval:
        return True
    key = f"bus:route_poll:{stop_id}:{route_id}"
    if await redis.exists(key):
        return False
    await redis.set(key, "1", ex=interval)
    return True


def _day_type(dt: datetime) -> str:
    wd = dt.weekday()
    if wd < 5:
        return "weekday"
    if wd == 5:
        return "saturday"
    return "sunday"


async def _load_realtime_stations(db) -> list[dict]:
    """명시적으로 등록된 노선·방향별 GBIS 관측 정류장 목록 로드."""
    stmt = (
        select(BusRealtimeTarget)
        .where(BusRealtimeTarget.enabled.is_(True))
        .options(
            selectinload(BusRealtimeTarget.route),
            selectinload(BusRealtimeTarget.stop),
        )
    )
    result = await db.execute(stmt)
    bindings = result.scalars().all()

    grouped: dict[int, dict] = {}
    for binding in bindings:
        route = binding.route
        stop = binding.stop
        if not route.gbis_route_id or not stop.gbis_station_id:
            continue
        target = grouped.setdefault(stop.id, {
            "stop_id": stop.id,
            "stop_name": stop.name,
            "gbis_station_id": stop.gbis_station_id,
            "routes": {},
            "travel_directions": {},
        })
        target["routes"][route.gbis_route_id] = route
        target["travel_directions"][route.gbis_route_id] = binding.travel_direction
    return list(grouped.values())


async def poll_and_collect():
    """1회 폴링 사이클: GBIS 호출 → 캐시 저장 → 도착 판정 → DB 기록."""
    redis = await get_redis()
    now = datetime.now(_KST)

    async with AsyncSessionLocal() as db:
        targets = await _load_realtime_stations(db)

        for i, target in enumerate(targets):
            if i > 0:
                await asyncio.sleep(0.5)  # GBIS API 버스트 요청 방지

            station_id = target["gbis_station_id"]
            try:
                items = await asyncio.wait_for(fetch_arrivals(station_id), timeout=12)
            except asyncio.TimeoutError:
                logger.warning("GBIS 폴링 타임아웃 (정류장 %s, %s)", target["stop_name"], station_id)
                continue
            except Exception:
                logger.warning("GBIS 폴링 실패 (정류장 %s)", target["stop_name"], exc_info=True)
                continue

            # ── 1. Redis 캐시 저장 (프론트 응답용) ─────────────────────
            # route 매칭 후 프론트에 내려줄 형태로 변환
            gbis_id_to_route: dict[str, BusRoute] = target["routes"]
            travel_directions: dict[str, str] = target["travel_directions"]
            arrivals_for_cache = []

            # 이번 사이클에 실제로 처리할 노선 (간격 미달 노선 제외)
            due_routes: dict[str, BusRoute] = {}
            for gbis_route_id, route in gbis_id_to_route.items():
                if await _is_route_due(redis, target["stop_id"], route.id, route.route_number):
                    due_routes[gbis_route_id] = route

            for item in items:
                route = due_routes.get(item["route_id"])
                if not route:
                    continue

                sec1 = _predict_sec_from_item(item, "1")
                sec2 = _predict_sec_from_item(item, "2")

                if sec1:
                    arrivals_for_cache.append({
                        "route_id": route.id,
                        "route_no": route.route_number,
                        "destination": route.direction_name,
                        "category": route.category,
                        "travel_direction": travel_directions[item["route_id"]],
                        "arrival_type": "realtime",
                        "depart_at": None,
                        "arrive_in_seconds": sec1,
                        "is_tomorrow": False,
                        "crowded": item.get("crowded1", 0),
                        "location_no": item.get("location_no1", 0),
                        # 광역버스 잔여좌석 (-1 = 정보 없음, 0 = 만차)
                        "remain_seat": item.get("remain_seat1", -1),
                    })
                if sec2:
                    arrivals_for_cache.append({
                        "route_id": route.id,
                        "route_no": route.route_number,
                        "destination": route.direction_name,
                        "category": route.category,
                        "travel_direction": travel_directions[item["route_id"]],
                        "arrival_type": "realtime",
                        "depart_at": None,
                        "arrive_in_seconds": sec2,
                        "is_tomorrow": False,
                        "crowded": item.get("crowded2", 0),
                        "location_no": item.get("location_no2", 0),
                        "remain_seat": item.get("remain_seat2", -1),
                    })

            # cached_at을 함께 저장해 서빙 시 경과 시간만큼 arrive_in_seconds를 보정
            cache_payload = {
                "cached_at": now.isoformat(),
                "arrivals": arrivals_for_cache,
            }
            cache_key = f"bus:arrivals:{target['stop_id']}"
            await redis.set(
                cache_key,
                json.dumps(cache_payload, ensure_ascii=False),
                ex=CACHE_TTL,
            )

            # ── 1-1. ETA 자가 채점: plate별 예측 버퍼 적재 ─────────────
            # 도착 판정은 plate1만 추적하지만, 예측 기록은 plate2도 포함한다 —
            # 두 번째 차량이던 시절의 예측도 그 차량이 도착하면 유효한 표본이다.
            pred_records: list[tuple[str, int]] = []
            for item in items:
                if item["route_id"] not in due_routes:
                    continue
                for suffix in ("1", "2"):
                    plate = item.get(f"plate_no{suffix}", "") or ""
                    sec = _predict_sec_from_item(item, suffix)
                    if plate and sec > 0:
                        pred_records.append((plate, sec))
            await _record_eta_predictions(redis, station_id, pred_records, now)

            # ── 2. 도착 판정 ──────────────────────────────────────────
            # 현재 상태: due_routes 한정 (간격 미달 노선은 도착 판정도 스킵)
            current_state: dict[str, dict] = {}
            for item in items:
                route = due_routes.get(item["route_id"])
                if not route:
                    continue
                plate = item.get("plate_no1", "")
                sec = _predict_sec_from_item(item, "1")
                if plate and sec:
                    current_state[plate] = {
                        "route_id": item["route_id"],
                        "db_route_id": route.id,
                        "sec": sec,
                    }

            # 이전 상태 로드
            prev_key = f"bus:prev:{station_id}"
            prev_raw = await redis.get(prev_key)
            prev_state: dict[str, dict] = json.loads(prev_raw) if prev_raw else {}

            new_arrivals: list[BusArrivalHistory] = []

            # ── 2a. 이전에 있었는데 지금 없는 차량 → 도착 판정 ──
            #    plate 마다 EXISTS+SET 직렬 호출이던 것을 pipeline 으로 묶는다.
            arrived_plates = list(set(prev_state.keys()) - set(current_state.keys()))
            # detected 도착 plate — ETA 자가 채점 버퍼 회수 대상 (plate, route_number)
            eta_arrived: list[tuple[str, str]] = []
            if arrived_plates:
                pipe = redis.pipeline()
                for plate in arrived_plates:
                    pipe.exists(f"bus:counted:{station_id}:{plate}")
                counted_flags = await pipe.execute()
                set_pipe = redis.pipeline()
                set_pending = 0
                for plate, flag in zip(arrived_plates, counted_flags):
                    if flag:
                        continue
                    prev = prev_state[plate]
                    if prev.get("sec", 9999) <= ARRIVAL_THRESHOLD_SEC:
                        new_arrivals.append(BusArrivalHistory(
                            route_id=prev["db_route_id"],
                            stop_id=target["stop_id"],
                            plate_no=plate,
                            arrived_at=now,
                            day_type=_day_type(now),
                            source="detected",
                        ))
                        arrived_route = gbis_id_to_route.get(prev.get("route_id"))
                        if arrived_route is not None:
                            eta_arrived.append((plate, arrived_route.route_number))
                        set_pipe.set(f"bus:counted:{station_id}:{plate}", "1", ex=600)
                        set_pending += 1
                        logger.info(
                            "도착 판정: %s → %s (이전 %d초)",
                            plate, target["stop_name"], prev["sec"],
                        )
                if set_pending:
                    await set_pipe.execute()

            # ── 2b. 이번 폴링에 처음 등장 + sec ≤ 30 → 도착 추정 ──
            first_sight_plates = [p for p in current_state.keys() if p not in prev_state]
            if first_sight_plates:
                pipe = redis.pipeline()
                for plate in first_sight_plates:
                    pipe.exists(f"bus:counted:{station_id}:{plate}")
                counted_flags = await pipe.execute()
                set_pipe = redis.pipeline()
                set_pending = 0
                for plate, flag in zip(first_sight_plates, counted_flags):
                    if flag:
                        continue
                    state = current_state[plate]
                    if state["sec"] <= FIRST_SIGHT_ARRIVAL_SEC:
                        new_arrivals.append(BusArrivalHistory(
                            route_id=state["db_route_id"],
                            stop_id=target["stop_id"],
                            plate_no=plate,
                            arrived_at=now,
                            day_type=_day_type(now),
                            source="estimated",
                        ))
                        set_pipe.set(f"bus:counted:{station_id}:{plate}", "1", ex=600)
                        set_pending += 1
                        logger.info(
                            "첫등장 도착 추정: %s → %s (sec %d)",
                            plate, target["stop_name"], state["sec"],
                        )
                if set_pending:
                    await set_pipe.execute()

            # ── 2c. detected 도착 plate의 예측 버퍼 회수 → 오차 샘플 ──
            # 부가 기능이므로 실패해도 도착 기록 커밋을 막지 않는다.
            eta_samples: list[BusEtaSample] = []
            if eta_arrived:
                try:
                    eta_samples = await _collect_eta_samples(
                        redis, station_id, target["stop_id"], eta_arrived, now
                    )
                except Exception:
                    logger.warning(
                        "ETA 예측 버퍼 회수 실패 (정류장 %s)",
                        target["stop_name"], exc_info=True,
                    )

            if new_arrivals or eta_samples:
                db.add_all([*new_arrivals, *eta_samples])
                await db.commit()

            # ── 3. 혼잡도 로그 저장 (plate별 5분 스로틀) ──────────────────────
            # 45초마다 무조건 INSERT하면 bus_crowding_logs가 무한 증가한다.
            # 소비처(crowding_flow.py)는 30분 버킷 집계뿐이라 5분 해상도로 충분.
            crowding_candidates: list[dict] = []
            for item in items:
                route = due_routes.get(item["route_id"])
                if not route:
                    continue
                for suffix, crowded_key, plate_key in [
                    ("1", "crowded1", "plate_no1"),
                    ("2", "crowded2", "plate_no2"),
                ]:
                    crowded = item.get(crowded_key, 0)
                    sec = _predict_sec_from_item(item, suffix)
                    plate = item.get(plate_key, "") or ""
                    if crowded and sec:
                        # 빈 plate 차량들이 한 키로 뭉쳐 전부 드롭되지 않도록
                        # route.id를 discriminator로 사용
                        discriminator = plate or f"r{route.id}"
                        crowding_candidates.append({
                            "route_id": route.id,
                            "plate_no": plate,
                            "crowded": crowded,
                            "arrive_in_seconds": sec,
                            "throttle_key": f"bus:crowd_logged:{target['stop_id']}:{discriminator}",
                        })

            crowding_logs: list[BusCrowdingLog] = []
            if crowding_candidates:
                acquired_flags = None
                try:
                    pipe = redis.pipeline()
                    for cand in crowding_candidates:
                        pipe.set(cand["throttle_key"], "1", ex=CROWDING_THROTTLE_SEC, nx=True)
                    acquired_flags = await pipe.execute()
                except Exception:
                    logger.warning(
                        "혼잡도 스로틀 조회 실패 — 이번 사이클 혼잡도 저장 스킵 (정류장 %s)",
                        target["stop_name"], exc_info=True,
                    )

                if acquired_flags is not None:
                    for cand, acquired in zip(crowding_candidates, acquired_flags):
                        if not acquired:
                            continue  # 최근 5분 내 이미 기록됨
                        crowding_logs.append(BusCrowdingLog(
                            route_id=cand["route_id"],
                            stop_id=target["stop_id"],
                            plate_no=cand["plate_no"],
                            crowded=cand["crowded"],
                            arrive_in_seconds=cand["arrive_in_seconds"],
                            recorded_at=now,
                        ))

            if crowding_logs:
                db.add_all(crowding_logs)
                await db.commit()

            # 현재 상태를 이전 상태로 저장 (45초 폴링 × 3.7사이클 버퍼)
            await redis.set(prev_key, json.dumps(current_state, ensure_ascii=False), ex=170)

    logger.info("버스 폴링 완료 (%d 정류장)", len(targets))
