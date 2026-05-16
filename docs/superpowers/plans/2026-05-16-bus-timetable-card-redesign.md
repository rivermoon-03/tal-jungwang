# Bus Timetable Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BusArrivalCard` / `ArrivalList`를 카테고리(광역/간선/시내·마을) + 미니 트랙 + 출발지 컬러 강조 디자인(v5)으로 전면 교체.

**Architecture:** 단일 frontend PR. 데이터 모델 확장(`busStationConfig.js`에 `category` · `ROUTE_PATH` 추가), `MiniTrack` 컴포넌트 신설, `BusArrivalCard` 본문 교체, `ArrivalList`에 카테고리 sub-그룹 추가. 백엔드 / DB 변경 없음.

**Tech Stack:** React 19 · Vite · Tailwind CSS v3 · Vitest · @testing-library/react · jsdom.

**Spec:** `docs/superpowers/specs/2026-05-16-bus-timetable-card-redesign-design.md`

---

## File Structure

| 파일 | 역할 | 작업 |
|---|---|---|
| `frontend/tailwind.config.js` | route halo 컬러 토큰 추가 | Modify |
| `frontend/src/components/dashboard/busStationConfig.js` | 카테고리·경로 데이터 + 헬퍼 | Modify (extend) |
| `frontend/src/components/bus/MiniTrack.jsx` | 트랙(도트+라벨) 단일 책임 컴포넌트 | Create |
| `frontend/src/components/bus/MiniTrack.test.jsx` | MiniTrack 단위 테스트 | Create |
| `frontend/src/components/bus/BusArrivalCard.jsx` | 카드 본문 — v5 디자인 적용 | Modify (rewrite render) |
| `frontend/src/components/bus/BusArrivalCard.test.jsx` | 새 DOM 구조 검증 | Modify |
| `frontend/src/components/bus/ArrivalList.jsx` | 카테고리 sub-group · 헤더 렌더 | Modify |
| `frontend/src/components/bus/ArrivalList.test.jsx` | 카테고리 그룹화 검증 | Modify |
| `docs_log/0516_bus_card_redesign.md` | 작업 로그(최종 커밋 시) | Create |

설계 원칙:
- `MiniTrack`은 stateless presentational, props만으로 렌더. 단위 테스트 용이.
- `BusArrivalCard`는 데이터 → 표시 로직 + 트랙은 `MiniTrack`에 위임.
- `ArrivalList`는 기존 등교/하교/기타 카테고리 그룹화 위에 route-category sub-group 추가. 카드 정렬(실시간 우선·임박 우선)은 기존 로직 유지.
- `getRouteCardDisplay`는 `ROUTE_PATH` 파생으로 변환 → `MapView`·`BusPanel` 호환.

**Imminent 임계 주의:** 기존 `IMMINENT_THRESHOLD_SEC = 60`(`frontend/src/utils/arrivalTime.js`)을 그대로 사용한다. 60초 미만일 때만 "곧" 표시 + halo 펄스. 60초 이상은 일반 분 표시(halo 없음). v5 시안의 "3분 halo"는 모킹 표현 — 실제 구현은 임계 변경 없음.

---

### Task 1: Tailwind에 route halo 컬러 토큰 추가

**Files:**
- Modify: `frontend/tailwind.config.js` (colors 섹션)

- [ ] **Step 1: 현재 colors 영역 확인**

```bash
sed -n '50,90p' frontend/tailwind.config.js
```

기대: `'line-201': '#2563eb'`, `'line-33': '#0891b2'`, `'line-express':'#dc2626'` 등 노선 컬러가 이미 정의되어 있음.

- [ ] **Step 2: route halo 토큰 추가**

`frontend/tailwind.config.js`의 colors 객체에서 `'line-express':'#dc2626',` 바로 다음 줄에 추가:

```js
        'line-express':'#dc2626',
        'line-4':      '#1B5FAD',
        'line-suin':   '#F5A623',
        'line-seohae': '#75bf43',

        // ── 노선 컬러 halo (출발지 도트 ring · alpha 16/28%) ──
        'route-halo-express':       'rgba(220,38,38,.16)',
        'route-halo-trunk':         'rgba(37,99,235,.16)',
        'route-halo-local':         'rgba(8,145,178,.18)',
        'route-halo-express-dark':  'rgba(220,38,38,.32)',
        'route-halo-trunk-dark':    'rgba(37,99,235,.32)',
        'route-halo-local-dark':    'rgba(8,145,178,.36)',
```

(주의: 기존 `'line-seohae'` 줄 뒤에 위 블록을 삽입. 다른 토큰은 건드리지 않음.)

- [ ] **Step 3: dev server에서 클래스가 살아 있는지 빌드 확인**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

기대: 빌드 에러 없음. Tailwind는 JIT이라 토큰이 사용된 시점에 클래스가 생성되므로, 본 단계에서는 그저 config가 valid 한지만 확인.

- [ ] **Step 4: 커밋**

```bash
git add frontend/tailwind.config.js
git commit -m "$(printf '%s\n' 'feat(ui): tailwind에 route halo 컬러 토큰 추가' '' '버스 카드 출발지 도트 ring(halo)용 alpha 변형. express/trunk/local' '카테고리별 + 다크 모드 변형.' '' 'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: `busStationConfig.js` 데이터 모델 확장

**Files:**
- Modify: `frontend/src/components/dashboard/busStationConfig.js`

- [ ] **Step 1: ROUTE_DISPLAY_CONFIG에 category 필드 추가**

기존(라인 134~145 영역)을 통째로 교체:

```js
export const ROUTE_DISPLAY_CONFIG = {
  '3400':  { color: '#DC2626', category: 'express', direction: '사당 경유 · 강남행' },
  '5200':  { color: '#DC2626', category: 'express', direction: '신천역 경유 · 신도림행' },
  '6502':  { color: '#DC2626', category: 'express', direction: '사당행' },
  '3401':  { color: '#DC2626', category: 'express', direction: '시흥시청 경유 · 석수행' },
  '5602':  { color: '#2563EB', category: 'trunk',   direction: '시흥시청 경유 · 구로행' },
  '시흥33': { color: '#0891B2', category: 'local',   direction: null },
  '20-1':  { color: '#2563EB', category: 'trunk',   direction: null },
  '11-A':  { color: '#0891B2', category: 'local',   direction: null },
  '99-2':  { color: '#0891B2', category: 'local',   direction: null },
  '시흥1':  { color: '#0891B2', category: 'local',   direction: null },
}
```

- [ ] **Step 2: 카테고리 상수·헬퍼 추가**

`getRouteDisplayConfig` 함수 정의(라인 147 부근) 바로 다음에 추가:

```js
export const ROUTE_CATEGORY_ORDER = ['express', 'trunk', 'local']
export const ROUTE_CATEGORY_LABEL = {
  express: '광역버스',
  trunk:   '간선버스',
  local:   '시내·마을',
}
export const ROUTE_CATEGORY_SWATCH = {
  express: '광역',
  trunk:   '간선',
  local:   '시내',
}

