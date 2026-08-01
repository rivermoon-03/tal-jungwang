# 버스 정보 기준점 분리 구현 계획 및 진행 상태

작성일: 2026-08-01

## 목표

시간표 출발점과 GBIS 실시간 관측점을 분리하고, 홈과 시간표가 같은 상세 UI와 같은 데이터 계약을 사용하게 한다.

## 단계별 상태

| 단계 | 백엔드·DB | 프론트 | 상태 |
|---|---|---|---|
| 1 | 통학 맥락, 정보 source, 실시간 target 모델과 SQL | 없음 | 완료 |
| 2 | 명시적 realtime target 기반 collector와 `travel_direction` | 없음 | 완료 |
| 3 | `/bus/commute-contexts` API | API hook | 완료 |
| 4 | source별 독립 조회 계약 | 목록의 source 요약 행 | 완료 |
| 5 | 동일 context 본문 제공 | 홈·시간표 공용 `ScheduleDetailModal` | 완료 |
| 6 | 없음 | 90~140ms 모션, reduced-motion, 학사일정 자간 | 완료 |
| 7 | 마이그레이션 dry-run 및 전체 테스트 | build/lint/브라우저 검증 | 진행 예정 |
| 8 | 프로덕션 DB 적용 및 배포 | 프로덕션 반영 | 미수행 |

## 변경 파일 묶음

- DB: `scripts/schema.sql`, `scripts/prod_migration_20260801_bus_information_sources.sql`
- 모델·수집: `backend/app/models/bus.py`, `backend/app/services/bus_collector.py`
- API: `backend/app/services/bus_context.py`, `backend/app/api/bus.py`, `backend/app/schemas/bus.py`
- 목록·상세: `frontend/src/components/schedule/SchedulePage.jsx`, `ScheduleDetailModal.jsx`, `GlobalDetailModal.jsx`
- 홈: `frontend/src/components/summary/BusPanel.jsx`
- 모션: `frontend/src/index.css`, `frontend/tailwind.config.js`

## 완료 조건

- 3400: 시흥터미널 시간표와 이마트 실시간이 서로 다른 정보 행이다.
- 3401: 이마트 시간표와 서울 방향 시흥시청 실시간이 서로 다른 정보 행이다.
- 6502 하교: 이마트 시간표만 있고 실시간 source가 없다.
- 5200: 시흥터미널과 이마트 실시간을 구분한다.
- 홈과 시간표에서 동일 노선을 열면 동일한 상세 본문을 사용한다.
- 탭과 콘텐츠 전환이 빠르고 reduced-motion에서 제거된다.
- 프로덕션 적용 전 SQL을 별도 DB에서 검증하고, 적용 후 실제 브라우저로 재현 시나리오를 다시 확인한다.

## 운영 주의사항

- `key.txt`의 프로덕션 접속 문자열은 읽기 전용 감사에만 사용했다.
- 사용자 승인 없이 프로덕션 마이그레이션을 실행하지 않는다.
- 노선 개편 시 `bus_information_sources`와 `bus_realtime_targets`를 함께 갱신한다.
- 정류장 이름이 같아도 GBIS station ID와 진행 방향이 다르면 별도 target으로 유지한다.
