# 캐시 수명 표 (Redis TTL / HTTP Cache-Control / cron 간격)

`app/core/cache.py`, `app/core/scheduler.py`, `app/api/*.py`의 실제 상수를 코드에서
실측해 정리한다. 원칙(mistakes.md §4)은 "TTL ≤ cron 간격 → cron 1회 누락도
cache-aside로 자가회복"이다. 이 저장소는 두 가지 다른 회복 경로를 쓰므로, 표를
읽기 전에 구분해 둔다.

## 판정 기준

- **cache-aside(요청 시 직접 폴백)**: 캐시가 비어 있으면 그 요청 자체가 DB 또는
  외부 API를 직접 호출해 채운다(`weather.py`, `cafeteria.py`, `shuttle.py`,
  `subway.py`, `school.py`의 서비스 함수). 이 경우 TTL은 "얼마나 오래 stale을
  보여줄 수 있는가"의 상한일 뿐이고, cron이 몇 회 누락돼도 다음 요청에서 즉시
  회복된다. `TTL == cron 간격`까지는 원칙 위반이 아니다.
- **cron 전용 기록(cron-write-only)**: 캐시를 쓰는 주체가 스케줄러 잡뿐이고,
  요청 경로는 캐시를 읽기만 한다(`bus_collector.py`의 `bus:arrivals:*`,
  `subway_realtime.py`의 `subway:realtime:*`). 이 경우 캐시가 비면 그 요청은
  실시간값 없이 정적 시간표로 저하되거나(`bus`) `stale` 플래그로 표시된다
  (`subway`). 여기서는 TTL이 cron 주기의 정수배(주로 1.2~2.2배)로 "1회 미싱
  버퍼"를 의도적으로 둔다 — 코드 주석에 명시돼 있으면 설계된 것으로 본다.
- **위반**: cron 전용 기록인데 버퍼 근거 주석이 없거나, cache-aside인데
  docstring이 주장하는 정책과 실제 상수가 어긋나는 경우.

## 표 1. cron 전용 기록 (요청 경로에 외부 폴백 없음)

| 도메인 | Redis 키 | TTL | cron 간격 | 비율 | 판정 |
|---|---|---|---|---|---|
| bus(실시간 도착) | `bus:arrivals:{station_id}` | 100s (`bus_collector.CACHE_TTL`) | 45s (`bus_arrival_poll`, 02~03시 제외) | 2.2배 | OK — "1회 미싱 버퍼" 명시 주석 |
| subway(실시간 도착, 피크/비피크) | `subway:realtime:{역}` | 30s (`_CACHE_TTL`) | 15s(피크)/20s(비피크) | 2.0배/1.5배 | OK — HTTP 계층(`max-age=10`)이 더 짧아 실사용 staleness는 이보다 작음 |
| subway(실시간 도착, 심야) | `subway:realtime:{역}` | 720s (`_LATE_NIGHT_CACHE_TTL`) | 600s(00:00~03:49 10분 주기) | 1.2배 | OK — 명시 주석("폴링 간격보다 길게") |
| subway(직전 성공값, graceful degradation) | `subway:realtime:last_success:{역}` | 300s (`_LAST_SUCCESS_TTL`) | — (stale 플래그용, cron 아님) | — | 해당 없음 — 신선도가 아니라 저하 허용 폭 |

## 표 2. cache-aside (요청이 직접 DB/외부 API 폴백)