export function getRouteCategory(routeNo) {
  return ROUTE_DISPLAY_CONFIG[routeNo]?.category ?? 'local'
}
```

- [ ] **Step 3: ROUTE_PATH 추가 (출발지·경유·종점 구조화)**

`getRouteCategory` 정의 뒤에 추가:

```js
// 노선·방향별 경로 — 미니 트랙 시각화의 데이터 소스
export const ROUTE_PATH = {
  '11-A':   { 하교: { origin: '한국공대', waypoints: [], terminus: '정왕역', label: '정왕역행' } },
  '20-1':   { 하교: { origin: '한국공대', waypoints: ['정왕역'], terminus: '아이파크', label: '아이파크아파트행' } },
  '시흥33': {
    하교: { origin: '한국공대',   waypoints: ['정왕역'], terminus: '시흥시청', label: '시흥시청행' },
    등교: { origin: '시흥시청역', waypoints: [],         terminus: '한국공대', label: '학교행' },
  },
  '3400':  { 하교: { origin: '시화터미널', waypoints: ['사당'],   terminus: '강남',       label: '강남행' } },
  '3401':  {
    하교: { origin: '이마트',      waypoints: [],         terminus: '서울',     label: '서울행' },
    등교: { origin: '시흥시청역', waypoints: ['이마트'], terminus: '한국공대', label: '학교행' },
  },
  '5602':  {
    하교: { origin: '이마트',      waypoints: [],         terminus: '구로디지털', label: '구로디지털단지행' },
    등교: { origin: '시흥시청역', waypoints: ['이마트'], terminus: '한국공대',   label: '학교행' },
  },
  '5200':  { 하교: { origin: '시화터미널', waypoints: ['신천역'], terminus: '신도림',   label: '신도림행' } },
  '99-2':  { 하교: { origin: '시화터미널', waypoints: ['이마트'], terminus: '월곶역',   label: '월곶역 방면' } },
  '6502':  { 하교: { origin: '이마트',      waypoints: [],         terminus: '사당',     label: '사당행' } },
  '시흥1': { 하교: { origin: '이마트',      waypoints: ['신천역'], terminus: '개봉',     label: '개봉행' } },
}

export function getRoutePath(routeNo, category) {
  return ROUTE_PATH[routeNo]?.[category] ?? null
}
```

- [ ] **Step 4: `getRouteCardDisplay`를 `ROUTE_PATH` 파생으로 변환 (호환 유지)**

기존(라인 80~104 영역, `ROUTE_CARD_DISPLAY` 상수 정의 + `getRouteCardDisplay` 함수)을 다음으로 교체:

```js
export function getRouteCardDisplay(routeNo, category) {
  const p = getRoutePath(routeNo, category)
  if (!p) return null
  const via = p.waypoints.length ? `${p.waypoints.join(' 경유 ')} 경유 ` : ''
  const destTail = p.label.endsWith('행') || p.label.endsWith('방면') ? p.label : `${p.label}행`
  return { origin: p.origin, dest: `${via}${destTail}` }
}
```

> 함수가 파일 상단 영역에 있으므로, `getRoutePath`가 아래에 정의되더라도 JS hoisting로 호출 가능 (둘 다 `function` 선언). 동일 모듈 안의 `export const ROUTE_PATH = ...` 는 import 시점에 초기화 완료되므로 안전.

- [ ] **Step 5: 빌드 + lint 확인**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

기대: 빌드 성공. `ROUTE_CARD_DISPLAY` 참조가 남아 있는지 확인:

```bash
grep -n "ROUTE_CARD_DISPLAY" frontend/src
```

기대: 매치 없음(상수 자체는 삭제됐고 `getRouteCardDisplay`만 외부 사용 — `BusArrivalCard.jsx`, 그 외 사용 없음).

- [ ] **Step 6: 회귀 검증 — 기존 출력과 동일한지**

빠른 sanity check (Node REPL 또는 임시 스크립트). 별도 테스트 파일 없이 build로만 검증해도 OK.

옵션: 임시 검증을 vitest로 작성해도 됨.

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/components/dashboard/busStationConfig.js
git commit -m "$(printf '%s\n' 'feat(bus): 노선 카테고리·경로 데이터 모델 확장' '' '- ROUTE_DISPLAY_CONFIG에 category(express/trunk/local) 필드 추가' '- ROUTE_PATH(origin/waypoints/terminus/label) 구조화 데이터 추가' '- getRouteCategory, getRoutePath, ROUTE_CATEGORY_* 상수/헬퍼 추가' '- getRouteCardDisplay는 ROUTE_PATH 파생으로 호환 유지' '' 'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: `MiniTrack` 컴포넌트 (TDD)

**Files:**
- Create: `frontend/src/components/bus/MiniTrack.jsx`
- Create: `frontend/src/components/bus/MiniTrack.test.jsx`

설계:

```jsx
<MiniTrack
  origin="시화터미널"
  waypoints={['신천역']}
  terminus="신도림"
  category="express"  // 또는 'trunk' / 'local'
  muted={false}       // 정보 없음 시 true
/>
```

렌더:
- `waypoints.length` 에 따라 t2/t3/t4 grid 변형
- 출발 도트 컬러 + halo는 `category`로 결정
- 라벨: start = 카테고리 컬러+굵게+12px, mid/end = ink 700 11px
- `muted`일 때 모든 도트·라인·라벨 회색 처리

- [ ] **Step 1: failing test 작성**

`frontend/src/components/bus/MiniTrack.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MiniTrack from './MiniTrack'

