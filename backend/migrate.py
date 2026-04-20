"""컨테이너 시작 시 DB 연결 확인 후 uvicorn 기동."""
import os
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

SEP = "=" * 42


def get_db_url() -> str:
    return (
        f"postgresql+psycopg2://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
        f"@{os.environ.get('DB_HOST', 'localhost')}:{os.environ.get('DB_PORT', '5432')}"
        f"/{os.environ['DB_NAME']}"
    )


def wait_for_db(url: str, retries: int = 15, delay: float = 2.0) -> None:
    """postgres가 완전히 준비될 때까지 최대 retries × delay 초 동안 대기."""
    engine = create_engine(url)
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine.dispose()
            return
        except OperationalError as e:
            if attempt == retries:
                engine.dispose()
                raise
            print(f"  DB 연결 대기 중... ({attempt}/{retries}) — {e.__class__.__name__}")
            time.sleep(delay)


def main():
    print(SEP)
    print("  DB 연결 확인 중...")
    print(SEP)

    wait_for_db(get_db_url())
    print("  ✓ DB 연결 성공")

    print(SEP)
    print("  서버 시작")
    print(SEP)
    sys.stdout.flush()

    os.execvp("uvicorn", [
        "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
    ])


if __name__ == "__main__":
    main()
