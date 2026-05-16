# Bus Timetable Card Redesign — Design Spec

- 작성: 2026-05-16
- 상태: 확정 (사용자 승인)
- 시안 산출물: `.superpowers/brainstorm/506073-1778927656/content/s3b-v5.html` (브레인스토밍 v1 → v5)
- 영향 페이지: `/schedule` (버스 탭), 추후 대시보드 마커 시트도 호환 유지

---

## 1. 배경

현 `BusArrivalCard`는 한 카드 안에 작은 텍스트가 너무 많고(`정보 없음 베타`, `실시간 · 아이파크아파트행 베타`, `다음 24분 뒤 그 다음 59분 뒤`, `여유`) 카드별 콘텐츠 길이가 달라 시각적 그리드가 깨진다. 카테고리·경로 정보가 빈약하고, ETA가 "어느 정류장 도착 시간인지"가 명확하지 않다.

리디자인 목표:

1. **정렬 일관성** — 모든 카드 동일 3-컬럼 그리드 (chip · 본문 · ETA), ETA 우정렬.
2. **카테고리 시각화** — 광역/간선/시내·마을 3분류 헤더로 그룹.
3. **경로 미니 트랙** — 출발지·경유·종점을 도트+라인으로 시각화 (지하철 노선도 톤).
4. **출발지 명시** — 카드 머리에 "○○ 에서 출발" + 트랙 시작 도트·라벨·헤더 출발지명을 노선 컬러로 통일 강조. ETA(`3분`)가 어느 정류장 도착인지 시각적으로 자명.

---

## 2. 카테고리 분류

기존 `ROUTE_DISPLAY_CONFIG`의 컬러를 카테고리로 매핑한다. 색은 한국 버스 표준에서 한 발자국 떨어진 앱 자체 컨벤션을 그대로 따른다.

| 카테고리 | 컬러 토큰 | hex | 소속 노선 (현재) |
|---|---|---|---|
| `express` (광역) | `line-express` | `#DC2626` | 3400, 3401, 5200, 6502 |
| `trunk` (간선) | `line-201` | `#2563EB` | 20-1, 5602 |
| `local` (시내·마을) | `line-33` | `#0891B2` | 시흥33, 11-A, 시흥1, 99-2 |

> 분류 추가/이전이 필요할 때는 `ROUTE_DISPLAY_CONFIG` 한 곳만 수정한다.

---

## 3. 카드 컴포넌트 spec

### 3.1 레이아웃 그리드

**카드 row (모바일 기본):**

```
[chip 64px] [body 1fr] [eta 86px]
```

- gap `14px`
- padding `14px 18px 16px`
- 카드 row 사이 hairline `1px var(--line-soft)` (첫 row 제외)
- PC (≥768px): `[78px] [1fr] [110px]`, padding `16px 24px 18px`

### 3.2 노선 chip

`RouteChip` 컴포넌트의 신규 prop 또는 새 variant `<RouteChip variant="solid">`.

- height `32px` (PC `34px`), min-width `60px` (PC `64px`)
- border-radius `9px`, padding `0 10px`
- 배경 = 카테고리 솔리드 컬러 (`line-express` / `line-201` / `line-33`)
- text white, font `13px / 800 / tabular-nums`
- inset shadow `inset 0 -2px 0 rgba(0,0,0,.08)` (살짝 입체)

### 3.3 from-line (출발지 명시)

```
[시화터미널] 에서 출발
```

- `시화터미널` = 카테고리 컬러, `font-weight: 800`, `font-size: 12px` (PC `13px`)
- `에서 출발` = `text-mute` muted, `font-size: 9.5px`, `font-weight: 700`, `letter-spacing: 0.04em`, uppercase tracking
- margin-bottom `2px`

### 3.4 head (행선지)

```
신도림행  [여유]   (또는: 19:50)
```

- `신도림행` = `text-ink`, `font-size: 16px` (PC `18px`), `font-weight: 800`, `letter-spacing: -0.01em`
- ellipsis on overflow
- 보조 슬롯:
  - **crowd 배지** — 도착 데이터의 혼잡도 (`level 1=여유 / 2=보통 / 3,4=혼잡`). 기존 `bg-chip-green-bg / bg-chip-yellow-bg / bg-chip-red-bg` 토큰 재사용.
  - **sched 텍스트** — 시간표 기반 노선에 `19:50` 형태. uppercase 작은 라벨톤.

### 3.5 미니 트랙

