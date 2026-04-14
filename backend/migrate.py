"""컨테이너 시작 시 Alembic 마이그레이션 실행 후 uvicorn 기동."""
import os
import sys

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

SEP = "=" * 42


def get_db_url() -> str:
    return (
        f"postgresql+psycopg2://{os.environ['DB_USER']}:{os.environ['DB_PASSWORD']}"
        f"@{os.environ.get('DB_HOST', 'localhost')}:{os.environ.get('DB_PORT', '5432')}"
        f"/{os.environ['DB_NAME']}"
    )


def main():
    print(SEP)
    print("  DB 마이그레이션 확인 중...")
    print(SEP)

    cfg = Config("/app/alembic.ini")
    cfg.set_main_option("script_location", "/app/alembic")
    cfg.set_main_option("sqlalchemy.url", get_db_url())

    script = ScriptDirectory.from_config(cfg)

    # 전체 revision 수
    all_revs = list(script.walk_revisions())
    total = len(all_revs)

    # 현재 DB revision
    engine = create_engine(get_db_url())
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        current_heads = ctx.get_current_heads()
    engine.dispose()

    # 적용된 / 미적용 계산
    if not current_heads:
        applied = 0
    else:
        # script의 iterate_revisions으로 current까지의 revision 수 계산
        applied = 0
        for rev in script.walk_revisions():
            applied += 1
            if rev.revision in current_heads:
                break

    pending = total - applied

    print(f"  전체 마이그레이션: {total}개")
    print(f"  이미 적용됨:       {applied}개")
    print(f"  미적용(pending):   {pending}개")
    print()

    if pending == 0 and applied > 0:
        print("  ✓ 모두 최신 상태 — 마이그레이션 불필요")
    else:
        print("  → alembic upgrade head 실행...")
        command.upgrade(cfg, "head")
        print(f"  ✓ 마이그레이션 완료 ({pending}개 적용됨)")

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
