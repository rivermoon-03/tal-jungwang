# 탭 개편 설계 — 셔틀+버스 통합 & 더보기 탭 신설

**날짜:** 2026-04-14  
**상태:** 승인됨

---

## 배경

현재 탭 4개(지도·셔틀·버스·지하철)에서 셔틀과 버스가 별도 탭으로 분리되어 있어 교통 수단 비교가 불편하다. 더보기 탭을 신설해 공지사항·링크·앱 정보를 한 곳에 모은다.

---

## 확정 구조

### 탭 구성 (변경 전 → 후)

| 변경 전 | 변경 후 |
|---|---|
| 🗺️ 지도 | 🗺️ 지도 (유지) |
| 🚌 셔틀 | 🚌 교통 ← 셔틀 + 버스 합침 |
| 🚍 버스 | 🚇 지하철 (유지) |
| 🚇 지하철 | ⋯ 더보기 (신설) |

탭 ID 변경: `shuttle` + `bus` → `transit` / 신설: `more`

---

## 화면별 설계

### 1. 교통 탭 (`transit`)

**레이아웃:** 세로 스크롤, 카드 2개 (셔틀 위 / 버스 아래)

#### 셔틀버스 카드

```
┌─────────────────────────────┐
│ 🚌 셔틀버스   시간표 전체보기 › │
├──────────────┬──────────────┤
│ 📍 정왕역    │ 🏫 학교       │
│ 08:00 [다음] │ 08:10 [다음] │
│ 다다음 08:40 │ 다다음 08:50 │
└──────────────┴──────────────┘
```

- 레이블: `📍 정왕역` (하교, 정왕역행) / `🏫 학교` (등교, 학교행)
- 각 셀: 다음 출발시각 + `[다음]` 배지 + 다다음 출발시각
- 운행 종료 후: "오늘 운행 종료" 표시
- `시간표 전체보기 ›` 클릭 → **바텀 시트** 오픈

#### 공공버스 카드

```
┌─────────────────────────────┐
│ 🚍 공공버스     정류장 변경 › │
│ [한국공학대] [이마트앞] [정왕역]│  ← 정류장 가로 스크롤 칩
├─────────────────────────────┤
│ 시흥33   3분       한국공학대 │
│ 20-1     11분      한국공학대 │
│ 시흥1    시간표    이마트앞   │
└─────────────────────────────┘
```

- 정류장 칩: 가로 스크롤, 선택된 정류장 강조
- `정류장 변경 ›` 클릭 → **바텀 시트** 오픈 (정류장 목록)
- 실시간/시간표 기반 도착 정보 (기존 로직 그대로)

---

### 2. 바텀 시트 (공통 컴포넌트)

**높이:** 화면의 65%  
**동작:**
- 위에서 아래로 슬라이드-인 애니메이션
- 딤(dim) 배경 탭 또는 ✕ 버튼으로 닫기
- 핸들(drag handle) 표시

#### 셔틀 시간표 시트

- 상단 서브탭: `📍 정왕역` / `🏫 학교`
- 전체 시간표 리스트 (지난 항목 흐리게, 다음 항목 자동 스크롤)
- 기존 `ShuttleTimetable` 컴포넌트 재사용

#### 버스 정류장 선택 시트

- 정류장 목록 (이름 + 운행 노선 서브텍스트)
- 선택된 정류장 강조 + `[선택됨]` 배지
- 선택 시 시트 닫히고 버스 카드 정류장 변경

---

### 3. 더보기 탭 (`more`)

섹션 순서: 공지사항 → 알림 → 유용한 링크 → 앱 정보 → 다크모드

#### 공지사항

- DB 저장, Redis 캐싱 (TTL 5분)
- 최신 순 3건 표시, 더 있으면 "더보기" 링크
- 읽지 않은 공지 있으면 `더보기` 탭 아이콘에 빨간 점(badge)
- Admin에서 CRUD

#### 셔틀 출발 알림

- 브라우저 Notification API
- 토글 스위치: ON 시 권한 요청 → 다음 셔틀 10분 전 알림
- 상태: localStorage 저장

