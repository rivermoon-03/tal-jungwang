"""APScheduler 기반 교통정보 주기 수집 스케줄러."""

import logging
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


async def _bus_poll_job():
    """스케줄러에서 호출되는 버스 도착정보 폴링 작업.

    운행 시간(06:00~22:59 KST)에만 GBIS API를 호출한다.
    IntervalTrigger로 120초마다 호출되며, 시간대 밖이면 즉시 반환.
    """
    hour = datetime.now(_KST).hour
    if not (6 <= hour <= 22):
        return  # 심야 시간 제외

    from app.services.bus_collector import poll_and_collect

    try:
        await poll_and_collect()
    except Exception:
        logger.exception("Bus arrival polling failed")


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

    # ── 버스 도착정보 폴링 (120초 간격, 06:00~22:59 KST 시간 체크는 job 내부) ──
    # CronTrigger 대신 IntervalTrigger를 사용해 APScheduler 재스케줄링 문제 방지
    scheduler.add_job(
        _bus_poll_job,
        IntervalTrigger(seconds=120),
        id="bus_arrival_poll",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info("Bus arrival polling scheduler configured (every 120s, active 06:00-22:59 KST)")


def start_scheduler():
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