| 도메인 | Redis 키 | TTL | 배후 cron | 비율 | 판정 |
|---|---|---|---|---|---|
| weather(실황) | `weather:live` | 3600s | 60분(05~23시 매시, `weather_live_refresh`) | 1.0배 | OK |
| weather(예보) | `weather:forecast` | 10800s | 3시간(02·05·08·11·14·17·20·23시, `weather_forecast_refresh`) | 1.0배 | OK |
| cafeteria(메뉴) | `cafeteria:menu` | 3600s | 60분(07~21시 매시, `cafeteria_refresh`) | 1.0배 | OK — mistakes.md §4에 6h→1h로 정정된 이력 있음 |
| bus(시간표) | `bus:timetable:{route}:{day}:{stop}` | 86400s | 없음(DB 직접, 일 1회 03:40 재적재는 워밍용) | — | OK — 원본 데이터가 정적 |
| bus(정류장 메타) | `bus:station_meta:{id}` | 300s | 없음(admin CRUD가 즉시 invalidate) | — | OK — TTL은 무효화 누락 시 상한일 뿐 |
| bus(통계) | `bus_stats:*` | 21600s(6h, `STATS_CACHE_TTL`) | 24시간(1일 1회 03:30, `bus_arrival_stats_refresh`) | 0.25배 | OK — 가장 보수적인 사례 |
| bus(통계 네거티브) | `bus_stats:*` | 600s(`STATS_NEGATIVE_TTL`) | — | — | OK — "데이터 아직 없음" 전용 |
| subway(시간표) | `subway:timetable:*` | 43200s(12h) | 없음(DB 직접, 시즌 변경 시 수동 refresh) | — | OK — 원본이 정적 시드 |
| shuttle(운행기간) | `shuttle:period:{date}` | 3600s | 없음(DB 직접) | — | OK |
| shuttle(운행기간 네거티브) | `shuttle:period:{date}` | 300s(`_PERIOD_MISS_TTL`) | — | — | OK — 새 기간 추가가 5분 내 반영 |
| shuttle(시간표 엔트리) | `shuttle:entries:{period}:{day}` | 3600s | 없음(DB 직접) | — | OK |
| map(마커) | `map:markers` | 86400s | 없음(DB 직접, 일 1회 재적재는 워밍용) | — | OK |
| school(학과 공지) | `school:notices:{dept}` | 7200s(120분, `_TTL_NOTICES`) | 60분(`department_notices_refresh`) | 2.0배 | **주의** — 모듈 docstring(`school.py:7`)은 "크론 주기보다 짧게"라 적었지만 실제 상수는 크론의 2배. 코드 주석은 "크론 2주기 이내로 제한"이라 의도된 버퍼이나, docstring 문구와 상수가 불일치 |
| school(학사일정) | `school:calendar` | 90000s(25h, `_TTL_CALENDAR`) | 24시간(1일 1회 03:50) | 1.04배 | OK — "살짝 길게"로 의도된 소폭 버퍼 |

## 표 3. HTTP Cache-Control (CDN/브라우저, 배후 레이어와 함께)

