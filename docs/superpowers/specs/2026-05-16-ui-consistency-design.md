# UI 일관성 정리 — Tesla/iDrive 톤 전면 적용

**날짜:** 2026-05-16
**관련 시안:** `.superpowers/brainstorm/165463-1778909464/content/` 의 `group-1-subway.html` ~ `group-5-transit-v2.html` 및 `diagnosis.html`

---

## 1. 배경

`tailwind.config.js`(2026-05 redesign, 커밋 `c5dabca`)에 **BMW iDrive / Tesla OS 톤** 디자인 토큰이 완비돼 있다.

- 컬러: `bg`, `surface`, `surface-alt`, `line`, `text`, `ink`, `mute`, `accent`(`#4f9fff`), `state-ok/warn/bad`, `imminent`(`#e26a4d`), `chip-{green|blue|red|purple|yellow}-{bg|fg}` + 다크 페어
- 타이포: `countdown`(32px/900), `eta-pc`(22px/900), `eta-mob`(26px/900), `page-ttl`(26px/900), `panel-ttl`(16px/900), `dest`(12px/600), `ghdr`(9px/700), `sub`(10px/700), `meta`(11px/600), `chip`(11px/800)
- 라운드: `card`(14px), `card-pc`(12px), `card-lg`(18px), `pill`(999px), `chip`(5px), `mini`(10px), `dock-mob`(22px)
- 그림자: `card`, `card-md`, `pill`, `dock`, `map`
- DEPRECATED: `hero`, `bigMin`, `display`, `title`, `body`, `caption`, `micro`, `navy`, `coral`, `border-dark`, `text-secondary-dark`

메인 대시보드·`BusArrivalCard`·`PCStationPicker`·`FloatingDock`·`CafeteriaPage` 등은 이미 새 토큰을 사용. 그러나 **일부 컴포넌트가 인라인 스타일·하드코딩 slate/navy·레거시 타이포를 그대로 유지**해 톤이 깨진다. 이번 작업은 그 격차를 메우고, 함께 발견된 **데드 코드를 일괄 제거**한다.

## 2. 목표 / Non-goals

**목표**
- 살아있는 모든 사용자 시야 컴포넌트가 **단일 토큰 세트**를 쓰도록 통일.
- 인라인 스타일(`style={{ fontSize, color: 'var(--tj-*)' }}`)을 Tailwind 클래스로 치환.
- 하드코딩된 `slate-*`, `[#0f172a]`, `bg-navy`, `border-gray-200`, `border-slate-200/border-border-dark`를 새 토큰으로 대체.
- 데드 코드(컴포넌트 9개 + 테스트 2개) 일괄 삭제.

**Non-goals**
- 컴포넌트 구조·계층·기능 변경 (props 시그니처, 부모-자식 관계, 데이터 흐름은 그대로).
- 새 페이지·기능 추가.
- 다크 그라디언트 자체 톤을 가진 `CrowdingCard`·`WeatherCard`·`TrafficFlowCard`의 그라디언트 컬러는 유지 (라운드·타이포만 토큰화).
- Alembic·DB 변경. 모두 프론트엔드 작업.

## 3. 디자인 토큰 매핑 (BEFORE → AFTER)

