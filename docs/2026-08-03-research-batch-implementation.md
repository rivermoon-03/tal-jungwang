# 2026-08-03 리서치 일괄 적용 (정확도 A1~A6 · 신규 B1·B3·B4·B6)

3차 리서치(정확도·데이터소스, 아티팩트 `a21e22c0`)와 Before/After 시안(아티팩트 `bd73274d`)의 채택 항목을 일괄 구현한 기록. 커밋 2개로 나눴다 — ① 정확도(A계열) ② 신규 기능+문서(B계열).

## 범위 결정

| 항목 | 상태 | 비고 |
|---|---|---|
| A1 광역버스 잔여좌석 칩 | 적용 | GBIS `remainSeatCnt` — 어댑터는 파싱했으나 수집기가 버리던 값. 직행좌석만 실값(8/3 실측: 3400 잔여 41석) |
| A2 이동지수 초단기예보+낙뢰 | 적용 | 같은 키·같은 서비스의 `getUltraSrtFcst`. 실패 시 단기예보 폴백 |
| A3 "N정거장 전" 칩 | 적용(부분) | 이미 받는 `locationNo` 활용. **지도 GPS 도트는 보류** — TAGO 버스위치 활용신청(자동승인) 후 `getCtyCodeList`로 경기 커버 확정 필요 |
| A4 ETA 자가 채점 | 적용 | 예측 vs 실측 도착 오차 적재 + 28일 집계. 표본 쌓이기 전엔 UI 미노출 |
| A5 지하철 도착 이력 | 적용(수집 시작) | 요일별 실측 다이아 재구성은 4~6주 적재 후 별도 데이터 작업 |
| A6 지하철 자체 지연 감지 | 적용 · **베타** | 실측 도착 vs 시간표 편차 중앙값 ≥5분 → 지연 배지 |
| B1 웹푸시 막차 알림 | 적용 | 기존 push_subscriptions/VAPID 인프라 재사용, 1단계 정왕역 지하철 막차 |
| B2 킥보드(TAGO PM) | **제외** | 사용자 결정 |
| B3 ITS 돌발상황 배너 | 적용 · **베타** | cache-aside(요청 트리거, 스케줄러 잡 없음). 키 미승인 시 조용한 저하(에어코리아 패턴) |
| B4 정왕역 혼잡 프로파일 | 적용(파이프라인) | 데이터 없으면 UI 자체가 숨음. 실데이터는 stcis.go.kr 교통카드 통계 수동 적재 필요(아래 후속) |
| B5 학식 폴백 소스 | **불가 판정** | mob.tukorea.ac.kr는 로그인 게이트 SPA(8/3 실측: 익명 접근 시 라우트 전부 404, 링크가 `TUKWeb.href('/login')`), robots.txt 없음. 식단 메뉴는 ibook 동일 원본으로 추정 — 독립 폴백 소스가 존재하지 않는다. 재조사 불필요 |
| B6 심야 택시 승격 | 적용 | 전 노선 `off_service` 시 홈 상단 택시 카드. 기존 택시 탭 데이터 재사용 |

베타 딱지 정책: 실시간 계열 신규 요소(잔여좌석·정거장 칩, 지연 배지, 돌발 배너)에 기존 `StatusChip kind="beta"` 문법으로 표기. 지하철 실시간 카드는 기존 베타 칩 유지.

## 구현 기록

### 커밋 1 — 정확도 (`feat(accuracy)`)

