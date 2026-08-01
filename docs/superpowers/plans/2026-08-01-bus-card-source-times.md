# Bus Card Source Times Implementation Plan

**Goal:** 버스 목록 카드가 source 유형과 실제 기준 정류장에 맞는 도착·출발 시간을 표시하고, 실시간 전용 노선에는 시간표를 노출하지 않는다.

**Architecture:** DB의 `bus_commute_contexts`와 `bus_information_sources`를 제품 표시의 단일 출처로 유지한다. 프론트는 source 배열에서 대표 source를 결정하되 각 source의 값을 합치지 않으며, 상세 화면은 전달받은 source만 독립 섹션으로 렌더링한다.

**Tech Stack:** FastAPI, SQLAlchemy/PostgreSQL, React, Vitest, Testing Library

---

### Task 1: source 분류 회귀 테스트

**Files:**
- Modify: `frontend/src/components/schedule/SchedulePage.test.jsx`
- Create: `frontend/src/utils/busInformationSource.test.js`

1. 실시간 전용, 시간표 전용, 같은 정류장 혼합, 다른 정류장 혼합, 복수 실시간 source의 대표 선택 테스트를 작성한다.
2. 카드 시간열에 `정보 보기`가 남지 않고 실제 `N분`/`HH:MM`이 표시되는 실패를 확인한다.

### Task 2: 카드 대표 source와 시간 표시

**Files:**
- Create: `frontend/src/utils/busInformationSource.js`
- Modify: `frontend/src/components/schedule/SchedulePage.jsx`

1. 정류장과 source 유형을 고려해 대표 source를 고르는 순수 함수를 구현한다.
2. 각 source 행이 계산한 현재 상태를 카드에 전달한다.
3. `ScheduleSection`에 대표값의 `minutesUntil`, `hhmm`, `imminent`, 상태 문구와 정보 유형 칩을 전달한다.

### Task 3: 월곶역 방면 API·탭

**Files:**
- Modify: `backend/app/api/bus.py`
- Modify: `backend/tests/test_bus_context_api.py`
- Modify: `frontend/src/utils/busCommuteContext.js`
- Modify: `frontend/src/utils/busCommuteContext.test.js`

1. `to-wolgot` 쿼리 허용과 하교 `월곶역 방면` 탭 실패 테스트를 작성한다.
2. API Literal과 프론트 그룹 정의를 확장한다.

### Task 4: 프로덕션 source 정책 보정

**Files:**
- Create: `scripts/prod_migration_20260801_bus_source_policy_corrections.sql`
- Modify: `scripts/prod_migration_20260801_bus_information_sources.sql`
- Create: `backend/tests/test_bus_source_policy_migration.py`

1. 시흥1·시흥33 하교의 timetable source를 제거한다. 원본 timetable 행은 삭제하지 않는다.
2. 시흥33 시흥시청 방면의 실시간 기준을 학교 승차점으로 정정한다.
3. 99-2 월곶역 방면 context와 시흥터미널·이마트 realtime source/target을 추가한다.
4. 보정 SQL의 필수 정책을 정적 회귀 테스트로 고정한다.

### Task 5: 통합 검증과 배포

**Files:**
- Modify: `docs/2026-08-01-commute-bus-schedule-fixes.md`

1. 프론트와 백엔드 관련 테스트 및 전체 테스트를 실행한다.
2. 프로덕션 DB에 보정 SQL을 트랜잭션으로 적용한다.
3. 실제 context API와 브라우저에서 대표 시간, 탭, 상세 source 분리를 검증한다.
4. 문서에 적용 행 수와 실제 해결 여부를 기록하고 커밋·push·PR merge한다.