| 격차 패턴 | BEFORE | AFTER |
|---|---|---|
| 본문 mute | `text-slate-500`, `text-[#94a3b8]`, `text-slate-400 dark:text-slate-400` | `text-mute dark:text-mute-dark` |
| 본문 ink | `text-slate-800/900 dark:text-slate-100/200`, `text-[#0f172a]` | `text-ink dark:text-ink-dark` |
| 본문 text | `text-slate-600/700 dark:text-slate-300` | `text-text dark:text-text-dark` |
| 액센트 (navy) | `text-navy`, `bg-navy`, `text-navy dark:text-blue-400` | 액션·강조는 `text-accent` / `bg-accent`. 라인 컬러는 노선 토큰(`bg-line-4`, `text-line-suin` 등) 유지. 검정 active는 `bg-ink text-white`. |
| 임박 | hardcoded `#dc2626`, `text-red-500/600`, `bg-red-50`, `text-amber-*` | `text-imminent dark:text-imminent-dark`, `bg-imminent/8`, 좌측 3px `bg-imminent` 액센트 바 |
| 카운트다운 숫자 | `text-3xl/4xl font-bold time-num` | `text-countdown font-black tabular-nums` (32px) — 또는 모바일 `text-eta-mob` (26px) |
| 라벨 카프스 | `text-xs font-semibold text-slate-400 uppercase tracking-wide` | `text-meta font-bold text-mute` (의미 명확하면 caps 유지) |
| 패널 제목 | `text-base/lg font-bold text-slate-900` | `text-panel-ttl text-ink` |
| 페이지 제목 | `text-lg/xl font-bold` | `text-page-ttl text-ink` |
| 칩 | `text-[10px] font-bold bg-blue-100 text-blue-700`, 인라인 RGB | `text-chip bg-chip-{color}-bg text-chip-{color}-fg` (5개 색) + 다크 페어 |
| 카드 | `rounded-2xl border-slate-200 dark:border-border-dark shadow-sm` | `rounded-card shadow-card` (보더리스) — 강조 카드는 `shadow-card-md` |
| 큰 카드 (그라디언트) | `rounded-3xl` | `rounded-card-lg` (18px) |
| 행 구분선 | `border-slate-100 dark:border-border-dark`, `border-gray-200` | `border-line dark:border-line-dark` |
| 모드 토글 | 텍스트 링크 또는 작은 토글 | 한 컨테이너 안의 세그먼트 pill (활성 `bg-ink text-white`, 비활성 `text-mute`) |
| 상대 시각 표기 | `갱신 14:38` (절대) | `22초 전 갱신` (상대, 카운터 + tabular-nums) |
| 인라인 스타일 변수 | `style={{ color: 'var(--tj-mute)', fontSize: 13 }}` | Tailwind 클래스로 추출 (`text-meta text-mute`) |

## 4. 컴포넌트별 변경 사항

상세 BEFORE/AFTER 시안은 비주얼 컴패니언 페이지 참조. 여기엔 **무엇을 어떻게**만 요약.

### 4.1 지하철 그룹 (`group-1-subway.html`)