- **A1** — `gbis.py`의 `remain_seat1` 파싱을 0석 보존형으로 교체(기존 `int(x or -1)`은 0석=만차를 -1로 뭉갬) + `remain_seat2` 추가. 수집 캐시 슬롯 → `schemas/bus.py` `BusArrival.remain_seat`(기본 -1) → 프런트. express 카테고리 + `remain_seat ≥ 0`일 때만 좌석 칩(11석↑ green / 1~10 imminent / 0 "만차" delayed), 아니면 기존 혼잡도 칩. 칩 순서: 실시간 → 좌석/혼잡 → 정거장 → **베타** → 제보 → 경유
- **A3** — `location_no`를 응답에 통과시켜 "N정거장 전" 칩. 지도 GPS 도트는 TAGO 신청 후 2단계
- **A4** — 폴링마다 plate별 예측을 `bus:eta_pred:*`(TTL 900s) 버퍼에 적재, detected 도착 시 `error_sec = 도착 − (관측 + 예측)` 샘플을 `bus_eta_samples`에 기록. 03:47 KST 잡이 28일 윈도우로 `bus_eta_accuracy`(표본 50↑만) 집계 + 오래된 샘플 정리. `history-preview`의 `realtime_eta.eta_accuracy`로 노출 — 상세 시트에 "최근 4주 실측: 예측 ±1분 내 N%"(ease) 또는 "예측 편차가 큰 노선이에요"(imminent). "GBIS 도착 정보 수신 중" 문구는 "실시간 수신 중"으로 교체. **주의: 채점 기준은 raw GBIS 예측** — 화면 표시값(보수 마진 차감)이 아님
- **A2** — `kma.py` `fetch_ultra_srt_fcst()`(매시 30분 발표·45분 제공, 분<45면 전 시각 폴백, 자정 경계 처리). `weather.py`가 +1~+2h 창의 PTY/LGT로 강수 판정(초단기 실패 시 기존 단기예보 임계값 폴백), LGT 감지 시 `indoor` 승급 + reason "낙뢰 예보". factors에 낙뢰 행(미감지 시 생략)·`source_label`("14:30 발표 초단기예보 기준"). 캐시 `weather:ultra_fcst` 1h, 실패 미캐싱. 한계: 초단기에는 POP가 없어 강수확률 행 값은 단기예보 유지 — "곧 비 + 강수확률 20%" 공존 가능(출처 줄이 설명)
- **A5** — `subway_arrival_history` 적재 시작. 도착 판정 = `arvlCd=1` 또는 직전 스냅샷(`subway:prev:*`, 120s 이내)에 임박 상태로 있다가 소실. 스케줄러 폴링 경로에서만 기록해 `DISABLE_SCHEDULER=1` 인스턴스 중복 차단(테스트로 강제). 심야(10분 주기)는 `arvlCd=1` 경로만
- **A6** — 도착 확정 시 시간표 ±20분 최근접 편차를 `subway:deviation:*`(최근 5건)에 push, 3건↑ 중앙값 ≥ +5분이면 `subway:delay:*`(TTL 12분) → 응답에 `delay_minutes/since/samples` 첨부. 프런트 `SubwayDelayBadge`(delayed 토큰) + 근거 팝오버("베타 · 자체 감지" 캡션). 한계: 서해선은 시드 시간표 자체가 부정확할 수 있어 편차가 시드 오류를 감지할 수 있음 — A5 이력으로 정본화 후 신뢰 가능. 시간표는 출발시각·실측은 도착이라 +수십 초 양의 바이어스(+5분 임계엔 무해)
- 검증: backend 395 passed · frontend 1448 passed · lint/build 클린

### 커밋 2 — 신규 기능 (`feat(features)`)