도트 수에 따라 `t2 / t3 / t4` 변형. CSS Grid template-columns:

```
.t2 { 12px 1fr 8px }
.t3 { 12px 1fr 8px 1fr 8px }
.t4 { 12px 1fr 8px 1fr 8px 1fr 8px }
```

`pt-start` (출발 도트, 강조):

- 11px × 11px, border-radius 999px
- 배경 = 카테고리 컬러
- box-shadow `0 0 0 3px <route-halo>` (같은 컬러 alpha 0.16 — 라이트 / 0.28 — 다크)

`pt` (경유·종점 도트):

- 7px × 7px, 검정 (`var(--rail-ink)` = `#1A1D24` / 다크 `#E6E9EE`)

`seg` (라인):

- height `2px`, 검정 (`var(--rail-ink)`)
- border-radius `1px`

라벨 grid (트랙 아래 5px):

- `t2`: `auto 1fr auto` (start / spacer / end)
- `t3`: `1fr 1fr 1fr`
- `t4`: `1fr 1fr 1fr 1fr`
- 폰트 `11px / 700 / -0.005em`
- **start 라벨만** 카테고리 컬러 + `font-weight: 800` + `font-size: 12px`
- 나머지(mid, end)는 `text-ink` 검정 700

### 3.6 ETA

```
 3분
다음 28분
```

- `.v` (분 숫자) — `30px / 900 / -0.05em / tabular-nums` (PC `38px`)
- `.u` (단위 "분") — `11px / 800 / text-mute`, margin-left 2px
- `.next` (다음 출발 sub) — `10px / 600 / text-mute`, margin-top 5px
- 우정렬 (`text-align: right`)
- **임박 (< IMMINENT_THRESHOLD_SEC = 180s)**:
  - `.v`, `.u` 색을 `imminent` 토큰 (라이트 `#e26a4d` / 다크 `#f87171`)으로 전환
  - halo 펄스 애니메이션 1.6s ease-out infinite (`text-shadow` 0 → 18px alpha 0.45 → 0)
- **정보 없음**:
  - `.v` = `—`, 색 `mute-2`, weight 700, size 24px
  - `.next` 숨김

### 3.7 카테고리 헤더

```
[swatch:광역] 광역버스         3 ROUTES
```

- padding `16px 18px 6px`
- swatch = `22px × 22px`, border-radius `7px`, 배경 카테고리 컬러, 흰 글자 `10px / 800 / 0.04em` "광역"/"간선"/"시내"
- 타이틀 = `13px / 800 / -0.005em / ink`
- 카운트 = 우측 끝, `10px / 700 / mute / 0.08em / uppercase`, `N ROUTES`

---

## 4. 상태 변형

| 상태 | head | from-line | 트랙 | ETA |
|---|---|---|---|---|
| 실시간 정상 | 행선지 | 출발지 컬러 | 컬러 시작 도트 | 분 + "다음 N분" |
| 임박 (<180s) | 동일 | 동일 | 동일 | 빨강 + halo 펄스, sub "곧 도착" |
| 시간표 기반 | 행선지 + `19:50` | 동일 | 동일 | 분 + "20:20 다음" |
| 정보 없음 | 행선지 + `시간표 없음` (회색) | 출발지명 회색 | 도트/라인 회색 | `—` |
| 다중 경유 (4점) | 동일 | 동일 | t4 그리드 | 동일 |
| 혼잡 | 행선지 + `혼잡` 배지 | 동일 | 동일 | 동일 |

---

## 5. 데이터 모델 변경

### 5.1 `ROUTE_DISPLAY_CONFIG` 확장 (`frontend/src/components/dashboard/busStationConfig.js`)

기존:

```js
export const ROUTE_DISPLAY_CONFIG = {
  '3400':  { color: '#DC2626', direction: '사당 경유 · 강남행' },
  // ...
}
```

확장:

```js
export const ROUTE_DISPLAY_CONFIG = {
  '3400':  { color: '#DC2626', category: 'express', direction: '사당 경유 · 강남행' },
  '5200':  { color: '#DC2626', category: 'express', direction: '신천역 경유 · 신도림행' },
  '3401':  { color: '#DC2626', category: 'express', direction: '시흥시청 경유 · 석수행' },
  '6502':  { color: '#DC2626', category: 'express', direction: '사당행' },
  '20-1':  { color: '#2563EB', category: 'trunk',   direction: null },
  '5602':  { color: '#2563EB', category: 'trunk',   direction: '시흥시청 경유 · 구로행' },
  '시흥33': { color: '#0891B2', category: 'local',   direction: null },
  '11-A':  { color: '#0891B2', category: 'local',   direction: null },
  '99-2':  { color: '#0891B2', category: 'local',   direction: null },
  '시흥1':  { color: '#0891B2', category: 'local',   direction: null },
}
```

