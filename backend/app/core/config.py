import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_REQUIRED_API_KEYS = (
    "KAKAO_MOBILITY_REST_KEY",
    "TMAP_APP_KEY",
    "DATA_GO_KR_SERVICE_KEY",
    "SEOUL_SUBWAY_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
)


class Settings(BaseSettings):
    # ── 외부 API ─────────────────────────────────────────────
    KAKAO_MOBILITY_REST_KEY: str = ""
    TMAP_APP_KEY: str = ""
    DATA_GO_KR_SERVICE_KEY: str = ""
    # apis.data.go.kr 은 해외 네트워크 일부에서 TCP 연결을 받지 않는다(출발 네트워크마다 다르다).
    # 연결이 계속 실패하면 한국 안의 HTTP 프록시 주소(예: http://user:pass@1.2.3.4:3128)를 넣는다. 이 호스트로 가는 요청만 그 프록시를 거친다.
    DATA_GO_KR_PROXY: str = ""
    # 이 구간(KST, HH:MM)에는 사용자가 요청한 정류장만 GBIS 를 폴링한다.
    # 끝은 실시간 노선 막차가 우리 정류장을 지나는 시각이다. GBIS 노선정보(2026-11-17 조회)상 가장 늦은
    # 기점 막차가 5200 00:55, 3400 00:30 이고 정류장까지 이동 시간을 더해 02:00 으로 둔다(이후 04:00 까지는 폴링하지 않는다).
    BUS_ON_DEMAND_START: str = "21:00"
    BUS_ON_DEMAND_END: str = "02:00"
    SEOUL_SUBWAY_KEY: str = ""
    # ITS(국가교통정보센터)는 data.go.kr 과 키 체계가 다르다 — its.go.kr/opendata 에서
    # 따로 발급받은 키가 필요하다(2026-08-03 실측: data.go.kr 키로 호출 시 resultCode
    # 4005 '존재하지 않는 인증키'). 공유 키에 섞으면 기상청·GBIS·에어코리아가 함께
    # 죽으므로 반드시 별도 변수로 둔다. 비어 있으면 돌발 배너 기능만 조용히 꺼진다.
    ITS_API_KEY: str = ""

    # ── Web Push (VAPID) ─────────────────────────────────────
    # py_vapid CLI로 생성: `pip install py-vapid && vapid --gen`
    # (또는 pywebpush 설치 후 `python -m py_vapid --gen`)
    # 생성된 private_key.pem/public_key.pem을 base64url로 인코딩해 아래 두 값에 넣는다.
    # 절대 코드/커밋에 실제 값을 남기지 말 것 — Railway 환경변수로만 주입.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@example.com"

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