- **B1** — `push_subscriptions.preferences` JSONB(`{"last_train": {enabled, lead_min: 15|30|60}}`, upsert 시 기존값 보존 병합). 매분 잡 `last_train_push`(02~04시 제외): 서비스일(04시 이전=전날) 기준 정왕역 수인분당 상·하행 막차 − lead_min 매칭, 자정 넘는 막차("00:32")의 KST 보정, `push:last_train:sent:*` 26h 중복 방지(서비스일당 1건, 이미 떠난 방향은 본문에서 제외). 설정에 "막차 알림" 토글 + [1시간|30분|15분] 칩, NotificationsPage "개발 중" 카드 은퇴(사용 가능/준비 중 구분). 한계: 수인분당만 — 4호선 막차가 더 늦으면 실제 최종 열차와 다를 수 있음(후속)
- **B3** — `external/its.py`(ITS 돌발상황, 통학축 bbox lon 126.68~126.88 lat 37.32~37.47, 사고·공사만) + `traffic_incidents.py` cache-aside(`traffic:incidents` 1200s/음성 600s, single-flight) + `GET /api/v1/traffic/incidents`(max-age 300s). BusPanel 상단 amber 배너(베타 칩) + express 카드 "경로 사고/공사" warn 칩. 프런트 폴링 `useApi` 5분
  - **⚠ 키 체계 정정(2026-08-03 실측)** — 최초 구현은 `DATA_GO_KR_SERVICE_KEY`를 그대로 보냈으나, ITS는 data.go.kr과 **별개 키 체계**다. 실제 호출 시 `{"header":{"resultCode":4005,"resultMsg":"존재하지 않는 인증키입니다."}}` 확인 → 전용 설정 `ITS_API_KEY` 신설. 공유 키(기상청·GBIS·에어코리아)에 ITS 키를 덮어쓰면 그쪽이 전부 죽으므로 절대 섞지 말 것
  - 오류 응답은 HTTP 200 + JSON이라 `header.resultCode`를 보지 않으면 body 파싱이 빈 목록이 되어 **"돌발 없음"과 구분되지 않는다**(기능이 조용히 죽음). `result_code_ok()`로 판별해 None 저하 처리. 키 미설정 시엔 네트워크 호출 자체를 하지 않음
  - 키가 비어 있어도 나머지 기능은 정상 — 키를 채우는 순간부터 자동 동작(airkorea 패턴)
- **B4** — `subway_crowding_profile` 테이블 + `GET /api/v1/subway/crowding-profile`(6h 캐시, 빈 테이블→`[]`) + 상세 시트 요일 탭 아래 단일색 막대 차트(현재 시간대만 진한 accent, "N시대 붐빔 · M시 이후 여유 · 교통카드 통계 기준"). **가짜 시드 없음 — `scripts.load_subway_crowding_profile`로 stcis CSV를 적재하기 전에는 섹션 자체가 렌더되지 않는다**
- **B6** — 전 노선 운행 종료 + 첫차 60분 밖일 때만 홈 최상단 택시 승격 카드("지금은 택시가 빨라요", `jeongwang_station` 프리셋 요금·시간 재사용, 실패 시 숫자 줄 생략, 카카오T launch 링크 + 택시 탭 전환). 자정 직전 내일 첫차 경계 처리
- em-dash 구분자는 전역 `tokenRules.test.js` 금지 규칙 때문에 전부 `·` 사용
- 검증: backend 460 passed · frontend 1489 passed · lint/build 클린

## 후속 작업 (사람 손 필요)

1. **TAGO 버스위치**: data.go.kr에서 `버스위치정보`(15098533) 활용신청(자동승인) → `getCtyCodeList`로 경기도 포함 확인 → 포함 시 지도 버스 도트(A3 2단계) 착수. 현 `DATA_GO_KR_SERVICE_KEY`는 미등록 상태(`SERVICE_KEY_IS_NOT_REGISTERED` 실측)
2. **ITS 돌발상황**: **data.go.kr이 아니라 its.go.kr** — https://www.its.go.kr/opendata 회원가입 → 오픈API 신청 → 발급 키를 `ITS_API_KEY` 환경변수(Railway + 로컬 `backend/.env`)에 넣는다. `DATA_GO_KR_SERVICE_KEY`에 넣으면 안 된다(기상청·GBIS·에어코리아 공용). 키 없이도 배포는 안전 — 배너만 비활성
3. **B4 데이터**: stcis.go.kr(교통카드 빅데이터)에서 정왕역 시간대별 승하차 통계 내려받아 `subway_crowding_profile` 적재(스크립트 주석 참고). 적재 전까지 UI 숨김
4. **A5 다이아 정본화**: `subway_arrival_history` 4~6주 적재 후 요일×시간대 집계로 토요일 시간표 생성·서해선 3개 day_type 교체
5. **프로덕션 마이그레이션**: `prod_migration_20260803_accuracy_tables.sql`(신규 테이블 3개, 순수 additive) + `prod_migration_20260803_feature_tables.sql` 수동 적용. **⚠ feature 쪽 `push_subscriptions.preferences` 컬럼은 모델이 SELECT 하므로 백엔드 배포 전에 먼저 적용해야 push 경로가 안 깨진다.** 로컬 docker 볼륨도 동일
