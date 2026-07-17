# 탈것:정왕 — 디자인 시스템 (v1)

> 리디자인 결정물의 커밋된 기준선. 방향 = **모던 미니멀 유틸리티 / 정제된 teal accent / SUIT 폰트 / 라이트 퍼스트 + 다크 동급**.
> 모든 hex는 Radix Colors 공식 소스(`src/light.ts`·`src/dark.ts`)에서 직접 검증. 시안·조사 과정은 `frontend/test/`(gitignore, 로컬 전용)에 남아있음.
>
> 이 문서가 대체하는 현재 문제(인벤토리 조사 기준): 색 시스템 3세대 공존 · 다크 2체계(순흑 OLED vs 소프트 그레이) · 토큰과 인라인 hex 중복 · radius 8~22px 난립 · 폰트 굵기 700~900 과편중 · 학식 이질 팔레트.
>
> 구현 로드맵은 `frontend/IMPLEMENTATION-PLAN.md` 참조.

---

## 1. Primitive 스케일 (원시값 — 이름은 스케일 번호만)

### 1.1 Teal (accent) — Radix teal, 12단계
`teal-9`가 라이트/다크 동일(`#12a594`)이라 브랜드색이 테마 전환에도 일관.

| step | Light | Dark | 주 용도 |
|---|---|---|---|
| 1 | `#fafefd` | `#0d1514` | 앱 최상위 tint 배경 |
| 2 | `#f3fbf9` | `#111c1b` | subtle 배경 |
| 3 | `#e0f8f3` | `#0d2d2a` | accent tint 배경(기본) |
| 4 | `#ccf3ea` | `#023b37` | accent tint hover |
| 5 | `#b8eae0` | `#084843` | accent tint pressed |
| 6 | `#a1ded2` | `#145750` | 구분선/저강조 |
| 7 | `#83cdc1` | `#1c6961` | 보더(강조) |
| 8 | `#53b9ab` | `#207e73` | 아이콘 저강조 |
| **9** | `#12a594` | `#12a594` | **accent solid(버튼/링크/포커스)** |
| 10 | `#0d9b8a` | `#0eb39e` | accent hover |
| 11 | `#008573` | `#0bd8b6` | accent 텍스트(저대비) |
| 12 | `#0d3d38` | `#adf0dd` | accent 텍스트(고대비) |

### 1.2 Sage (neutral) — Radix sage, 12단계
teal과 같은 그린 계열 그린-그레이. 순흑 대신 `#101211`부터 → 다크 단일 사다리.

| step | Light | Dark |
|---|---|---|
| 1 | `#fbfdfc` | `#101211` |
| 2 | `#f7f9f8` | `#171918` |
| 3 | `#eef1f0` | `#202221` |
| 4 | `#e6e9e8` | `#272a29` |
| 5 | `#dfe2e0` | `#2e3130` |
| 6 | `#d7dad9` | `#373b39` |
| 7 | `#cbcfcd` | `#444947` |
| 8 | `#b8bcba` | `#5b625f` |
| 9 | `#868e8b` | `#63706b` |
| 10 | `#7c8481` | `#717d79` |
| 11 | `#5f6563` | `#adb5b2` |
| 12 | `#1a211e` | `#eceeed` |

### 1.3 상태색 primitive
| 이름 | Light | Dark |
|---|---|---|
| amber-solid / bg | `#f59e0b` / `#fef3c7` | `#ffb224` / `#2a2000` |
| green-solid | `#16a34a` | `#3dd68c` |
| red-solid / bg | `#dc2626` / `#fee2e2` | `#ff6369` / `#3b1219` |

---

## 2. Semantic 토큰 (역할 이름 — 라이트/다크는 여기서 값만 스왑)

CSS 변수 단일 출처(`:root` / `.dark`). 컴포넌트는 **primitive hex를 직접 쓰지 않고 이 토큰만 참조**.