helper:

```js
export const ROUTE_CATEGORY_ORDER = ['express', 'trunk', 'local']
export const ROUTE_CATEGORY_LABEL = { express: '광역버스', trunk: '간선버스', local: '시내·마을' }
export const ROUTE_CATEGORY_SWATCH = { express: '광역', trunk: '간선', local: '시내' }

export function getRouteCategory(routeNo) {
  return ROUTE_DISPLAY_CONFIG[routeNo]?.category ?? 'local'
}
```

### 5.2 경로(트랙) 데이터 — `ROUTE_PATH`

기존 `ROUTE_CARD_DISPLAY[route][direction] = { origin, dest }` 의 `dest` 문자열을 파싱 가능한 구조로 분리.

```js
// frontend/src/components/dashboard/busStationConfig.js
export const ROUTE_PATH = {
  '11-A':   { 하교: { origin: '한국공대', waypoints: [], terminus: '정왕역', label: '정왕역행' } },
  '20-1':   { 하교: { origin: '한국공대', waypoints: ['정왕역'], terminus: '아이파크', label: '아이파크아파트행' } },
  '시흥33': {
    하교: { origin: '한국공대', waypoints: ['정왕역'], terminus: '시흥시청', label: '시흥시청행' },
    등교: { origin: '시흥시청역', waypoints: [], terminus: '한국공대', label: '학교행' },
  },
  '3400': { 하교: { origin: '시화터미널', waypoints: ['사당'], terminus: '강남', label: '강남행' } },
  '3401': {
    하교: { origin: '이마트', waypoints: [], terminus: '서울', label: '서울행' },
    등교: { origin: '시흥시청역', waypoints: ['이마트'], terminus: '한국공대', label: '학교행' },
  },
  '5602': {
    하교: { origin: '이마트', waypoints: [], terminus: '구로디지털', label: '구로디지털단지행' },
    등교: { origin: '시흥시청역', waypoints: ['이마트'], terminus: '한국공대', label: '학교행' },
  },
  '5200':  { 하교: { origin: '시화터미널', waypoints: ['신천역'], terminus: '신도림', label: '신도림행' } },
  '99-2':  { 하교: { origin: '시화터미널', waypoints: ['이마트'], terminus: '월곶역', label: '월곶역 방면' } },
  '6502':  { 하교: { origin: '이마트', waypoints: [], terminus: '사당', label: '사당행' } },
  '시흥1': { 하교: { origin: '이마트', waypoints: ['신천역'], terminus: '개봉', label: '개봉행' } },
}

export function getRoutePath(routeNo, category) {
  return ROUTE_PATH[routeNo]?.[category] ?? null
}
```

기존 `ROUTE_CARD_DISPLAY` / `getRouteCardDisplay`는 호환을 위해 `ROUTE_PATH`로부터 파생되도록 변환:

```js
export function getRouteCardDisplay(routeNo, category) {
  const p = getRoutePath(routeNo, category)
  if (!p) return null
  const via = p.waypoints.length ? `${p.waypoints.join(' 경유 ')} 경유 ` : ''
  return { origin: p.origin, dest: `${via}${p.terminus}행` }
}
```

> **MapView**·**BusPanel**은 `getRouteCardDisplay`를 그대로 호출하므로 영향 없음.

---

## 6. 컴포넌트 파일 영향

| 파일 | 변경 |
|---|---|
| `frontend/src/components/dashboard/busStationConfig.js` | `ROUTE_DISPLAY_CONFIG` 확장 · `ROUTE_PATH` 추가 · helper 추가 · `getRouteCardDisplay` 파생화 |
| `frontend/src/components/bus/BusArrivalCard.jsx` | **전면 교체** — v5 디자인. 기존 export(`CrowdedBadge`, `RouteProgressStrip`)는 유지하여 외부 호환 깨지지 않게. |
| `frontend/src/components/bus/ArrivalList.jsx` | `category` (등교/하교/기타) 그룹 위에 **route category (express/trunk/local) sub-group** 추가. 카테고리 헤더 렌더. |
| `frontend/src/components/bus/BusArrivalCard.test.jsx` | 새 DOM 구조에 맞춰 selector 수정 — chip / from-line / track / labels / eta |
| `frontend/src/components/bus/ArrivalList.test.jsx` | 카테고리 헤더 그룹화 검증 추가 |
| (옵션) `frontend/src/components/bus/MiniTrack.jsx` | 트랙(도트+라벨) 별도 컴포넌트로 추출. 단위 테스트 용이 |