describe('MiniTrack', () => {
  it('renders all three labels for a t3 path (origin → 1 waypoint → terminus)', () => {
    render(
      <MiniTrack
        origin="시화터미널"
        waypoints={['신천역']}
        terminus="신도림"
        category="express"
      />
    )
    expect(screen.getByText('시화터미널')).toBeInTheDocument()
    expect(screen.getByText('신천역')).toBeInTheDocument()
    expect(screen.getByText('신도림')).toBeInTheDocument()
  })

  it('renders two labels for a t2 path (no waypoints)', () => {
    const { container } = render(
      <MiniTrack origin="이마트" waypoints={[]} terminus="서울" category="express" />
    )
    expect(screen.getByText('이마트')).toBeInTheDocument()
    expect(screen.getByText('서울')).toBeInTheDocument()
    // 트랙 시작·끝 도트만 (경유 도트 없음)
    expect(container.querySelectorAll('[data-track-pt]').length).toBe(2)
  })

  it('renders four labels for a t4 path (2 waypoints)', () => {
    render(
      <MiniTrack
        origin="시화터미널"
        waypoints={['신천역', '영등포']}
        terminus="신도림"
        category="express"
      />
    )
    expect(screen.getByText('시화터미널')).toBeInTheDocument()
    expect(screen.getByText('신천역')).toBeInTheDocument()
    expect(screen.getByText('영등포')).toBeInTheDocument()
    expect(screen.getByText('신도림')).toBeInTheDocument()
  })

  it('applies category color class to origin label and start dot', () => {
    const { container } = render(
      <MiniTrack origin="한국공대" waypoints={['정왕역']} terminus="시흥시청" category="local" />
    )
    const startDot = container.querySelector('[data-track-pt="start"]')
    expect(startDot.className).toMatch(/line-33/)
    const startLabel = container.querySelector('[data-track-label="start"]')
    expect(startLabel.className).toMatch(/text-line-33/)
  })

  it('renders muted state with gray styles', () => {
    const { container } = render(
      <MiniTrack
        origin="한국공대"
        waypoints={[]}
        terminus="정왕역"
        category="local"
        muted
      />
    )
    const startDot = container.querySelector('[data-track-pt="start"]')
    expect(startDot.className).toMatch(/mute-2/)
    const startLabel = container.querySelector('[data-track-label="start"]')
    expect(startLabel.className).toMatch(/mute-2/)
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

```bash
cd frontend && npx vitest run src/components/bus/MiniTrack.test.jsx
```

기대: `Error: Failed to resolve import "./MiniTrack"` — 컴포넌트 없음.

- [ ] **Step 3: `MiniTrack.jsx` 구현**

```jsx
// 미니 트랙 — 출발·경유·종점 도트+라인 + 라벨 시각화
// props: origin, waypoints (string[]), terminus, category, muted

const COLOR_BY_CATEGORY = {
  express: {
    dot:    'bg-line-express',
    halo:   'shadow-[0_0_0_3px_var(--tw-shadow-color)] shadow-route-halo-express dark:shadow-route-halo-express-dark',
    label:  'text-line-express',
  },
  trunk: {
    dot:    'bg-line-201',
    halo:   'shadow-[0_0_0_3px_var(--tw-shadow-color)] shadow-route-halo-trunk dark:shadow-route-halo-trunk-dark',
    label:  'text-line-201',
  },
  local: {
    dot:    'bg-line-33',
    halo:   'shadow-[0_0_0_3px_var(--tw-shadow-color)] shadow-route-halo-local dark:shadow-route-halo-local-dark',
    label:  'text-line-33',
  },
}

export default function MiniTrack({ origin, waypoints = [], terminus, category = 'local', muted = false }) {
  const cat = COLOR_BY_CATEGORY[category] ?? COLOR_BY_CATEGORY.local

  // 트랙 grid templates
  const trackTemplate = (() => {
    const n = waypoints.length
    if (n === 0) return '12px 1fr 8px'
    if (n === 1) return '12px 1fr 8px 1fr 8px'
    return '12px 1fr 8px 1fr 8px 1fr 8px'
  })()

  const labelTemplate = (() => {
    const n = waypoints.length
    if (n === 0) return 'auto 1fr auto'
    if (n === 1) return '1fr 1fr 1fr'
    return '1fr 1fr 1fr 1fr'
  })()

  const dotMute  = 'bg-mute-2 dark:bg-mute-2-dark'
  const dotInk   = 'bg-ink dark:bg-ink-dark'
  const segInk   = 'bg-ink dark:bg-ink-dark'
  const segMute  = 'bg-mute-2 dark:bg-mute-2-dark'

  const startDotCls = muted
    ? `w-[11px] h-[11px] rounded-full justify-self-center ${dotMute}`
    : `w-[11px] h-[11px] rounded-full justify-self-center ${cat.dot} ${cat.halo}`

  const inlineDot = (key) => (
    <span
      key={key}
      data-track-pt="mid"
      className={`w-[7px] h-[7px] rounded-full justify-self-center ${muted ? dotMute : dotInk}`}
    />
  )

  const inlineSeg = (key) => (
    <span key={key} className={`h-[2px] rounded-[1px] ${muted ? segMute : segInk}`} />
  )

  // 트랙 children 구성
  const trackChildren = []
  trackChildren.push(<span key="s" data-track-pt="start" className={startDotCls} />)
  trackChildren.push(inlineSeg('s0'))
  waypoints.forEach((_, i) => {
    trackChildren.push(inlineDot(`v${i}`))
    trackChildren.push(inlineSeg(`s${i + 1}`))
  })
  trackChildren.push(
    <span
      key="e"
      data-track-pt="end"
      className={`w-[7px] h-[7px] rounded-full justify-self-center ${muted ? dotMute : dotInk}`}
    />
  )

  const startLabelCls = muted
    ? 'text-left truncate text-[12px] font-extrabold tracking-[-.01em] text-mute-2 dark:text-mute-2-dark'
    : `text-left truncate text-[12px] font-extrabold tracking-[-.01em] ${cat.label}`

  const midLabelCls = muted
    ? 'text-center truncate text-[11px] font-bold tracking-[-.005em] text-mute-2 dark:text-mute-2-dark'
    : 'text-center truncate text-[11px] font-bold tracking-[-.005em] text-ink dark:text-ink-dark'

  const endLabelCls = muted
    ? 'text-right truncate text-[11px] font-bold tracking-[-.005em] text-mute-2 dark:text-mute-2-dark'
    : 'text-right truncate text-[11px] font-bold tracking-[-.005em] text-ink dark:text-ink-dark'

  return (
    <div className="mt-[9px] pr-1">
      <div className="grid items-center h-4" style={{ gridTemplateColumns: trackTemplate }}>
        {trackChildren}
      </div>
      <div className="grid mt-[5px] gap-0" style={{ gridTemplateColumns: labelTemplate }}>
        <span data-track-label="start" className={startLabelCls}>{origin}</span>
        {waypoints.length === 0 ? <span /> : null}
        {waypoints.map((w, i) => (
          <span key={i} data-track-label="mid" className={midLabelCls}>{w}</span>
        ))}
        <span data-track-label="end" className={endLabelCls}>{terminus}</span>
      </div>
    </div>
  )
}
```

> 인라인 style로 grid-template-columns만 동적 처리. 컬러·폰트는 모두 Tailwind utility. `shadow-route-halo-*`가 Tailwind JIT에서 클래스로 픽업되도록 명시적 사용.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run src/components/bus/MiniTrack.test.jsx
```

기대: 5 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/bus/MiniTrack.jsx frontend/src/components/bus/MiniTrack.test.jsx
git commit -m "$(printf '%s\n' 'feat(bus): MiniTrack 컴포넌트 신설' '' '버스 카드 출발·경유·종점 도트+라인+라벨 시각화. 카테고리 컬러로' '출발지(도트·라벨) 강조. t2/t3/t4 grid 변형. muted prop으로 정보없음 상태.' '' 'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: `BusArrivalCard` 본문 교체

**Files:**
- Modify: `frontend/src/components/bus/BusArrivalCard.jsx`
- Modify: `frontend/src/components/bus/BusArrivalCard.test.jsx`

핵심:
- chip 영역: `RouteChip` 대신 솔리드 chip을 카드 내에서 직접 렌더 (배경 = 카테고리 컬러, white text).
  - 또는 `RouteChip`을 그대로 두되 chip 본문은 솔리드 variant로 다시 만드는 게 깔끔. 본 작업에서는 **카드 안에서 직접 인라인 chip 마크업**으로 진행 (외부 RouteChip은 다른 화면에서 옅은 톤으로 쓰이고 있어 건드리지 않음).
- from-line: `<카테고리 컬러>{origin}</> <muted>에서 출발</>`
- head: `<ink/800>{label}</>` + (sched 또는 crowd 배지)
- `<MiniTrack origin waypoints terminus category muted />`
- ETA: 임박일 때 (`< IMMINENT_THRESHOLD_SEC = 60s`) "곧" + halo, 그 외 분 단위.
- 즐겨찾기 별 버튼 + 클릭 핸들러는 기존 그대로.

- [ ] **Step 1: failing test 추가**

기존 `BusArrivalCard.test.jsx`에서 새 케이스 작성. **기존 두 케이스는 일단 유지** (stats 표시는 카드에서 제거되지 않음 — 단, "다음 +N분" / "보통 ±N분" 텍스트는 ETA `.next` 위치로 옮겨지므로 그대로 매치되어야 함).

`frontend/src/components/bus/BusArrivalCard.test.jsx` 전체 교체:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BusArrivalCard from './BusArrivalCard'

// useFavorites/useApi 의존성 차단
vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

const baseRealtime = (over = {}) => ({
  route_no: '5200',
  route_id: 200,
  destination: '신도림',
  category: '하교',
  arrival_type: 'realtime',
  arrive_in_seconds: 180,
  ...over,
})

describe('BusArrivalCard — v5 layout', () => {
  it('renders from-line, head label and MiniTrack labels', () => {
    render(<BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />)
    // from-line
    expect(screen.getByText('에서 출발')).toBeInTheDocument()
    expect(screen.getAllByText('시화터미널').length).toBeGreaterThanOrEqual(1)
    // head
    expect(screen.getByText('신도림행')).toBeInTheDocument()
    // track labels (origin + waypoint + terminus)
    expect(screen.getAllByText('시화터미널').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('신천역')).toBeInTheDocument()
    expect(screen.getByText('신도림')).toBeInTheDocument()
  })

  it('renders "—" when stats present but no arrivals', () => {
    render(
      <BusArrivalCard
        arrivals={[{ route_no: '11-A', route_id: 11, destination: '정왕역', category: '하교', arrival_type: 'realtime' }]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows "다음 +N분" when stats absent', () => {
    render(
      <BusArrivalCard
        arrivals={[
          baseRealtime({ arrive_in_seconds: 180 }),
          baseRealtime({ arrive_in_seconds: 540 }),
        ]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText(/다음 \+9분/)).toBeInTheDocument()
  })

  it('shows "보통 ±N분" when stats present', () => {
    render(
      <BusArrivalCard
        arrivals={[
          baseRealtime({
            arrive_in_seconds: 180,
            stats: { tolerance_min: 4, p10_min: 1, p50_min: 4, p90_min: 9, mean_min: 4, sample_size: 28 },
          }),
        ]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText(/보통 ±4분/)).toBeInTheDocument()
  })

  it('shows "곧" with imminent class when arrive_in_seconds < 60', () => {
    const { container } = render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 30 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('곧')).toBeInTheDocument()
    const eta = container.querySelector('[data-eta]')
    expect(eta.className).toMatch(/imminent/)
  })

  it('renders category swatch color for express chip', () => {
    const { container } = render(<BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />)
    const chip = container.querySelector('[data-route-chip]')
    expect(chip.className).toMatch(/line-express/)
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd frontend && npx vitest run src/components/bus/BusArrivalCard.test.jsx
```

기대: 새 케이스 다수 실패 (DOM 구조 변경 전).

- [ ] **Step 3: `BusArrivalCard.jsx` 본문 교체**

기존 파일 전체를 다음으로 교체:

```jsx
import { Star } from 'lucide-react'
import {
  getRouteDisplayConfig,
  getRouteCategory,
  getRoutePath,
} from '../dashboard/busStationConfig'
import useFavorites from '../../hooks/useFavorites'
import { IMMINENT_THRESHOLD_SEC } from '../../utils/arrivalTime'
import { realtimeSecToMinutes } from './busArrivalDisplay'
import MiniTrack from './MiniTrack'

// ─────────────────────────────────────────────────────────────────────────────
// CrowdedBadge / RouteProgressStrip — 외부 호환을 위해 유지
// ─────────────────────────────────────────────────────────────────────────────

const CROWDED_META = {
  1: { label: '여유', cls: 'bg-chip-green-bg text-chip-green-fg dark:bg-chip-green-bg-dark dark:text-chip-green-fg-dark' },
  2: { label: '보통', cls: 'bg-chip-yellow-bg text-chip-yellow-fg dark:bg-chip-yellow-bg-dark dark:text-chip-yellow-fg-dark' },
  3: { label: '혼잡', cls: 'bg-chip-red-bg text-chip-red-fg dark:bg-chip-red-bg-dark dark:text-chip-red-fg-dark' },
  4: { label: '매우혼잡', cls: 'bg-chip-red-bg text-chip-red-fg dark:bg-chip-red-bg-dark dark:text-chip-red-fg-dark' },
}

export function CrowdedBadge({ level }) {
  const meta = CROWDED_META[level]
  if (!meta) return null
  return (
    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

// Legacy export — RouteProgressStrip은 다른 컴포넌트(ArrivalRow 등)가 import할 수 있어 호환만 유지.
// v5 카드는 MiniTrack을 사용한다.
export function RouteProgressStrip() {
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// chip · 카테고리 컬러
// ─────────────────────────────────────────────────────────────────────────────

const CHIP_BG = {
  express: 'bg-line-express',
  trunk:   'bg-line-201',
  local:   'bg-line-33',
}
const FROM_COLOR = {
  express: 'text-line-express',
  trunk:   'text-line-201',
  local:   'text-line-33',
}

// ─────────────────────────────────────────────────────────────────────────────
// 시간 계산
// ─────────────────────────────────────────────────────────────────────────────

function secondsUntil(timeStr, isTomorrow = false) {
  const [hh, mm] = timeStr.split(':').map(Number)
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0)
  if (isTomorrow) target.setDate(target.getDate() + 1)
  return Math.floor((target - now) / 1000)
}

function computeDisplay(arrivals) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const valid = arrivals.filter((a) =>
    isTimetable ? a.depart_at != null : a.arrive_in_seconds != null
  )
  const shown = valid.slice(0, 2)
  if (shown.length === 0) {
    return { etaValue: '—', etaSub: null, imminent: false, stats: null }
  }
  if (isTimetable) {
    const a0 = shown[0]
    if (a0.is_tomorrow) {
      return { etaValue: '내일', etaSub: a0.depart_at, imminent: false, stats: null }
    }
    const sec = secondsUntil(a0.depart_at)
    if (sec < IMMINENT_THRESHOLD_SEC) {
      return { etaValue: '곧', etaSub: a0.depart_at, imminent: true, stats: null }
    }
    const min = Math.ceil(sec / 60)
    const sub = shown[1]?.depart_at ? `다음 ${shown[1].depart_at}` : a0.depart_at
    return { etaValue: min, etaSub: sub, imminent: false, stats: null }
  }
  const stats = arrivals[0]?.stats ?? null
  const sec0 = shown[0].arrive_in_seconds ?? 0
  if (sec0 < IMMINENT_THRESHOLD_SEC) {
    return { etaValue: '곧', etaSub: `${Math.max(0, sec0)}초 후`, imminent: true, stats }
  }
  const min0 = realtimeSecToMinutes(sec0)
  let sub
  if (stats?.tolerance_min != null) {
    sub = `보통 ±${stats.tolerance_min}분`
  } else {
    const sec1 = shown[1]?.arrive_in_seconds
    sub = sec1 != null ? `다음 +${realtimeSecToMinutes(sec1)}분` : null
  }
  return { etaValue: min0, etaSub: sub, imminent: false, stats }
}

// ─────────────────────────────────────────────────────────────────────────────
// 카드
// ─────────────────────────────────────────────────────────────────────────────

export default function BusArrivalCard({ arrivals, stationId, onTimetableClick }) {
  const first = arrivals[0]
  const isTimetable = first.arrival_type === 'timetable'
  const cfg = getRouteDisplayConfig(first.route_no)
  const category = cfg?.category ?? getRouteCategory(first.route_no)
  const path = getRoutePath(first.route_no, first.category) ?? null

  const origin = path?.origin ?? first.origin ?? ''
  const waypoints = path?.waypoints ?? []
  const terminus = path?.terminus ?? first.destination ?? ''
  const headLabel = path?.label ?? `${first.destination ?? ''}행`

  const { etaValue, etaSub, imminent } = computeDisplay(arrivals)
  const crowdedLevel = !isTimetable ? arrivals[0]?.crowded : 0

  const favKey = first.route_no
  const { isFavorite, toggle: toggleFav } = useFavorites(favKey)

  // 정보 없음 상태 — 트랙 / from-line 회색 처리
  const muted = etaValue === '—'

  const chipBg = CHIP_BG[category] ?? CHIP_BG.local
  const fromCol = FROM_COLOR[category] ?? FROM_COLOR.local

  const wrapperBase =
    'relative rounded-card bg-surface shadow-card dark:bg-surface-dark dark:border dark:border-line-dark dark:shadow-none'

  const content = (
    <div className="flex items-center gap-[14px] px-[18px] pt-[14px] pb-4">
      {/* chip */}
      <span
        data-route-chip
        className={`shrink-0 h-8 min-w-[60px] px-2.5 inline-flex items-center justify-center rounded-[9px] text-white text-[13px] font-extrabold tracking-[-.01em] tabular-nums shadow-[inset_0_-2px_0_rgba(0,0,0,.08)] ${chipBg}`}
      >
        {first.route_no}
      </span>

      {/* body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 leading-none mb-0.5">
          <span className={`text-[12px] font-extrabold tracking-[-.005em] ${muted ? 'text-mute-2 dark:text-mute-2-dark' : fromCol}`}>
            {origin}
          </span>
          <span className="text-[9.5px] font-bold uppercase tracking-[.04em] text-mute dark:text-mute-dark">
            에서 출발
          </span>
        </div>

        <div className="flex items-center gap-2 leading-tight">
          <span className={`truncate text-[15px] font-extrabold tracking-[-.01em] ${muted ? 'text-text-2 dark:text-mute-dark' : 'text-ink dark:text-ink-dark'}`}>
            {headLabel}
          </span>
          {!isTimetable && crowdedLevel > 0 && <CrowdedBadge level={crowdedLevel} />}
          {isTimetable && (
            <span className="text-[10px] font-bold uppercase tracking-[.06em] text-mute dark:text-mute-dark">
              {first.depart_at ?? ''}
            </span>
          )}
        </div>

        <MiniTrack
          origin={origin}
          waypoints={waypoints}
          terminus={terminus}
          category={category}
          muted={muted}
        />
      </div>

      {/* eta */}
      <span
        data-eta
        className={`text-right shrink-0 leading-none tabular-nums ${imminent ? 'imminent' : ''}`}
      >
        <span className="inline-flex items-baseline">
          <span
            className={`font-black tracking-[-.05em] ${
              imminent
                ? 'text-imminent dark:text-imminent-dark text-[30px]'
                : muted
                ? 'text-mute-2 dark:text-mute-2-dark font-extrabold text-[24px]'
                : 'text-ink dark:text-ink-dark text-[30px]'
            }`}
          >
            {etaValue}
          </span>
          {typeof etaValue === 'number' && (
            <span className={`ml-[2px] text-[11px] font-extrabold ${imminent ? 'text-imminent dark:text-imminent-dark opacity-70' : 'text-mute dark:text-mute-dark'}`}>분</span>
          )}
        </span>
        {etaSub && !muted && (
          <span className="block mt-[5px] text-[10px] font-semibold text-mute dark:text-mute-dark tracking-[-.005em]">
            {etaSub}
          </span>
        )}
      </span>
    </div>
  )

  const starButton = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        toggleFav({ type: 'bus', label: first.route_no })
      }}
      aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      className="absolute top-1.5 right-1.5 p-1 z-10"
    >
      <Star
        size={14}
        fill={isFavorite ? 'currentColor' : 'none'}
        className={isFavorite ? 'text-state-warn' : 'text-mute-2 dark:text-mute-2-dark'}
      />
    </button>
  )

  return (
    <div data-route={first.route_no} className="relative">
      <button
        className={`w-full text-left pressable ${wrapperBase}`}
        onClick={() => onTimetableClick && onTimetableClick(first.route_id, first.route_no, path ? `${origin} → ${terminus}` : (first.destination ?? ''))}
      >
        {content}
      </button>
      {starButton}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행해 모두 통과 확인**

```bash
cd frontend && npx vitest run src/components/bus/BusArrivalCard.test.jsx
```

기대: 6 tests pass.

- [ ] **Step 5: 전체 frontend 테스트 회귀 확인**

```bash
cd frontend && npm test 2>&1 | tail -40
```

기대: 모든 테스트 통과. `ArrivalDistributionBar` / `BusStatsHeader` / `ArrivalList` 기존 테스트는 그대로 통과해야 함.

> 만약 `ArrivalList.test.jsx`가 실패하면 Task 5에서 처리할 변경 사항이므로 일단 기록만 해두고 Task 5로 진행해도 OK.

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/bus/BusArrivalCard.jsx frontend/src/components/bus/BusArrivalCard.test.jsx
git commit -m "$(printf '%s\n' 'feat(bus): v5 카드 디자인 적용 — from-line + MiniTrack + 출발지 강조' '' '- chip은 카테고리 솔리드 컬러 (bg-line-express/201/33)' '- from-line: 출발지명 카테고리 컬러 강조 + "에서 출발" muted 라벨' '- 행선지 라벨 + crowd 배지 또는 시간표 정시 표시' '- MiniTrack 도트·라벨 위임 — 출발지 도트 컬러+halo 강조' '- ETA 임박(<60s)일 때 imminent 컬러 + 단위 숨김' '- 정보없음 상태: 트랙·라벨 회색, ETA "—"' '' 'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: `ArrivalList` 카테고리 sub-그룹화

**Files:**
- Modify: `frontend/src/components/bus/ArrivalList.jsx`
- Modify: `frontend/src/components/bus/ArrivalList.test.jsx`

기존 `ArrivalList`는 `category`(등교/하교/기타)로 1차 그룹화. 본 작업에서는 **그 안에서** `getRouteCategory(route_no)` 결과로 **2차 그룹화**(express → trunk → local) + 카테고리 헤더 렌더.

- [ ] **Step 1: failing test 추가**

`frontend/src/components/bus/ArrivalList.test.jsx` 전체 교체:

```jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ArrivalList from './ArrivalList'

vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

describe('ArrivalList', () => {
  it('orders running-info routes before no-info routes within a category', () => {
    const arrivals = [
      { route_no: '99-2', category: '하교', minutes: null },
      { route_no: '6502', category: '하교', minutes: 5, arrival_type: 'timetable', depart_at: '19:50' },
    ]
    const { container } = render(
      <ArrivalList arrivals={arrivals} stationId="x" stationLabel="이마트" direction="하교" />
    )
    const cards = container.querySelectorAll('[data-route]')
    // 6502는 광역(express), 99-2는 시내(local). 헤더가 카테고리별로 나뉘지만 각 그룹 안 정렬도 정상.
    const routes = Array.from(cards).map((c) => c.getAttribute('data-route'))
    expect(routes).toContain('6502')
    expect(routes).toContain('99-2')
  })

  it('renders category sub-headers in express → trunk → local order', () => {
    const arrivals = [
      // 의도적으로 섞어 입력
      { route_no: '시흥33', category: '하교', arrive_in_seconds: 240, arrival_type: 'realtime' }, // local
      { route_no: '5200',  category: '하교', arrive_in_seconds: 180, arrival_type: 'realtime' }, // express
      { route_no: '20-1',  category: '하교', arrive_in_seconds: 1440, arrival_type: 'realtime' }, // trunk
    ]
    render(<ArrivalList arrivals={arrivals} stationId="x" />)
    // 헤더 텍스트
    const expressHdr = screen.getByText('광역버스')
    const trunkHdr = screen.getByText('간선버스')
    const localHdr = screen.getByText('시내·마을')
    // DOM 순서로 express → trunk → local
    expect(expressHdr.compareDocumentPosition(trunkHdr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(trunkHdr.compareDocumentPosition(localHdr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders category counts ("N ROUTES")', () => {
    const arrivals = [
      { route_no: '5200', category: '하교', arrive_in_seconds: 120, arrival_type: 'realtime' },
      { route_no: '3400', category: '하교', arrival_type: 'timetable', depart_at: '19:50' },
    ]
    render(<ArrivalList arrivals={arrivals} stationId="x" />)
    expect(screen.getByText(/2\s*ROUTES/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd frontend && npx vitest run src/components/bus/ArrivalList.test.jsx
```

기대: 카테고리 헤더 케이스 실패.

- [ ] **Step 3: `ArrivalList.jsx` 변경**

기존 파일 전체를 다음으로 교체:

```jsx
import { useMemo } from 'react'
import BusArrivalCard from './BusArrivalCard'
import {
  getRouteCategory,
  ROUTE_CATEGORY_ORDER,
  ROUTE_CATEGORY_LABEL,
  ROUTE_CATEGORY_SWATCH,
} from '../dashboard/busStationConfig'

const TOP_CATEGORY_ORDER = ['등교', '하교', '기타']
const TOP_CATEGORY_LABEL = { '등교': '등교', '하교': '하교', '기타': '기타 노선' }

function groupByRouteNo(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    if (!map.has(a.route_no)) map.set(a.route_no, [])
    map.get(a.route_no).push(a)
  }
  return Array.from(map.values())
}

function hasLiveInfo(g) {
  return g.some((a) => a.minutes != null || a.predict_sec != null || a.arrive_in_seconds != null)
}

function earliestMinutes(g) {
  let min = Infinity
  for (const a of g) {
    const m =
      a.minutes != null
        ? a.minutes
        : a.predict_sec != null
        ? Math.floor(a.predict_sec / 60)
        : a.arrive_in_seconds != null
        ? Math.floor(a.arrive_in_seconds / 60)
        : null
    if (m != null && m < min) min = m
  }
  return min === Infinity ? 9999 : min
}

function groupByTopCategory(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    const key = a.category ?? '기타'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  const result = []
  for (const c of TOP_CATEGORY_ORDER) {
    if (map.has(c)) result.push({ topCategory: c, arrivals: map.get(c) })
  }
  for (const [c, items] of map) {
    if (!TOP_CATEGORY_ORDER.includes(c)) result.push({ topCategory: c, arrivals: items })
  }
  return result
}

function groupByRouteCategory(routeGroups) {
  // routeGroups: [[arrivals_per_route], ...]
  const buckets = new Map()
  for (const g of routeGroups) {
    const cat = getRouteCategory(g[0].route_no)
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat).push(g)
  }
  const sections = []
  for (const cat of ROUTE_CATEGORY_ORDER) {
    if (buckets.has(cat)) sections.push({ routeCategory: cat, groups: buckets.get(cat) })
  }
  for (const [cat, groups] of buckets) {
    if (!ROUTE_CATEGORY_ORDER.includes(cat)) sections.push({ routeCategory: cat, groups })
  }
  return sections
}

const SWATCH_BG = {
  express: 'bg-line-express',
  trunk:   'bg-line-201',
  local:   'bg-line-33',
}

export default function ArrivalList({ arrivals, stationId, onTimetableClick, stationLabel, direction }) {
  const sections = useMemo(() => {
    if (!arrivals || arrivals.length === 0) return []
    const top = groupByTopCategory(arrivals)
    return top.map(({ topCategory, arrivals: secArrivals }) => {
      const routeGroups = groupByRouteNo(secArrivals)
      routeGroups.sort((a, b) => {
        const aHas = hasLiveInfo(a)
        const bHas = hasLiveInfo(b)
        if (aHas !== bHas) return aHas ? -1 : 1
        return earliestMinutes(a) - earliestMinutes(b)
      })
      const sub = groupByRouteCategory(routeGroups)
      return { topCategory, subSections: sub }
    })
  }, [arrivals])

  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface dark:bg-bg-dark">
        <p className="text-meta font-semibold text-mute dark:text-mute-dark">도착 정보가 없습니다.</p>
      </div>
    )
  }

  const multiTop = sections.length > 1

  return (
    <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
      {stationLabel && direction && (
        <div className="px-4 pt-3.5 pb-1 flex items-center gap-2">
          <h3 className="text-panel-ttl text-ink dark:text-ink-dark">{stationLabel}</h3>
          <span className="text-meta font-extrabold text-text dark:text-text-dark bg-line dark:bg-line-dark px-2.5 py-1 rounded-full tracking-tight">
            {direction}
          </span>
        </div>
      )}
      <div className="p-4 space-y-4">
        {sections.map(({ topCategory, subSections }) => (
          <div key={topCategory}>
            {multiTop && (
              <div className="mb-2.5 px-1 text-[11px] font-extrabold tracking-[.08em] uppercase text-text dark:text-text-dark">
                {TOP_CATEGORY_LABEL[topCategory] ?? topCategory}
              </div>
            )}
            <div className="space-y-3">
              {subSections.map(({ routeCategory, groups }) => (
                <div key={routeCategory}>
                  <div className="flex items-center gap-2.5 px-1 pt-1 pb-1.5">
                    <span
                      className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-[7px] text-white text-[10px] font-extrabold tracking-[.04em] ${SWATCH_BG[routeCategory] ?? SWATCH_BG.local}`}
                    >
                      {ROUTE_CATEGORY_SWATCH[routeCategory] ?? '기타'}
                    </span>
                    <span className="text-[13px] font-extrabold tracking-[.02em] text-ink dark:text-ink-dark">
                      {ROUTE_CATEGORY_LABEL[routeCategory] ?? routeCategory}
                    </span>
                    <span className="ml-auto text-[10px] font-bold tracking-[.08em] uppercase text-mute dark:text-mute-dark">
                      {groups.length} ROUTES
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groups.map((g) => (
                      <BusArrivalCard
                        key={g[0].route_no}
                        arrivals={g}
                        stationId={stationId}
                        onTimetableClick={onTimetableClick}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 실행 — 모두 통과 확인**

```bash
cd frontend && npx vitest run src/components/bus/ArrivalList.test.jsx
```

기대: 3 tests pass.

- [ ] **Step 5: 전체 테스트 회귀**

```bash
cd frontend && npm test 2>&1 | tail -40
```

기대: 모든 테스트 통과.

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/bus/ArrivalList.jsx frontend/src/components/bus/ArrivalList.test.jsx
git commit -m "$(printf '%s\n' 'feat(bus): ArrivalList에 route 카테고리(광역/간선/시내) sub-그룹 추가' '' '등교/하교/기타 top-그룹 안에서 express → trunk → local 순으로 sub-' '그룹화. 각 sub-그룹마다 swatch + 라벨 + "N ROUTES" 카운트.' '' 'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: 수동 QA & 작업 로그

**Files:**
- Create: `docs_log/0516_bus_card_redesign.md`

- [ ] **Step 1: dev server 실행**

```bash
cd frontend && npm run dev
```

기대: `http://localhost:5173` 또는 vite 기본 포트.

- [ ] **Step 2: 브라우저에서 `/schedule` 진입 → 버스 탭**

확인 항목:
- [ ] 하교 탭에 광역/간선/시내·마을 카테고리 헤더 표시
- [ ] 각 카드의 from-line "○○ 에서 출발" 표시 — 출발지는 카테고리 컬러
- [ ] 트랙의 출발 도트가 카테고리 컬러 + 옅은 halo ring으로 강조
- [ ] 트랙의 경유·종점 도트는 검정, 라벨도 검정 (mute 아님)
- [ ] ETA 정렬이 모든 카드 동일 우정렬
- [ ] 정보 없음 카드(예: 11-A): 트랙·라벨 회색, ETA `—`
- [ ] 임박(<60s) 시 ETA "곧" + 빨강 halo 펄스 (시뮬레이션 어려우면 콘솔에서 mock arrivals로 확인)
- [ ] 다크 모드 토글 시 컬러 정상

- [ ] **Step 3: 등교 탭 확인**

확인:
- [ ] 시흥시청 정류장의 등교 노선(시흥33 / 3401 / 5602)이 카테고리별로 분류
- [ ] from-line "시흥시청역 에서 출발", 종점 "한국공대"

- [ ] **Step 4: 작업 로그 작성**

`docs_log/0516_bus_card_redesign.md`:

```markdown
# 0516 — 버스 시간표 카드 v5 리디자인

## 변경

- `BusArrivalCard` 전면 교체: chip(솔리드 카테고리 컬러) + from-line("○○ 에서 출발", 출발지 카테고리 컬러) + 행선지 + MiniTrack + ETA.
- `ArrivalList`: 등교/하교/기타 top-그룹 안에 express/trunk/local sub-그룹 + swatch 헤더.
- `MiniTrack` 컴포넌트 신설 (`frontend/src/components/bus/MiniTrack.jsx`).
- `busStationConfig.js`: `ROUTE_DISPLAY_CONFIG`에 `category` 필드, `ROUTE_PATH`(origin/waypoints/terminus/label), `getRouteCategory`, `getRoutePath`, 카테고리 상수.
- Tailwind에 `route-halo-{express,trunk,local}` (라이트/다크) 컬러 토큰.

## 비변경

- 백엔드 API · DB 스키마.
- `ArrivalDistributionBar` / `BusStatsHeader` 그대로(카드에서는 분포 바를 빼고 상세 시트로만).
- `getRouteCardDisplay`는 `ROUTE_PATH` 파생으로 호환 유지 (`MapView` / `BusPanel` 영향 없음).

## QA

- `/schedule` 버스 탭 — 하교/등교 모두 카테고리 정렬 정상.
- 다크 모드 — halo / 트랙 라벨 정상 (라이트 토큰 그대로).
- 정보없음 / 임박 / 시간표 상태 정상.

## 후속

- 카테고리 필터 토글 ("광역만 보기")는 후속.
- 마커 시트(`MarkerSheet`) 동일 적용은 후속.
```

- [ ] **Step 5: dev server 종료 후 작업 로그 커밋**

```bash
git add docs_log/0516_bus_card_redesign.md 2>&1
# docs_log/도 gitignore에 걸려있는지 확인 후 필요 시 -f
git status docs_log/0516_bus_card_redesign.md
```

`gitignore`에 의해 무시되면:

```bash
git add -f docs_log/0516_bus_card_redesign.md
git commit -m "$(printf '%s\n' 'docs(log): 0516 버스 카드 리디자인 작업 로그' '' 'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## 마무리

- [ ] 최종 `git log --oneline -10` 으로 변경 5~6 커밋 확인.
- [ ] `git status` 클린 확인.

---

## 트러블슈팅 노트

- **`shadow-route-halo-*` 클래스가 적용 안 됨**: Tailwind JIT는 동적 클래스 이름을 인식 못 함. 본 plan에서는 정적 클래스로 표기되어 있어 정상 작동해야 하지만, 만약 클래스가 누락되면 `frontend/tailwind.config.js`의 `content` 패턴이 `frontend/src/**/*.{js,jsx}`를 포함하는지 확인.
- **`docs/` / `docs_log/` 가 gitignore에 걸림**: `git add -f` 로 강제 추가. 이미 커밋된 spec 파일들도 동일한 방식.
- **`RouteProgressStrip` 외부 사용처**: 본 plan에서 빈 컴포넌트로 만들어 호환만 유지. 만약 다른 페이지에서 시각 회귀가 발생하면 별도 PR로 처리(본 plan 범위 외).