| 토큰 | 역할 | Light | Dark |
|---|---|---|---|
| `--bg` | 페이지 배경 | `#fbfdfc` (sage1) | `#101211` (sage1) |
| `--surface` | 카드 표면 | `#ffffff` | `#171918` (sage2) |
| `--surface-2` | 한 단 낮은 표면 | `#f7f9f8` (sage2) | `#202221` (sage3) |
| `--surface-3` | elevated(시트/팝오버) | `#eef1f0` (sage3) | `#272a29` (sage4) |
| `--line` | 보더/구분선 | `#d7dad9` (sage6) | `#373b39` (sage6) |
| `--line-strong` | 강조 보더 | `#cbcfcd` (sage7) | `#444947` (sage7) |
| `--ink` | 본문 텍스트 | `#1a211e` (sage12) | `#eceeed` (sage12) |
| `--ink-2` | 2차 텍스트 | `#5f6563` (sage11) | `#adb5b2` (sage11) |
| `--mute` | 3차/placeholder | `#868e8b` (sage9) | `#717d79` (sage10) |
| `--accent` | accent solid | `#12a594` (teal9) | `#12a594` (teal9) |
| `--accent-hover` | accent hover | `#0d9b8a` (teal10) | `#0eb39e` (teal10) |
| `--accent-ink` | accent 텍스트 | `#008573` (teal11) | `#0bd8b6` (teal11) |
| `--accent-bg` | accent tint 배경 | `#e0f8f3` (teal3) | `#0d2d2a` (teal3) |
| `--focus-ring` | 포커스 링 | `#12a594` @ 40% | `#12a594` @ 55% |

### 상태 semantic
| 토큰 | 의미 | Light | Dark |
|---|---|---|---|
| `--imminent` / `--imminent-bg` | 도착 임박(≤3분) | `#f59e0b` / `#fef3c7` | `#ffb224` / `#2a2000` |
| `--ease` | 여유/정시 | `#16a34a` | `#3dd68c` |
| `--delayed` / `--delayed-bg` | 지연 | `#dc2626` / `#fee2e2` | `#ff6369` / `#3b1219` |
| `--realtime` | 실시간(=accent + 펄스 점) | `#12a594` | `#12a594` |
| (시간표 전용) | 배지 없음 · `--mute` 텍스트만 | — | — |
| (stale) | `--mute` + 시계 아이콘 | — | — |

**접근성 원칙:** 색은 보조 신호. 실시간/임박/지연/stale은 **항상 아이콘 또는 텍스트 라벨을 1차 신호로** 동반(색만으로 구분 금지). 본문 대비 WCAG 2.2 AA(4.5:1) 최소 준수, accent 텍스트는 `--accent-ink`(teal11) 사용.

---

## 3. 타이포그래피 (SUIT)

폰트: **SUIT Variable 단일**(A2z 로고 폰트 폐기 — 기본적으로 SUIT만 사용), 숫자 강조는 `tabular-nums`.

**굵기 규율(현행 700~900 과편중 해소):** 위계는 **크기 + 색(sage 명도) + 자간**으로 먼저 만들고 굵기는 마지막 보조.
- 400 본문 / 500 라벨·강조 / 600 헤딩·버튼·숫자 / **700은 화면당 1곳(hero 숫자)만 예약**. 800·900 미사용.

> 크기는 v1 대비 **전반 +1px**(가독성 상향, 실기기에서 더 키울 수 있음).

| 토큰 | px / line-height / weight | 용도 |
|---|---|---|
| `caption` | 13 / 17 / 400 | 타임스탬프·부가 |
| `body-sm` | 14 / 19 / 400 | 리스트 보조 |
| `body` | 16 / 23 / 400 | 기본 본문 |
| `label` | 15 / 21 / 500 | 버튼/탭 라벨 |
| `head-sm` | 17 / 23 / 600 | 카드 타이틀 |
| `head` | 21 / 29 / 600 | 섹션 타이틀 |
| `num-lg` | 29 / 33 / 600 + tnum | 도착 "n분" |
| `num-xl` | 37 / 41 / 700 + tnum | 최상위 hero 숫자(1곳 한정) |