| # | 컴포넌트 | 핵심 변경 |
|---|---|---|
| 1.1 | `subway/SubwayCountdown.jsx` | `bg-white dark:bg-surface-dark` 유지 / `border-slate-200 dark:border-border-dark` → `border-line dark:border-line-dark` / 라벨 `text-base text-slate-500` → `text-meta text-mute font-bold` / 카운트 `text-3xl font-bold time-num` + `style={{ color: timerColor }}` → `text-countdown font-black tabular-nums` + `style={{ color: timerColor }}` 유지(노선 컬러 동적) / 우측 시간 `text-base font-bold text-slate-900` → `text-panel-ttl text-ink` |
| 1.2 | `subway/SubwayRealtimeCard.jsx` (`RealtimeCompactCard` + `RealtimeSlot`) | 인라인 `style={{ fontSize, fontWeight, color }}` 전부 Tailwind 클래스로 추출 / `var(--tj-mute/ink/line)` → 토큰 클래스 / `#dc2626` → `text-imminent dark:text-imminent-dark` / "실시간 (베타)" 텍스트 → `chip-blue` 칩 / labelSize 분기는 `text-eta-mob` / `text-panel-ttl` / `text-meta` 등 의미 토큰으로 분기 |
| 1.3 | `subway/SubwayLineCard.jsx` | `rounded-xl border-slate-200` → `rounded-card shadow-card` 보더리스 / `time-num text-3xl font-bold` → `text-countdown font-black tabular-nums` / `bg-white/70 dark:bg-slate-700/70 border-slate-200` "놓치면 N분 더" 칩 → `bg-surface shadow-pill` / 이후 열차 행 `text-sm font-semibold text-slate-700` → `text-meta font-bold text-ink` |
| 1.4 | `subway/SubwayLineMap.jsx` | `border-slate-100 dark:border-border-dark` → `border-line dark:border-line-dark` / 하드코딩 `#334155 #e2e8f0 #cbd5e1 #475569` → 토큰 (단, 노선 컬러 자체는 props로 받는 동적값 유지) / `text-xs text-slate-500` → `text-meta text-text` / `text-amber-*` 접근 중 → `text-imminent` + 헤일로 효과 (`shadow-[0_0_0_4px_rgba(226,106,77,0.12)]`) |
| 1.5 | `subway/SubwayRealtimeBoard.jsx` | 섹션 헤더 `bg-slate-50 dark:bg-slate-900/50 border-slate-100` → `bg-surface-alt border-line` / 임박 행 `bg-red-50 text-red-600` → 좌측 3px `bg-imminent` 액센트 바 + `bg-imminent/8` + "진입" 칩 / `border-slate-100 dark:border-slate-800` 행 구분 → `border-line dark:border-line-dark` / 시간 셀 `text-xl font-black` → `text-eta-mob font-black tabular-nums` |
| 1.6 | `subway/GlobalSubwayDetailSheet.jsx` | 이미 `bg-surface dark:bg-surface-dark`, `border-line` 일부 사용 / 내부 실시간 카드 `border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50` → `border-line bg-surface-alt` / 액션 버튼(노선도) 헤더 옆 위치 → 카드 하단 풀너비 (`bg-chip-blue-bg text-chip-blue-fg`) / 헤더 라벨 "이 열차 실시간" caps → `text-meta text-accent font-black` |
| 1.7 | `subway/SubwayTimetable.jsx` | 시간 셀 `time-num text-lg font-semibold` → `text-eta-mob font-bold tabular-nums` / `text-base text-slate-500 dark:text-slate-400` 목적지 → `text-meta text-mute` / "다음" 행 backgroundColor inline → 좌측 3px 액센트 바 추가 (배경은 `lineLightColor` 유지) / `text-base font-bold` "N분 후" → `text-panel-ttl` |
| 1.8 | `summary/SubwayPanel.jsx` | 자체 마크업은 적음(`RealtimeCompactCard` + `DualDirectionCard` 위임). 시간표/실시간 모드 토글 UI는 부모인 `SchedulePage`에 있음 → 토글이 텍스트 링크라면 세그먼트 pill로 |
| 1.9 | 지하철 탭 헤더 (실제로는 `SchedulePage.jsx` 내부) | 정류장 칩 활성 `bg-navy text-white` → `bg-ink text-white` / 모드 토글(실시간·시간표) 텍스트 링크 → 세그먼트 pill (`bg-line-dark` 컨테이너 + 활성 `bg-ink`) |

### 4.2 카드류 (`group-2-cards.html`)

