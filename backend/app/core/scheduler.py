"""APScheduler 기반 교통정보 주기 수집 스케줄러."""

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


async def _collect_job():
    """스케줄러에서 호출되는 교통정보 수집 작업."""
    from app.services.traffic import collect_traffic

    try:
        count = await collect_traffic()
        logger.info("Scheduled traffic collection: %d records", count)
    except Exception:
        logger.exception("Scheduled traffic collection failed")


async def _bus_poll_job():
    """스케줄러에서 호출되는 버스 도착정보 폴링 작업."""
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

    # ── 버스 도착정보 폴링 (06:00~22:00, 2분 간격) ──────────────────
    scheduler.add_job(
        _bus_poll_job,
        CronTrigger(hour="6-21", minute="*/2"),
        id="bus_arrival_poll",
        replace_existing=True,
    )
    logger.info("Bus arrival polling scheduler configured (06:00-22:00, every 2min)")


def start_scheduler():
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