#### 유용한 링크

- DB 저장, Redis 캐싱 (TTL 1시간)
- 아이콘 + 타이틀 + 외부 URL 구조
- Admin에서 CRUD (순서 변경 포함)

#### 앱 정보

- DB 저장, Redis 캐싱 (TTL 1시간)
- 앱 버전, 설명, 피드백 URL
- Admin에서 수정

#### 다크모드 토글

- 기존 `useAppStore.toggleDarkMode` 연결
- 모바일에서 처음 접근 가능해짐

---

## 백엔드 변경

### 신규 DB 모델

#### `Notice` (공지사항)

```python
class Notice(Base):
    id: int
    title: str
    content: str | None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
```

#### `AppLink` (유용한 링크)

```python
class AppLink(Base):
    id: int
    icon: str          # 이모지 또는 아이콘 코드
    label: str
    url: str
    sort_order: int = 0
    is_active: bool = True
```

#### `AppInfo` (앱 정보)

```python
class AppInfo(Base):
    id: int            # 단일 행 (id=1 고정)
    version: str
    description: str | None
    feedback_url: str | None
    updated_at: datetime
```

### 신규 API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/v1/more/notices` | 활성 공지사항 목록 |
| GET | `/api/v1/more/links` | 유용한 링크 목록 |
| GET | `/api/v1/more/info` | 앱 정보 |
| POST | `/api/v1/admin/notices` | 공지 생성 |
| PATCH | `/api/v1/admin/notices/{id}` | 공지 수정 |
| DELETE | `/api/v1/admin/notices/{id}` | 공지 삭제 |
| POST | `/api/v1/admin/links` | 링크 생성 |
| PATCH | `/api/v1/admin/links/{id}` | 링크 수정 |
| DELETE | `/api/v1/admin/links/{id}` | 링크 삭제 |
| PATCH | `/api/v1/admin/info` | 앱 정보 수정 |

### Redis 캐시 키

| 키 | TTL |
|---|---|
| `more:notices` | 5분 |
| `more:links` | 1시간 |
| `more:info` | 1시간 |

---

## 프론트엔드 변경

### 파일 변경 목록

**신규 생성:**
- `frontend/src/components/transit/TransitTab.jsx` — 교통 탭 (셔틀 카드 + 버스 카드)
- `frontend/src/components/transit/ShuttleCard.jsx` — 셔틀 2×2 그리드 카드
- `frontend/src/components/transit/BusCard.jsx` — 공공버스 카드
- `frontend/src/components/transit/BottomSheet.jsx` — 공통 바텀 시트
- `frontend/src/components/transit/ShuttleSheetContent.jsx` — 시트 내부: 셔틀 시간표
- `frontend/src/components/transit/BusStationSheetContent.jsx` — 시트 내부: 정류장 선택
- `frontend/src/components/more/MoreTab.jsx` — 더보기 탭
- `frontend/src/hooks/useMore.js` — 공지/링크/앱 정보 fetch 훅
- `frontend/src/hooks/useShuttleNotification.js` — 셔틀 알림 로직

**수정:**
- `frontend/src/App.jsx` — 탭 ID 변경, MoreTab 추가
- `frontend/src/components/layout/MobileTabBar.jsx` — 탭 목록 변경
- `frontend/src/components/layout/PCNavbar.jsx` — 탭 목록 변경
- `frontend/src/components/layout/PCSidebar.jsx` — 탭 목록 변경
- `frontend/src/stores/useAppStore.js` — `VALID_TABS` 업데이트

**기존 재사용:**
- `ShuttleTimetable.jsx` → `ShuttleSheetContent` 내부에서 재사용
- `ArrivalList.jsx` → `BusCard` 내부에서 재사용
- `StationList.jsx` → `BusStationSheetContent` 내부에서 재사용

---

## 범위 외 (이번 작업 제외)

- 탑승 가능 여부 판단 (🟢🟡🔴) 로직
- 실시간 버스 위치 지도 표시
- 교통 추천 알고리즘 고도화