| # | 컴포넌트 | 핵심 변경 |
|---|---|---|
| 2.1 | 셔틀 카운트다운 (실제 위치는 `SchedulePage.jsx`의 셔틀 섹션 — 컴포넌트 `shuttle/ShuttleCountdown.jsx`는 데드 코드 §6.1) | 라벨 `text-sm text-slate-500` → `text-meta text-mute font-bold` / `time-num text-4xl font-bold text-navy dark:text-blue-400` → `text-countdown font-black tabular-nums text-shuttle dark:text-accent-dark` / 회차편 outline 칩 `border-navy text-navy` → `chip-blue-bg/fg` tinted / 수시운행 variant: 카운트다운 자리에 라이브 도트(`bg-state-ok` + 헤일로) + "수시 운행 중" 라벨 + 우측 `chip-green` "바로 탑승" |
| 2.2 | `summary/TaxiPanel.jsx` | `text-[#0f172a]` → `text-ink` / `text-[#94a3b8]` → `text-mute` / `text-[16px] font-extrabold tabular-nums text-navy` → `text-panel-ttl font-black text-ink` (18px) / 활성 행: `bg-navy` 네비 버튼만 강조 → 행 자체에 `bg-surface-alt + 좌측 3px bg-accent 액센트 바` + 버튼은 `bg-ink text-white` / 비활성 버튼 `bg-slate-100 dark:bg-slate-700 text-slate-500` → `bg-line text-text` |
| 2.3 | `stats/WeatherCard.jsx` | `rounded-3xl border-white/5 shadow-sm` → `rounded-card-lg shadow-card-md` / 메인 온도 `text-4xl font-extrabold` → `text-[44px] font-black tabular-nums tracking-[-0.04em]` (또는 새 토큰 `text-weather-temp`) / "최고/최저" 텍스트 → ↑↓ 화살표 prefix (`text-yellow-300/80` + `text-blue-300/80`) / "이후 기온 변화" 라벨 `text-[10px] text-white/40` → `text-ghdr text-white/50` / 다크 그라디언트 자체는 유지 (`CARD_BG` 객체 그대로) |
| 2.4 | `stats/TrafficFlowCard.jsx` | 동일하게 `rounded-3xl` → `rounded-card-lg` / 헤더 "마유로 교통 흐름" 한 줄 → 2줄 (`text-ghdr` "마유로" caps + `text-panel-ttl` "교통 흐름") / `text-4xl font-extrabold` 상태 라벨 → `text-countdown` (32px) + 좌측 펄스 도트(상태 색 + 헤일로) / "17시경 예상" 부가 정보 "현재 + N시간" 추가 / `bg-white/8 ring-1 ring-white/12` 토글 → `bg-white/10 backdrop-blur` 토글 |

### 4.3 더보기 그룹 (`group-3-more.html`)

`MoreTab.jsx`는 데드 코드(§6.1). 실제 페이지는 `pages/MorePage.jsx`.