| 엔드포인트 | max-age | stale-while-revalidate | 배후 Redis/cron |
|---|---|---|---|
| `GET /api/v1/bus/routes` | 600s | 3600s | DB 직접(정적) |
| `GET /api/v1/bus/stations` | 600s | 3600s | DB 직접(정적) |
| `GET /api/v1/bus/arrivals/{id}` | 10s | 30s | 표1 bus 실시간(TTL 100s) — HTTP가 더 짧아 안전 |
| `GET /api/v1/bus/timetable-by-route/{route}` | 3600s | 86400s | 표2 bus 시간표(TTL 86400s) |
| `GET /api/v1/bus/timetable/{route_id}` | 3600s | 86400s | 표2 bus 시간표(TTL 86400s) |
| `GET /api/v1/bus/history-preview/{route}` | 120s | 600s | DB 직접 |
| `GET /api/v1/bus/arrival-stats/{route}/{stop}` | 300s | 600s | 표2 bus 통계(TTL 6h) |
| `GET /api/v1/bus/crowding/{route}` | 300s | 600s | DB 직접(혼잡도 사전집계) |
| `GET /api/v1/bus/locations/{route_id}` | 10s | 30s | 표1 bus 실시간 |
| `GET /api/v1/subway/timetable` | 1800s | 43200s | 표2 subway 시간표(TTL 12h) |
| `GET /api/v1/subway/next` | 15s | 60s | DB 직접(시간표 계산) |
| `GET /api/v1/subway/realtime` | 10s | 30s | 표1 subway 실시간 — HTTP가 더 짧아 안전 |
| `GET /api/v1/shuttle/schedule` | 600s | 3600s | 표2 shuttle(TTL 1h) |
| `GET /api/v1/shuttle/semester-schedule` | 3600s | 7200s | DB 직접(고정 조회, 무폴링) |
| `GET /api/v1/shuttle/next` | 15s | 60s | 표2 shuttle |
| `GET /api/v1/weather/current` | 60s | 300s | 표2 weather 실황(TTL 3600s) |
| `GET /api/v1/weather/forecast` | 300s | 900s | 표2 weather 예보(TTL 10800s) |
| `GET /api/v1/cafeteria/menu` | 300s(`refresh=true`는 헤더 생략) | 900s | 표2 cafeteria(TTL 3600s) |
| `GET /api/v1/school/departments` | 3600s | 86400s | 코드 상수(정적 레지스트리) |
| `GET /api/v1/school/notices` | 300s | 1800s | 표2 school 공지(TTL 7200s) |
| `GET /api/v1/school/calendar` | 1800s | 7200s | 표2 school 일정(TTL 25h) |
| `GET /api/v1/more/notices` | 120s | 600s | DB 직접 |
| `GET /api/v1/more/links` | 600s | 3600s | DB 직접(정적) |
| `GET /api/v1/more/info` | 600s | 3600s | DB 직접(정적) |
| `GET /api/v1/route/taxi-to-station` | 300s | 1200s | 외부 API(카카오/TMAP) 캐시 |
| `POST /api/v1/route/walking` | 3600s | 86400s | 외부 API 캐시 |
| `GET /api/v1/route/taxi-destinations` | 300s | 1200s | 외부 API 캐시 |
| `POST /api/v1/route/driving` | 60s | 300s | 외부 API 캐시 |
| `GET /api/v1/map/markers` | 3600s | 86400s | 표2 map 마커(TTL 24h) |
| `GET /api/v1/dashboard` | 10s | 30s | 여러 도메인 합성(가장 짧은 실시간 기준) |
| `GET /api/v1/recommend/transport` | 10s | 30s | 실시간 도착 기반 |
| `GET /api/v1/traffic` | 동적(러시 60s / 평시 300s, `_traffic_ttl`) | — | DB 직접(`traffic_history`), 경계 clamp로 stale 방지 |

## 발견한 위반/주의 사항 요약

1. **`school.py` docstring vs `_TTL_NOTICES` 불일치** — 모듈 최상단 docstring은
   "캐시 TTL은 갱신 크론 주기보다 짧게 잡아... 자가회복된다"고 적었지만, 실제
   `_TTL_NOTICES = 120 * 60`은 크론 간격(60분)의 2배다. 기능적으로는
   `get_or_fetch_with_lock` + DB 폴백이라 요청마다 최신 DB 값을 즉시 반영하므로
   원칙이 요구하는 "1회 누락 자가회복"은 여전히 성립하지만(캐시가 비어 있든
   있든 다음 요청이 DB를 다시 읽음), docstring 문구 자체는 상수와 어긋난다.
   문구를 "크론 주기의 최대 2배 이내로 제한(1회 미싱 버퍼)"로 정정하는 것을
   권장한다.
2. **엄밀한 `TTL ≤ cron` 위반은 발견되지 않았다.** cron 전용 기록 도메인(표1)은
   모두 "1회 미싱 버퍼" 근거 주석이 코드에 이미 있고, cache-aside 도메인(표2)은
   전부 `TTL ≤ 1.2×cron` 이내이거나 애초에 cron에 의존하지 않는 정적 데이터다.
3. `bus:arrivals:*`/`subway:realtime:*`처럼 cron 전용 기록인 도메인은 HTTP
   `max-age`가 Redis TTL보다 훨씬 짧게(10s) 잡혀 있어, CDN/브라우저 계층에서
   추가로 stale을 감출 위험은 없다.
