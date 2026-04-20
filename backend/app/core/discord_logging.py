"""Discord 웹훅 로깅 핸들러 — 서버 WARNING/ERROR를 채널로 전송."""
import logging
import queue
import threading
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

_KST = ZoneInfo("Asia/Seoul")


class _KSTFormatter(logging.Formatter):
    """asctime을 KST (Asia/Seoul) 기준으로 출력."""

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        dt = datetime.fromtimestamp(record.created, tz=_KST)
        return dt.strftime(datefmt or "%Y-%m-%d %H:%M:%S")

logger = logging.getLogger(__name__)

_DISCORD_LIMIT = 1900
_DEDUPE_WINDOW_SEC = 60
_DEDUPE_RETENTION_SEC = 600
_QUEUE_MAX = 200

# 무한루프·노이즈 방지: 해당 로거 이름으로 시작하는 레코드는 전송하지 않음
_SKIP_LOGGERS = (
    "httpx",
    "httpcore",
    "urllib3",
    "app.core.discord_logging",
    "app.services.bus_monitor",  # 버스 리포트 웹훅 자체 로그 제외
)


class DiscordLogHandler(logging.Handler):
    """WARNING 이상 레벨의 로그를 Discord 웹훅으로 비동기 전송."""

    def __init__(self, webhook_url: str, level: int = logging.WARNING):
        super().__init__(level)
        self.webhook_url = webhook_url
        self._queue: queue.Queue[tuple[int, str]] = queue.Queue(maxsize=_QUEUE_MAX)
        self._recent: dict[tuple[str, int, str], float] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._worker = threading.Thread(
            target=self._run, name="discord-log-handler", daemon=True
        )
        self._worker.start()

    def close(self) -> None:
        self._stop.set()
        super().close()

    def emit(self, record: logging.LogRecord) -> None:
        try:
            if any(record.name == n or record.name.startswith(n + ".") for n in _SKIP_LOGGERS):
                return

            now = time.time()
            key = (record.name, record.levelno, record.getMessage()[:120])
            with self._lock:
                last = self._recent.get(key, 0)
                if now - last < _DEDUPE_WINDOW_SEC:
                    return
                self._recent[key] = now
                # 오래된 엔트리 청소
                if len(self._recent) > 256:
                    cutoff = now - _DEDUPE_RETENTION_SEC
                    self._recent = {k: v for k, v in self._recent.items() if v >= cutoff}

            formatted = self.format(record)
            try:
                self._queue.put_nowait((record.levelno, formatted))
            except queue.Full:
                pass  # 큐가 가득 차면 조용히 드롭
        except Exception:
            # 로깅 핸들러는 절대 예외를 전파하면 안 됨
            self.handleError(record)

    def _run(self) -> None:
        with httpx.Client(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
            while not self._stop.is_set():
                try:
                    lvl, msg = self._queue.get(timeout=1.0)
                except queue.Empty:
                    continue

                icon = "🚨" if lvl >= logging.ERROR else "⚠️"
                level_name = logging.getLevelName(lvl)
                # 코드블록 안전화: 백틱 제거
                safe_msg = msg.replace("```", "'''")
                body = f"{icon} **{level_name}**\n```\n{safe_msg}\n```"
                if len(body) > _DISCORD_LIMIT:
                    body = body[: _DISCORD_LIMIT - 20] + "\n...```"

                try:
                    client.post(self.webhook_url, json={"content": body})
                except Exception:
                    # 전송 실패는 stdout 로거로만 — 자기 자신으로는 전파하지 않음
                    pass


def install_discord_logging(webhook_url: str) -> DiscordLogHandler | None:
    """루트 로거에 Discord 핸들러를 부착. webhook_url 비어있으면 no-op."""
    if not webhook_url:
        logger.info("DISCORD_ERROR_WEBHOOK_URL 미설정 — 에러 알림 비활성화")
        return None

    handler = DiscordLogHandler(webhook_url, level=logging.WARNING)
    fmt = _KSTFormatter(
        "[%(asctime)s KST] %(name)s\n%(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(fmt)
    root = logging.getLogger()
    # 중복 부착 방지
    for h in root.handlers:
        if isinstance(h, DiscordLogHandler):
            root.removeHandler(h)
    root.addHandler(handler)
    logger.info("Discord 에러 로깅 핸들러 부착 완료 (WARNING+)")
    return handler