| # | 위치 | 핵심 변경 |
|---|---|---|
| 3.1 | `pages/MorePage.jsx` (헤더 + 카드 + 행) | `bg-navy text-white` 헤더 → `text-page-ttl text-ink` 페이지 타이틀만 (CafeteriaPage 패턴, 외부 bg는 `bg-bg dark:bg-bg-dark`) / 카드 `rounded-2xl border-slate-200 shadow-sm` → `rounded-card shadow-card` 보더리스 / 섹션 라벨 `text-xs font-bold text-slate-400 tracking-widest` → `text-ghdr text-mute` / Row 아이콘에 칩 배경 추가 (`w-8 h-8 rounded-mini bg-surface-alt`) / Row 텍스트 `text-sm font-semibold text-slate-800 dark:text-slate-200` → `text-panel-ttl text-ink` / 날짜 절대 → 상대(`fmtDate` 헬퍼) / Toggle `bg-navy dark:bg-blue-600` → `bg-ink dark:bg-accent` |
| 3.2 | `more/NoticeHighlights.jsx` | 인라인 `linear-gradient(160deg, #102c4c, #1b3a6e)` 유지(navy 그라디언트 자체는 좋음) / 좌측 4px 스트라이프 `var(--tj-accent-dark)`(#7aa7e3) → 새 `accent`(#4f9fff) / 📌 이모지 → `chip-blue-bg/fg` 칩 ("📌 공지") / 타이틀 `font-size:16 font-weight:900` → `font-size:18` / padding 14/16 → 18/20 / `box-shadow:0 4px 14px rgba(16,44,76,0.18)` 명시 |
| 3.3 | `more/NotificationsPage.jsx` | 헤더의 `bg-white border-slate-100` 분리바 제거 → 외부 bg 통합 / Empty state를 카드로(`shadow-card`) + 큰 아이콘 칩 + `chip-yellow` "예정 · 2026 Q3" / 외부 `bg-slate-50 dark:bg-bg-dark` → `bg-bg dark:bg-bg-dark` |
| 3.4 | `more/AppInfoPage.jsx` | 단일 빈약한 카드 → 히어로 카드(앱 아이콘 그라디언트 + 이름 + 버전 chip-blue) + 정보 row 그룹(Made by / 기관) 분리 / 인라인 `var(--tj-line)` `var(--tj-bg-soft)` `var(--tj-accent)` → Tailwind 클래스 / 외부 bg 통합 |
| 3.5 | `more/DarkModePage.jsx` | 옵션 segment + 설명 카드 3개 분리 → 한 카드에 통합 (현재 선택만 설명 표시) / 선택 옵션 (`DarkModeSegment` 내부) `bg-navy` → `bg-ink` / 옵션에 글리프 추가 (☀ ⊙ ☾) / 외부 bg 통합 |

### 4.4 스케줄·리스트 (`group-4-schedule.html`)

| # | 컴포넌트 | 핵심 변경 |
|---|---|---|
| 4.1 | `schedule/ScheduleDetailModal.jsx` (`TimeRow`, `PastRow`) | 향후 행 `bg-slate-50 dark:bg-slate-700/40 border` 박스 → 보더리스 (`px-5 py-3`만, 행 사이 시각 분리는 padding으로) / "다음" 행만 강조 카드(`bg-accent/8` + 좌측 3px `bg-accent` 액센트 바) / 평일/토/일 inline 텍스트 → `chip-blue` 칩 / 시간 폰트 `text-lg font-extrabold` → `text-countdown font-black` (다음 행만), 나머지는 `text-eta-mob font-bold` |
| 4.2 | `schedule/StatsSheet.jsx` | 헤더 `text-display` → `text-page-ttl` (22px) / 닫기 버튼 `bg-slate-100 dark:bg-slate-800` → `bg-line dark:bg-line-dark` / `rounded-t-[28px] md:rounded-[24px]` → `rounded-t-card-lg md:rounded-card-lg` (18px) / 상단에 드래그 핸들 추가 / `StatusChips` 양식 통일 (도트 prefix + `chip-*-bg/fg` 토큰) |
| 4.3 | `bus/ArrivalList.jsx` | 상단 라벨 `text-xs font-bold text-slate-400 dark:text-slate-500 uppercase` → 정류장 타이틀 (`text-panel-ttl text-ink`) + 방향 칩 분리 / 카테고리 라벨 caps만 → 색 액센트 바(`w-1 h-3.5 bg-accent`(등교) / `bg-imminent`(하교)) + 개수 부가정보 |
| 4.4 | `bus/BusTimetableDetail.jsx` | `bg-navy text-white` 헤더 → 페이지 bg 위 일반 헤더 (페이지 타이틀 `text-page-ttl text-ink` + `chip-line` 평일 칩) / 뒤로 화살표 → `bg-line` 칩 버튼 / `BOARDING_INFO` hint `bg-blue-50 dark:bg-blue-950/30 border-blue-100` → `bg-chip-blue-bg dark:bg-chip-blue-bg-dark rounded-card` 카드 / 다음 행 `bg-blue-50 dark:bg-blue-950/30` → 좌측 3px 액센트 바 + 노선 배경색 / `time-num text-lg font-semibold text-navy` → `text-eta-mob font-black tabular-nums text-accent` |

### 4.5 트랜짓·네비 (`group-5-transit-v2.html`)

| # | 컴포넌트 | 핵심 변경 |
|---|---|---|
| 5.1 | `transit/BusCard.jsx` | 카드 `border-slate-200 dark:border-border-dark shadow-sm` → `shadow-card` 보더리스 / 헤더 `text-navy dark:text-blue-400/300` → `text-ink` + `chip-blue` "실시간" 칩 / "갱신 HH:MM" 절대 시각 → "N초 전 갱신" 상대 (state hook) / 활성 정류장 `bg-navy text-white dark:bg-blue-600` → `bg-ink text-white` / 비활성 `bg-slate-100 dark:bg-slate-700 text-slate-600/300` → `bg-surface-alt text-text` / 새로고침 버튼 빈 아이콘 → `bg-line` 칩 버튼 |

**참고:** `FloatingDock`은 이미 REFERENCE. 변경 없음.

## 5. 디자인 토큰 신규 추가 / 정리

**신규 추가 검토:**
- 큰 다크 카드용 그림자: `shadow-card-dark`(`0 4px 14px rgba(0,0,0,0.10)`) — `WeatherCard`·`TrafficFlowCard`·`CrowdingCard`용. 또는 기존 `shadow-card-md`를 그대로 활용.
- 날씨 온도 전용 사이즈: `weather-temp` (44px/900/-0.04em) — 또는 인라인 유지.

**제거(정리):** §6.2 참조.

## 6. 데드 코드 & 잔존 참조 제거

### 6.1 삭제 대상 파일 (9개 컴포넌트 + 2개 테스트 = 11개)

```
frontend/src/components/layout/BottomDock.jsx
frontend/src/components/layout/BottomDock.test.jsx
frontend/src/components/layout/PCNavbar.jsx
frontend/src/components/map/MainTab.jsx
frontend/src/components/map/MainTab.test.jsx
frontend/src/components/map/TaxiCard.jsx
frontend/src/components/more/MoreTab.jsx
frontend/src/components/shuttle/ShuttleCountdown.jsx
frontend/src/components/subway/SubwayTab.jsx
frontend/src/components/transit/TransitTab.jsx
frontend/src/components/common/Toast.jsx
```

**검증:** 각 파일은 자기 자신·자기 테스트 외에는 import 0개. PCDock·MorePage·SchedulePage·CafeteriaPage·PCMainShell·App.jsx가 실제 라우팅과 화면 구성을 담당.

### 6.2 잔존 주석·참조 정정

- `frontend/src/components/layout/MainShell.jsx:39` — 주석 "BottomDock(60px)" → "FloatingDock(60px 영역 확보)"로 정정. paddingBottom 계산은 그대로(`60px + env(safe-area-inset-bottom)`).
- `frontend/src/components/schedule/ScheduleDetailModal.jsx:5,723` — 주석 "BottomDock 위로" → "FloatingDock 위로".
- `frontend/src/components/map/RouteSpine.jsx:51` — 주석 "coral로 강조됨" → 실제 사용 색으로.
- `frontend/src/components/more/NoticeHighlights.jsx:46` — 주석 "navy 그라데이션" → "shuttle 그라데이션" 또는 정확한 토큰명.
- `frontend/src/components/map/MarkerDot.jsx:52-53` — "navy" 설명 주석 정정.

### 6.3 Tailwind 토큰 정리

- `colors.coral.DEFAULT` (DEPRECATED) — 사용 0, 삭제 가능.
- `colors.navy.light` (DEPRECATED) — 사용 0, 삭제 가능.
- `colors.coral` 객체 자체 — `coral.DEFAULT`만 정의됨, 삭제 가능.
- `colors.navy.light` 외 `colors.navy.DEFAULT`는 `bg-shuttle` 도메인 색으로 살아있음. 단, MoreTab 헤더의 `bg-navy`는 §4.3에서 변경 후 사용처 없으면 `colors.navy` 자체를 `colors.shuttle`로 통합 가능 (별도 follow-up).
- 폰트사이즈 DEPRECATED 토큰(`hero`, `bigMin`, `display`, `title`, `body`, `caption`, `micro`) — `text-micro`는 막차/첫차 칩에서 일부 사용 중. 다른 것들은 본 작업으로 사용처 0이 되면 일괄 제거. 별도 follow-up commit으로 분리.

## 7. 우선순위 & 작업 순서

각 그룹을 독립 커밋으로 분리한다 — 리뷰·롤백 단위.

| 순서 | 그룹 | 영향 범위 | 예상 작업량 |
|---|---|---|---|
| 1 | **데드 코드 삭제** (§6.1, §6.2) | 사용자 영향 0, 안전 정리 | 30분 |
| 2 | **지하철 그룹** (§4.1) | 시야 최상위·인라인 스타일 최다·최근 작업 영역 | 3~4시간 |
| 3 | **카드류** (§4.2) | TaxiPanel·ShuttleCountdown(SchedulePage 내)·WeatherCard·TrafficFlowCard | 2~3시간 |
| 4 | **스케줄·리스트** (§4.4) | ScheduleDetailModal · BusTimetableDetail의 bg-navy 헤더 | 2~3시간 |
| 5 | **더보기** (§4.3) | MorePage 헤더 + sub-pages | 2시간 |
| 6 | **트랜짓** (§4.5) | BusCard | 30분 |
| 7 | **토큰 정리** (§6.3) | tailwind.config.js DEPRECATED 제거 | 30분 |

총 예상: **10~13시간** (테스트 포함).

## 8. 검증 계획

- **타입 / 빌드:** `cd frontend && npm run build` — 빌드 깨지면 즉시 중단.
- **테스트:** `npm run test` — 기존 통과 테스트가 모두 통과해야 함. 데드 코드 삭제 시 대응 테스트도 함께 삭제.
- **시각 회귀:** 각 그룹 commit 후 Vite dev server에서
  - 모바일(width 390px) + PC(width 1280px) 양쪽
  - 라이트 + 다크 양쪽
  - 다음 시나리오 클릭 확인:
    1. 메인 지도 → 정류장 마커 → 도착 카드(BusArrivalCard 변화 없음 확인)
    2. 시간표 페이지 → 지하철 탭(실시간/시간표 토글) + 버스 탭(노선 클릭 → BusTimetableDetail) + 셔틀 탭(카운트다운)
    3. 더보기 페이지 → 공지 펼치기 + 다크모드 토글 + 알림/앱 정보 sub-page 진입·뒤로
    4. PC 좌측 dock 정류장 picker (변화 없음 확인)
    5. 모바일 FloatingDock 4 탭 전환 (변화 없음 확인)
- **회귀 우려 지점:**
  - `BottomDock.jsx` 삭제 시 `MainShell.jsx`의 paddingBottom 계산은 그대로여야 함 — 주석만 정정.
  - `MorePage`와 `MoreTab` 둘 다 존재 — 라우터(App.jsx)가 어느 쪽을 쓰는지 확인 후 데드 쪽만 삭제. (스캔 결과 MoreTab이 데드)
  - `ShuttleCountdown.jsx`가 데드이지만 디자인 패턴은 `SchedulePage`의 셔틀 섹션에 흡수되어 있을 가능성. §4.2의 변경은 SchedulePage의 셔틀 카운트다운 마크업에 적용.
- **모니터링:** `WeatherCard` `TrafficFlowCard` `CrowdingCard`의 다크 그라디언트가 의도된 자체 톤임을 유지. 라이트 모드 surface 토큰으로 잘못 바꾸지 않도록.

## 9. 변경되지 않는 것 (명시)

- 모든 컴포넌트의 **props 시그니처**.
- API 호출, 폴링 주기, 데이터 모델.
- 라우팅 (`/`, `/schedule`, `/cafeteria`, `/more`, `/favorites`).
- `FloatingDock`, `PCDock`, `PCStationPicker`, `BusArrivalCard`, `Dashboard`, `CafeteriaPage`, `MorePage`의 행 구조와 동작.
- 카카오맵 SDK 코드 (`/map` 스킬 영역 — 이번 작업에서 손대지 않음).
- 다크 그라디언트 카드(`WeatherCard` `TrafficFlowCard` `CrowdingCard`)의 그라디언트 색.
- 노선 컬러 토큰 (`line-4`, `line-suin`, `line-seohae` 등 — 시각 식별자).

## 10. Follow-up (이번 작업 범위 외)

- DEPRECATED 폰트사이즈 토큰(`hero`, `bigMin`, `display`, `title`, `body`, `caption`) 제거 — 본 작업 후 사용처 0 확인 시 별도 commit.
- `navy` 컬러 토큰을 `shuttle`로 통합 — 의미 명확화.
- `border-dark` → `line-dark` 별칭 정리 (후방호환만 유지 중).
