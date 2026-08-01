# Bus Boarding Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 버스를 타는 정류장 source의 제목을 정보 종류와 관계없이 `○○ 승차`로 통일한다.

**Architecture:** `source_role`을 문구 의미의 기준으로 사용한다. 백엔드가 `departure`와 `boarding_arrival`을 API 응답에서 `승차`로 정규화하고, 보정 SQL과 초기 seed도 같은 라벨을 저장해 DB와 API를 일치시킨다.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, Pytest, React, Vitest

## Global Constraints

- `departure`, `boarding_arrival`만 `승차`로 바꾼다.
- `downstream_arrival`의 `도착`은 유지한다.
- `서울 출발` 탭과 `곧 도착`, `도착 정보 없음` 상태 문구는 변경하지 않는다.
- 지하철·셔틀 문구는 변경하지 않는다.

---

### Task 1: 역할 기반 API 문구 정규화

**Files:**
- Modify: `backend/tests/test_bus_context_service.py`
- Modify: `backend/app/services/bus_context.py`

**Interfaces:**
- Consumes: `BusInformationSource.source_role`, `display_label`
- Produces: `normalize_bus_source_display_label(role: str, label: str) -> str`

- [x] **Step 1: Write the failing service test**

기존 `시흥터미널 출발`, `이마트 도착` fixture를 유지하고 API 결과가 각각
`시흥터미널 승차`, `이마트 승차`인지 검증한다. `downstream_arrival` fixture를 추가해
`시흥시청 도착`이 유지되는지도 검증한다.

- [x] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_bus_context_service.py -q`
Expected: FAIL because the service returns the stored `출발` and `도착` labels unchanged.

- [x] **Step 3: Implement minimal normalization**

`departure`와 `boarding_arrival` 역할에만 끝말 ` 출발` 또는 ` 도착`을 ` 승차`로
교체하고, 다른 역할은 원문을 반환한다. context 응답의 `display_label`에 적용한다.

- [x] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_bus_context_service.py -q`
Expected: PASS.

### Task 2: DB seed와 프로덕션 보정 SQL

**Files:**
- Modify: `scripts/prod_migration_20260801_bus_information_sources.sql`
- Modify: `scripts/prod_migration_20260801_bus_source_policy_corrections.sql`
- Create: `scripts/prod_migration_20260801_bus_boarding_labels.sql`
- Modify: `backend/tests/test_bus_source_policy_migration.py`

**Interfaces:**
- Consumes: `bus_information_sources.source_role`, `display_label`
- Produces: boarding source rows ending in ` 승차`

- [x] **Step 1: Add failing migration policy assertions**

보정 SQL이 두 boarding 역할을 대상으로 하고 `downstream_arrival`을 변경하지 않는다는
계약을 테스트로 고정한다.

- [x] **Step 2: Run migration test to verify it fails**

Run: `pytest tests/test_bus_source_policy_migration.py -q`
Expected: FAIL because the boarding-label migration does not exist.

- [x] **Step 3: Update seeds and create idempotent correction SQL**

초기·정책 seed의 boarding label을 `승차`로 바꾸고, 프로덕션용 SQL은 역할 조건과
끝말 정규식으로 기존 행을 갱신한다.

- [x] **Step 4: Run migration tests**

Run: `pytest tests/test_bus_source_policy_migration.py -q`
Expected: PASS.

### Task 3: 화면 회귀와 문서

**Files:**
- Modify: `frontend/src/components/schedule/SchedulePage.test.jsx`
- Modify: `frontend/src/components/schedule/ScheduleDetailModal.test.jsx`
- Modify: `backend/tests/test_bus_context_api.py`
- Modify: `backend/tests/test_bus_information_source_models.py`
- Modify: `docs/2026-08-01-commute-bus-schedule-fixes.md`

**Interfaces:**
- Consumes: context API `display_label`
- Produces: 목록·상세의 `○○ 승차` 제목

- [x] **Step 1: Update fixtures and assertions to the approved public contract**

3400의 `시흥터미널 승차`·`이마트 승차`, 20-1의 동일 정류장 승차 문구, 99-2 상세
승차 제목을 검증하고 시흥시청 downstream source는 `도착`으로 유지한다.

- [x] **Step 2: Run targeted frontend and backend tests**

Run: `npm test -- --run src/components/schedule/SchedulePage.test.jsx src/components/schedule/ScheduleDetailModal.test.jsx`
Run: `pytest tests/test_bus_context_api.py tests/test_bus_information_source_models.py -q`
Expected: PASS.

- [x] **Step 3: Record the final copy rule in docs**

승차점은 `승차`, 중간 관측점은 `도착`이라는 규칙과 적용 대상을 운영 문서에 기록한다.

### Task 4: Full verification and push

**Files:** All changed files.

- [x] **Step 1: Run full frontend verification**

Run: `npm test && npm run lint && npm run build`
Expected: all exit 0.

- [x] **Step 2: Run backend CI-equivalent suite**

Run: `pytest -q`
Expected: all tests pass in CI; locally run all relevant tests if PostgreSQL/Redis are unavailable.

- [x] **Step 3: Inspect diff and commit**

Run: `git diff --check`, then commit implementation and documentation.

- [ ] **Step 4: Push branch**

Run: `git push -u origin fix/bus-boarding-copy`.
