"""APScheduler 기반 교통정보 주기 수집 스케줄러."""

import logging
import time as _time
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
_KST = ZoneInfo("Asia/Seoul")


async def _collect_job():
    """스케줄러에서 호출되는 교통정보 수집 작업."""
    from app.services.traffic import collect_traffic

    try:
        count = await collect_traffic()
        logger.info("Scheduled traffic collection: %d records", count)
    except Exception:
        logger.exception("Scheduled traffic collection failed")


async def _weather_live_refresh_job():
    """초단기실황(현재 기온/체감/실황) 캐시를 매시간 갱신 (05:00~23:59 KST).

    TTL=3600초(1시간), cron=60분 → TTL ≤ cron 간격 준수.
    """
    hour = datetime.now(_KST).hour
    if not (5 <= hour <= 23):
        return  # 심야 제외

    from app.services.weather import refresh_weather_live_cache

    try:
        await refresh_weather_live_cache()
    except Exception:
        logger.exception("초단기실황 캐시 갱신 실패")


async def _weather_forecast_refresh_job():
    """단기예보(12~72시간) 캐시를 3시간 주기로 갱신.

    KMA 단기예보는 02·05·08·11·14·17·20·23시에 발표되고, 발표 후 ~10분부터
    응답이 가능하다. 본 job은 발표 후 충분한 시간(발표+15분)에 실행되도록
    CronTrigger(hour="2,5,8,11,14,17,20,23", minute=15)로 등록된다.

    TTL=10800초(3시간), cron=3시간 주기 → TTL ≤ cron 간격 준수.
    """
    from app.services.weather import refresh_weather_forecast_cache

    try:
        await refresh_weather_forecast_cache()
    except Exception:
        logger.exception("단기예보 캐시 갱신 실패")


async def _bus_report_job():
    """버스 도착 수집 현황을 Discord 웹훅으로 3시간마다 전송."""
    from app.services.bus_monitor import send_bus_arrival_report

    try:
        await send_bus_arrival_report(window_hours=3)
    except Exception:
        logger.exception("Bus arrival report failed")


async def _bus_poll_job():
    """스케줄러에서 호출되는 버스 도착정보 폴링 작업.

    02:00~03:59 KST(막차 이후 첫차 이전)에는 GBIS API를 호출하지 않는다.
    IntervalTrigger로 45초마다 호출되며, 심야 시간대엔 즉시 반환.

    전체 폴링에 40초 타임아웃을 걸어 네트워크 hung 등으로 인한 영구 블록을
    방지한다 (폴링 간격 45초보다 짧아 max_instances=1 deadlock 자가복구).
    """
    import asyncio

    hour = datetime.now(_KST).hour
    if 2 <= hour < 4:
        return  # 02~03시 운행 없음

    from app.services.bus_collector import poll_and_collect

    try:
        await asyncio.wait_for(poll_and_collect(), timeout=40)
    except asyncio.TimeoutError:
        logger.warning("Bus arrival polling timed out (>40s) — skipping cycle")
    except Exception:
        logger.exception("Bus arrival polling failed")


async def _cafeteria_refresh_job():
    """학식 메뉴·운영시간 캐시를 강제 갱신 (07~21시 매시 KST).

    메뉴 TTL이 1h라 점심 갱신만으로는 저녁 시간대에 만료되어 cold miss가 났다.
    개장 시간 내내 매시 재적재해 운영시간/메뉴 캐시를 계속 warm하게 유지한다.
    """
    from app.services.cafeteria import refresh_menu

    try:
        await refresh_menu()
        logger.info("학식 메뉴 캐시 갱신 완료")
    except Exception:
        logger.exception("학식 메뉴 캐시 갱신 실패")


async def _cache_rewarm_job():
    """정적/준정적 캐시(버스·지하철·셔틀 시간표·지도 마커)를 TTL 만료 전 재적재.

    매일 03:40 KST — bus_arrival_stats(03:30) 직후, GBIS 폴링 휴식(02~04시) 안쪽이라
    운영 트래픽과 겹치지 않는다. 특히 버스 시간표는 TTL 24h라 하루에 한 번 첫 사용자가
    cold miss를 맞았는데, 매일 재적재해 그 cold miss를 제거한다.
    """
    from app.core.cache_warmer import warm_static
    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            summary = await warm_static(session)
            logger.info("캐시 재적재 완료: %s", summary)
    except Exception:
        logger.exception("캐시 재적재 실패")


async def _bus_arrival_stats_refresh_job():
    """매일 03:30 KST에 bus_arrival_stats 전체 재계산.

    버스 폴링 휴식(02:00~03:59) 안쪽에서 동작해 운영 트래픽과 겹치지 않는다.
    """
    from app.core.database import AsyncSessionLocal
    from app.services.bus_stats import refresh_all_stats

    try:
        async with AsyncSessionLocal() as session:
            result = await refresh_all_stats(session)
            logger.info("bus_arrival_stats refresh: %s", result)
    except Exception:
        logger.exception("bus_arrival_stats refresh failed")


