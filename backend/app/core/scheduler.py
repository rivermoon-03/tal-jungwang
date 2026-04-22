"""APScheduler 기반 교통정보 주기 수집 스케줄러."""

import logging
import time as _time
from datetime import datetime, timezone
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


async def _weather_refresh_job():
    """날씨 캐시를 갱신하는 스케줄 작업 (05:00~24:00 KST)."""
    hour = datetime.now(_KST).hour
    if not (5 <= hour <= 23):
        return  # 심야 제외

    from app.services.weather import refresh_weather_cache

    try:
        await refresh_weather_cache()
    except Exception:
        logger.exception("날씨 캐시 갱신 실패")


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
    """
    hour = datetime.now(_KST).hour
    if 2 <= hour < 4:
        return  # 02~03시 운행 없음

    from app.services.bus_collector import poll_and_collect

    try:
        await poll_and_collect()
    except Exception:
        logger.exception("Bus arrival polling failed")


async def _subway_realtime_poll_job():
    """서울 지하철 실시간 도착정보 폴링 (정왕·시흥시청·초지).

    피크(07~09, 17~19): 15초마다 실제 호출.
    비피크: 20초 미만 경과 시 스킵 (15초 job이 돌지만 실제 API는 20초 주기).
    새벽(01~05): 첫차 없으므로 스킵.
    """
    hour = datetime.now(_KST).hour
    if 1 <= hour < 5:
        return

    is_peak = (7 <= hour < 9) or (17 <= hour < 19)

    from app.core.cache import get_redis
    from app.services.subway_realtime import STATIONS, _last_fetch_key, fetch_and_cache_realtime

    redis = await get_redis()
    for station in STATIONS:
        if not is_peak:
            last_raw = await redis.get(_last_fetch_key(station))
            if last_raw and (_time.time() - float(last_raw)) < 20:
                continue
        try:
            await fetch_and_cache_realtime(station)
        except Exception:
            logger.exception("지하철 실시간 폴링 실패: %s", station)


def setup_scheduler():
    """스케줄러에 교통정보 수집 작업을 등록한다.

    러시아워 (07~10, 16~19): 20분 간격
    그 외 시간 (05~07, 10~16, 19~23): 60분 간격
    심야 (23~05): 수집 안 함
    """
    # 러시아워: 매시 00, 20, 40분
    scheduler.add_job(
        _collect_job,
        CronTrigger(hour="7-9", minute="*/20"),
        id="traffic_rush_morning",
        replace_existing=True,
    )
    scheduler.add_job(
        _collect_job,
        CronTrigger(hour="16-18", minute="*/20"),
        id="traffic_rush_evening",
        replace_existing=True,
    )

    # 비러시아워: 매시 정각
    scheduler.add_job(
        _collect_job,
        CronTrigger(hour="5-6,10-15,19-22", minute="0"),
        id="traffic_offpeak",
        replace_existing=True,
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
    logger.info("Bus arrival polling scheduler configured (every 45s, skip 02:00-03:59 KST)")

    # ── 날씨 캐시 선갱신 (10분 간격, 05:00~23:59 KST 시간 체크는 job 내부) ──
    scheduler.add_job(
        _weather_refresh_job,
        IntervalTrigger(minutes=60),
        id="weather_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info("Weather cache refresh scheduler configured (every 60min, active 05:00-23:59 KST)")

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

    # ── 지하철 실시간 폴링 (15초 간격, 내부에서 비피크/새벽 스킵) ──
    # 피크: 15초 폴링 × 3역, 비피크: 20초 폴링 × 3역
    scheduler.add_job(
        _subway_realtime_poll_job,
        IntervalTrigger(seconds=15),
        id="subway_realtime_poll",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=10,
    )
    logger.info("Subway realtime polling scheduler configured (every 15s peak / 20s off-peak, 3 stations)")


def start_scheduler():
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