`tailwind.config.js`에 토큰 추가:

```js
// colors
'route-halo-red':  'rgba(220,38,38,.16)',
'route-halo-blue': 'rgba(37,99,235,.16)',
'route-halo-cyan': 'rgba(8,145,178,.18)',
'route-halo-red-dark':  'rgba(220,38,38,.28)',
'route-halo-blue-dark': 'rgba(37,99,235,.28)',
'route-halo-cyan-dark': 'rgba(8,145,178,.32)',

// fontSize (필요 시)
'from':       ['12px', { lineHeight: '1', fontWeight: '800', letterSpacing: '-0.005em' }],
'from-suffix':['9.5px',{ lineHeight: '1', fontWeight: '700', letterSpacing: '0.04em' }],
'track-lbl':  ['11px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.005em' }],
'track-lbl-start': ['12px', { lineHeight: '1.2', fontWeight: '800', letterSpacing: '-0.01em' }],
```

> 또는 인라인 Tailwind utility(`text-[12px] font-extrabold tracking-[-.01em]`)로 처리해도 무방. 컴포넌트 코드 가독성을 우선으로 결정.

---

## 7. 다크 모드 토큰

기존 `surface-dark`, `line-dark`, `ink-dark`, `mute-dark`, `imminent-dark` 그대로 사용. 추가 토큰만 다크 변형 (halo alpha 증가).

---

## 8. 비변경 영역 (YAGNI)

- 백엔드 API: 도착 응답 스키마(`route_no`, `category`, `crowded`, `arrive_in_seconds`, `stats`, `is_tomorrow`, `arrival_type`, `depart_at`) 변경 없음.
- 통계 분포 바(`ArrivalDistributionBar`)는 시안에 포함하지 않음. 기존 위치는 카드에서 빼고 상세 시트(`StatsSheet` / `ScheduleDetailModal`)로만 이전 — 카드를 가볍게 유지.
- 즐겨찾기 별 버튼: 기존 우상단 위치(`absolute top-1.5 right-1.5`) 유지.
- 카드 클릭 → 기존 `onTimetableClick` 핸들러 그대로.

---

## 9. 테스트 전략

1. **BusArrivalCard 단위 테스트**:
   - 실시간 정상: chip 텍스트, from-line "시화터미널 에서 출발", head "신도림행", 트랙 라벨 3개, ETA `24`
   - 임박: `imminent` 클래스 / halo 클래스 적용
   - 시간표 기반: sched `19:50` 표시
   - 정보 없음: `—` 표시, 트랙 회색
   - 4점 트랙: 라벨 4개 렌더
2. **ArrivalList 단위 테스트**:
   - 같은 등교/하교 안에서 express → trunk → local 순으로 카테고리 헤더 생성
   - 각 헤더 카운트 정확
3. **시각 회귀** — 없음(스냅샷 미사용). 수동 QA: `npm run dev`로 `/schedule` → 버스 탭 → 하교/등교/기타 각각 확인.

---

## 10. 마이그레이션

- 한 PR(또는 단일 머지)로 처리. 기존 `BusArrivalCard` 사용자(주로 `ArrivalList`만 직접 사용)가 적어 단순.
- 다른 컴포넌트(`BusPanel`, `MapView`)는 `getRouteCardDisplay`만 호출하므로 호환 유지(섹션 5.2 파생화).
- DB·백엔드 변경 없음 → 단일 frontend 변경 PR.

---

## 11. 비목표 / 후속 작업

- 정류장(허브)별 출발 그룹화 보기 (탭): 후속.
- 카테고리 필터 토글 ("광역만 보기"): 후속.
- 마커 시트(MarkerSheet) 동일 적용: 본 PR에서는 `ArrivalList` 사용처만. 필요 시 후속 PR로.
- `ROUTE_WAYPOINTS`(기존 stop_pk 기반 진행도) → `ROUTE_PATH`로 일원화: 후속 (현재 RouteProgressStrip 사용처는 살아 있으나 다른 데이터 소스).