async def _crowding_stats_refresh_job():
    """매일 03:35 KST에 bus_crowding_stats 전체 재계산.

    bus_arrival_stats(03:30) 직후, cache_rewarm(03:40) 이전. 02:00~03:59 GBIS
    폴링 휴식 구간 안쪽이라 운영 트래픽/다른 나이틀리 job과 겹치지 않는다.
    """
    from app.core.database import AsyncSessionLocal
    from app.services.bus_crowding_stats import refresh_all_crowding_stats

    try:
        async with AsyncSessionLocal() as session:
            result = await refresh_all_crowding_stats(session)
            logger.info("bus_crowding_stats refresh: %s", result)
    except Exception:
        logger.exception("bus_crowding_stats refresh failed")


async def _subway_realtime_poll_job():
    """서울 지하철 실시간 도착정보 폴링 (정왕·시흥시청·초지).

    피크(07~09, 17~19): 15초마다 호출.
    비피크: 20초 미만 경과 시 스킵.
    심야(00:00~03:49): 10분 주기 호출 (24시간 체크).
    """
    now = datetime.now(_KST)
    hour = now.hour
    minute = now.minute

    is_late_night = (1 <= hour < 3) or (
        hour == 3 and minute < 50
    )  # 1시부터 3시 50분까지
    is_peak = (7 <= hour < 9) or (17 <= hour < 19)

    from app.core.cache import get_redis
    from app.services.subway_realtime import (
        STATIONS,
        _last_fetch_key,
        fetch_and_cache_realtime,
    )

    redis = await get_redis()
    for station in STATIONS:
        last_raw = await redis.get(_last_fetch_key(station))
        if last_raw:
            elapsed = _time.time() - float(last_raw)
            if is_late_night and elapsed < 600:
                continue
            elif not is_peak and not is_late_night and elapsed < 20:
                continue

        try:
            await fetch_and_cache_realtime(station)
        except Exception:
            logger.exception("지하철 실시간 폴링 실패: %s", station)


async def _purge_logs_job():
    """매일 03:45 KST에 로그성 테이블(bus_crowding_logs·bus_arrival_history·
    traffic_history)의 보존기간 초과 행을 배치 삭제.

    stats(03:30)·rewarm(03:40) 다음, 버스 폴링 휴식(02~04시) 안쪽이라
    운영 트래픽/다른 나이틀리 job과 겹치지 않는다.
    """
    from app.core.database import AsyncSessionLocal
    from app.services.retention import purge_old_logs

    try:
        async with AsyncSessionLocal() as session:
            summary = await purge_old_logs(session)
            logger.info("로그 보존정책 정리(job) 완료: %s", summary)
    except Exception:
        logger.exception("로그 보존정책 정리 실패")


