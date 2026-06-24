import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_REQUIRED_API_KEYS = ("KAKAO_MOBILITY_REST_KEY", "TMAP_APP_KEY", "DATA_GO_KR_SERVICE_KEY", "SEOUL_SUBWAY_KEY")


class Settings(BaseSettings):
    # ── 외부 API ─────────────────────────────────────────────
    KAKAO_MOBILITY_REST_KEY: str = ""
    TMAP_APP_KEY: str = ""
    DATA_GO_KR_SERVICE_KEY: str = ""
    SEOUL_SUBWAY_KEY: str = ""

    # ── PostgreSQL ───────────────────────────────────────────
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str

    # ── Redis ────────────────────────────────────────────────
    REDIS_HOST: str
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""

    # ── 관리자 / JWT ─────────────────────────────────────────
    ADMIN_USERNAME: str
    ADMIN_PASSWORD_HASH: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # ── 앱 설정 ──────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str

    # ── 모니터링 도구 자격증명 ────────────────────────────────
    PGADMIN_DEFAULT_EMAIL: str = "admin@local.dev"
    PGADMIN_DEFAULT_PASSWORD: str = ""
    GF_SECURITY_ADMIN_USER: str = "admin"
    GF_SECURITY_ADMIN_PASSWORD: str = ""
    METRICS_TOKEN: str = ""

    # ── Discord 웹훅 (버스 도착 수집 모니터링) ─────────────────
    DISCORD_WEBHOOK_URL: str = ""

    # ── Discord 웹훅 (서버 WARNING/ERROR 알림) ─────────────────
    DISCORD_ERROR_WEBHOOK_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def _warn_missing_keys(self) -> "Settings":
        for key in _REQUIRED_API_KEYS:
            if not getattr(self, key):
                logger.warning(
                    "[config] %s 가 설정되지 않았습니다 — 해당 외부 API 호출이 실패합니다.", key
                )
        if not self.REDIS_PASSWORD:
            logger.warning(
                "[config] REDIS_PASSWORD 가 설정되지 않았습니다 — Redis가 인증 없이 연결됩니다."
            )
        if self.JWT_SECRET_KEY in ("secret", "CHANGE_ME_openssl_rand_hex_32", ""):
            logger.warning(
                "[config] JWT_SECRET_KEY 가 기본값입니다 — 프로덕션 배포 전 반드시 교체하세요."
            )
        # allow_credentials=True 인 CORS 설정에서 와일드카드 출처는 브라우저가 거부할 뿐 아니라
        # 쿠키/인증 정보를 아무 사이트에나 노출하는 위험이 있다. 프로덕션에선 막는다.
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]
        if "*" in origins:
            if self.ENVIRONMENT == "production":
                raise ValueError(
                    "ALLOWED_ORIGINS 에 '*' 는 사용할 수 없습니다 "
                    "(allow_credentials=True 와 충돌). 명시적 출처를 지정하세요."
                )
            logger.warning(
                "[config] ALLOWED_ORIGINS 에 '*' 가 포함되어 있습니다 — 인증 쿠키와 함께 쓰면 위험합니다."
            )
        return self

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def redis_url(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


settings = Settings()