자간: 본문 `-0.01em`, 숫자·헤딩 `-0.02em`(SUIT 타이트). `.tnum { font-variant-numeric: tabular-nums; }` 유틸로 도착시간·시계에만 적용.

---

## 4. Shape / Elevation / Motion 규율

### Radius (컴포넌트별 의도적 차등 — "AI 균질감" 회피)
`badge`(노선번호) = 8px · `button`/`input` = 10px · `card` = 14px · `sheet/modal` = 20px · `pill`(chip/상태) = 999px.
→ 현재 8~22px 난립 + 토큰/임의값 이중표기를 **5개 값으로 고정**, `rounded-[Npx]` 임의값 금지.

### Shadow (최대 2단계, 다크는 보더로 대체)
`sh-card` = `0 1px 3px rgba(0,0,0,.06)` · `sh-pop` = `0 8px 24px rgba(0,0,0,.12)`.
다크에서는 그림자 대신 `--line`으로 표면 구분. **보더+그림자 동시 사용 금지**.

### Motion (Apple 스타일 — 부드럽되 굼뜨지 않게)
순수 CSS. 거의 모든 상호작용에 모션을 두되 duration은 타이트하게.

**이징:** `--e-out: cubic-bezier(0.32,0.72,0,1)`(결정적 ease-out, 진입/시트) · `--e-spring: cubic-bezier(0.5,1.35,0.5,1)`(미세 오버슈트, press·pop·knob) · `--e-inout: cubic-bezier(0.65,0,0.35,1)`(크로스페이드).

**duration:** `press 120` · `base 200`(토글/세그/색) · `enter 300`(카드/리스트) · `sheet 440`(바텀시트).

**패턴:** press(scale 0.94 spring) · 토글 knob 슬라이드 · 세그먼트 인디케이터 슬라이드 · 별/체크 pop · 카드 진입(fade+상승+미세 스케일) · 리스트 스태거(60ms) · 바텀시트 슬라이드업 · 도착 숫자 롤 · 탭 크로스페이드 · 실시간 펄스 · 스켈레톤 시머.

**규율:** 목적 없는 fade-in 남발 금지, 오버슈트는 미세하게(과한 바운스 금지), `prefers-reduced-motion` 존중(전환/애니 무력화).

---

## 5. 네거티브 룰 (design system에 박아 기본값 회귀 차단)
- 그라디언트 남발 금지(브랜드 tint 배경 제외). 메시 그라디언트·네온 글로우 금지.
- 그림자 3단계 이상 금지 · 보더+그림자 동시 금지.
- teal accent는 "손전등" — 진행중/CTA/현재시각/실시간에만. 대면적 teal 배경 금지.
- primitive hex 인라인 직접 사용 금지(semantic 토큰만). 학식 독립 팔레트 폐기 → 공통 토큰 편입.
- radius/weight/size는 위 토큰 밖 임의값 금지.

---

## 6. 현행 → 신규 매핑 메모 (마이그레이션 시)
- `--tj-bg/surface/line/ink/ink-2/mute` → 동명 semantic로 값만 교체(sage 기반).
- `--tj-accent`(#2E8B86) → `--accent`(#12a594, teal9). 인라인 `#2E8B86/#1B2A4A/#5A6678/#E7E4DF` 전수 치환.
- 레거시(iDrive `bg-dark #000/#0a0a0a`, `--tj-accent-2/dark`, chip-*, navy 등) 제거.
- 다크: 순흑 OLED 계열 전부 sage 다크 사다리로 통일.
- 폰트: `font-extrabold/black`(85+58회) → 600/700로 강등, num-xl만 700.

## 7. 미결/후속
- 컴포넌트 토큰 레이어(버튼/카드 variant)는 컴포넌트 리디자인 단계에서 정의.
- 실제 CSS 변수/tailwind.config 반영은 Phase A(`IMPLEMENTATION-PLAN.md`)에서 진행.