def setup_scheduler():
    """스케줄러에 교통정보 수집 작업을 등록한다.

    러시아워 (07~10, 16~19): 20분 간격
    그 외 시간 (05~07, 10~16, 19~23): 60분 간격
    심야 (23~05): 수집 안 함
    """
    # 러시아워: 매시 00, 20, 40분
    # TTL 20분 수집 주기, misfire_grace_time 10분으로 Railway 재시작 등
    # 일시적 밀림도 다음 사이클에서 자가복구 가능하도록.
    scheduler.add_job(
        _collect_job,
        CronTrigger(hour="7-9", minute="*/20"),
        id="traffic_rush_morning",
        replace_existing=True,
        misfire_grace_time=600,
    )
    scheduler.add_job(
        _collect_job,
        CronTrigger(hour="16-18", minute="*/20"),
        id="traffic_rush_evening",
        replace_existing=True,
        misfire_grace_time=600,
    )

    # 비러시아워: 매시 정각
    # TTL 60분 수집 주기, misfire_grace_time 10분으로 다른 잡들과 일관성 유지.
    scheduler.add_job(
        _collect_job,
        CronTrigger(hour="5-6,10-15,19-22", minute="0"),
        id="traffic_offpeak",
        replace_existing=True,
        misfire_grace_time=600,
    )

    logger.info("Traffic collection scheduler configured")

    # ── 버스 도착정보 폴링 (45초 간격, 02:00~03:59 KST 제외) ──
    # 45s: 22h(04~02시) × 3600/45 × 4정류장 = 7,040호출/일 → GBIS 일 10,000회 한도의 70%
    scheduler.add_job(
        _bus_poll_job,
        IntervalTrigger(seconds=45),
        id="bus_arrival_poll",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=20,
    )
    logger.info(
        "Bus arrival polling scheduler configured (every 45s, skip 02:00-03:59 KST)"
    )

    # ── 초단기실황 캐시 갱신 (매시간 60분 간격, 05:00~23:59 KST) ──
    # TTL=1h(3600s), cron=60분 → TTL ≤ cron 간격 준수, cron 1회 누락도 자가회복
    scheduler.add_job(
        _weather_live_refresh_job,
        IntervalTrigger(minutes=60),
        id="weather_live_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info(
        "Weather live (current temp) cache refresh scheduler configured (every 60min, active 05:00-23:59 KST)"
    )

    # ── 단기예보 캐시 갱신 (3시간 주기: 02:15, 05:15, 08:15, 11:15, 14:15, 17:15, 20:15, 23:15 KST) ──
    # KMA 발표: 02·05·08·11·14·17·20·23시, 발표 후 ~10분부터 응답 가능
    # → 발표 후 15분에 조회해 충분한 데이터 확보
    # TTL=3h(10800s), cron=3시간 주기 → TTL ≤ cron 간격 준수
    scheduler.add_job(
        _weather_forecast_refresh_job,
        CronTrigger(hour="2,5,8,11,14,17,20,23", minute=15, timezone="Asia/Seoul"),
        id="weather_forecast_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,  # 5분 허용
    )
    logger.info(
        "Weather forecast cache refresh scheduler configured (every 3h at :15 KST)"
    )

    # ── 버스 도착 수집 리포트 (Discord 웹훅, 3시간마다 00/03/06/09/12/15/18/21 KST) ──
    scheduler.add_job(
        _bus_report_job,
        CronTrigger(hour="0,3,6,9,12,15,18,21", minute=0),
        id="bus_arrival_report",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info("Bus arrival Discord report configured (every 3h, 3h window)")

    # ── 지하철 실시간 폴링 (15초 간격, 내부에서 비피크 20초 / 심야 10분 스킵) ──
    # 피크: 15초 폴링, 비피크: 20초 폴링, 심야(00:00~03:49): 10분 폴링
    scheduler.add_job(
        _subway_realtime_poll_job,
        IntervalTrigger(seconds=15),
        id="subway_realtime_poll",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=10,
    )
    logger.info(
        "Subway realtime polling scheduler configured (00:00~03:49 10m / peak 15s / off-peak 20s)"
    )

    # ── 학식 메뉴 갱신 (매일 07~14시 매시 정각) ──
    # 학교가 월요일 오전 늦게(예: 09:21) 새 주차 식단을 업로드하는 케이스가 있어
    # 점심 시간 전까지 매시간 폴링한다. misfire_grace_time=600 으로 Railway
    # 컨테이너 재시작 등으로 잠시 밀려도 발화 보장.
    scheduler.add_job(
        _cafeteria_refresh_job,
        CronTrigger(hour="7-21", minute=0, timezone="Asia/Seoul"),
        id="cafeteria_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )
    logger.info("Cafeteria menu refresh scheduler configured (07~21:00 KST hourly)")

    # ── 버스 도착 통계 재계산 (매일 03:30 KST) ──
    # bus_arrival_history 28일치를 (route, stop, day_type, hour) 버킷별 분위수로 사전 집계.
    # 02:00~03:59는 GBIS 폴링 휴식 구간이라 트래픽 충돌 없음.
    scheduler.add_job(
        _bus_arrival_stats_refresh_job,
        CronTrigger(hour=3, minute=30, timezone="Asia/Seoul"),
        id="bus_arrival_stats_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info("Bus arrival stats refresh scheduler configured (daily 03:30 KST)")

    # ── 버스 혼잡도 통계 재계산 (매일 03:35 KST) ──
    # bus_crowding_logs 60일치를 (route, stop, day_type, 30분버킷)별로 사전 집계.
    # bus_arrival_stats(03:30) 직후, cache_rewarm(03:40) 이전 슬롯.
    scheduler.add_job(
        _crowding_stats_refresh_job,
        CronTrigger(hour=3, minute=35, timezone="Asia/Seoul"),
        id="bus_crowding_stats_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info("Bus crowding stats refresh scheduler configured (daily 03:35 KST)")

    # ── 정적/준정적 캐시 재적재 (매일 03:40 KST) ──
    # 버스(24h)·지하철(12h)·셔틀·마커 시간표 캐시를 TTL 만료 전 다시 채워
    # 첫 사용자 cold miss를 없앤다. stats(03:30) 직후, 폴링 휴식 구간 안쪽.
    scheduler.add_job(
        _cache_rewarm_job,
        CronTrigger(hour=3, minute=40, timezone="Asia/Seoul"),
        id="cache_rewarm",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )
    logger.info("Static cache rewarm scheduler configured (daily 03:40 KST)")

    # ── 로그 테이블 보존정책 정리 (매일 03:45 KST) ──
    # bus_crowding_logs(90d)·bus_arrival_history(90d)·traffic_history(180d)를
    # 배치 삭제. stats(03:30)·rewarm(03:40) 다음, 폴링 휴식 구간 안쪽.
    scheduler.add_job(
        _purge_logs_job,
        CronTrigger(hour=3, minute=45, timezone="Asia/Seoul"),
        id="log_retention_purge",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )
    logger.info("Log retention purge scheduler configured (daily 03:45 KST)")


def start_scheduler():
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
