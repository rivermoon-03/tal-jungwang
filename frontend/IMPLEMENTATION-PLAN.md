# 탈것:정왕 리디자인 · 기능 + 구현 계획

> 산출물: 디자인 토큰(`frontend/DESIGN.md`) · 시안(`frontend/test/#시안`,`#화면`, gitignore 로컬 전용) · 조사(`frontend/test/refs/libraries.md`·`auto-commute-feasibility.md`·`bookmarks-and-viz.md`).
> 규칙: `.claude/mistakes.md` · `CLAUDE.md`. **1 기능 = 1 브랜치 = 1 PR**, 머지 후 브랜치 삭제.

## 0. 선결
- [x] **결정물 이관**: `design-tokens.md` → `frontend/DESIGN.md`(커밋), `implementation-plan.md` → `frontend/IMPLEMENTATION-PLAN.md`(커밋).
- 착수 전 각 PR은 라이트/다크 **대비(WCAG 2.2 AA)** 스냅샷 검증을 포함.

---

## Phase A — 디자인 시스템 이관  ·  PR `redesign/design-tokens`
목표: 3세대 카오스 → 단일 토큰. **컴포넌트 대부분이 `--tj-*`를 참조하므로 semantic 토큰만 갈아끼우면 자동 반영.**
1. `src/index.css` `:root`/`.dark` → sage+teal **semantic 토큰**(`--bg/surface/surface-2/line/ink/ink-2/mute/accent/accent-ink/accent-bg` + 상태색). **다크 단일 사다리**(#101211~), 순흑 OLED 제거.
2. `tailwind.config.js`: 색 매핑 정리(레거시 iDrive/chip/navy 축소·제거), `radius` 5값(8/10/14/20/999), `boxShadow` 2단(sh-card/sh-pop), `fontSize` 스케일(+1px), 모션 이징/duration.
3. `index.html`: `theme-color #FF385C → #12a594`. SUIT 유지, **A2z @font-face 제거**(SUIT 단일).
4. 인라인 hex 전수 치환: `#2E8B86/#1B2A4A/#5A6678/#E7E4DF` → 대응 토큰.
- 리스크: 전역 변경 → 화면별 회귀. 라이트/다크 각 탭 스냅샷 필수.

## Phase B — 레거시 제거 & 컴포넌트 통합  ·  PR `redesign/cleanup`
- `ui/` vs `common/` **5쌍 통합**(EmptyState/ErrorState/RouteBadge/SegmentTabs/Skeleton) → 단일 소스.
- **학식 이질 팔레트 폐기**: `CafeteriaVenues.jsx`(hex 34)·`CafeteriaVenueDetailPage.jsx`(hex 32) → 공통 토큰.
- 폰트 굵기 강등: `font-extrabold/black`(85+58회) → 600, hero 숫자만 700.
- radius 임의값(`rounded-[Npx]`) → 5토큰. `App.css`(미사용) 삭제, `ease-dark`(무효) 제거, `fadeIn` keyframe 충돌 정리.

## Phase C — 모션 시스템  ·  PR `redesign/motion` (+ vaul)
- `test/motion.css`의 이징(`--e-out/spring/inout`)·duration·keyframe을 앱에 이관. press/토글/세그 인디케이터/카드 진입/리스트 스태거/시트/숫자 롤/펄스/시머 적용.
- **vaul** 도입 → `MarkerSheet`·`GlobalSubwayLineSheet`·`GlobalDetailModal` 바텀시트 스와이프화.
- `prefers-reduced-motion` 유지.

## Phase D — 화면 리디자인  ·  화면군별 PR
- 모바일: 홈(A/B/C 중 택1 확정 후) · 시간표(그리드/리스트) · 학식 · 더보기 · 노선상세.
- PC: 2분할 지도홈 · 시간표 · 설정.
- **반응형은 JS 브레이크포인트 조건부 마운트**(CSS `hidden` 금지 — 규칙4). 숨은 컴포넌트 타이머/GPS 좀비 방지.

---

## Phase E — 기능 (각 브랜치=1 기능=1 PR)

| ID | 기능 | 핵심 작업 | 의존/리스크 |
|---|---|---|---|
| **F1** | 자동 등하교 확장 | 위치→방향 역추론(학교 반경 판정), `useEffectiveDirection` **KST 명시**(현재 `new Date().getHours()` 로컬시간=규칙1 위반), 셔틀 연동(2캠 좌표 상수 추가), 설정 자동/수동+시간대. 순수 `inferCommute({coords,nowMs})` 헬퍼로 일원화 | 반경 경계 진동→히스테리시스(기존 `useBusStationAutoSelect` 이력패턴 재사용). 백엔드 불필요 |
| **F2** | 북마크 × 지금 운영중 | `favorites.venues` persist 확장(version bump + migrate), `venueOpen.js`의 `isOpenNow()` + 북마크 교집합, 홈/학식 노출 | 프론트만. `useFavoriteItems()` export 분리 |
| **F3** | 시간표 그리드/리스트 토글 | 뷰 상태 persist + 설정 연동 | 가벼움 |
| **F4** | 글자 크기 설정 | CSS 변수 배율(또는 rem base) + persist, 슬라이더 | 가벼움 |
| **F5** | 노선 알림(막차/첫차 푸시) | SW Web Push + 백엔드(구독 저장·스케줄) | **규모 큼**·백엔드 협업·권한 UX. 우선순위 최후, 별도 스파이크 |
| **F6** | 데이터 시각화 | 혼잡도 "지금" 하이라이트(프론트), 요일×시간 히트맵(day_type 3콜 합치기), 정시성 delta | delta는 **백엔드 응답에 시간표 예정값 포함 여부 확인 선행** |
| **F7** | 라이브러리 | `web-vitals`·`sonner`·`rollup-plugin-visualizer`(dev)·`Socket.dev+OSV`(CI) | 저위험. TanStack/vite-plugin-pwa 전면은 **도입 안 함**(YAGNI) |

---

## 권장 순서
1. **A → B → C** (디자인 기반 확립, vaul 포함)
2. **D** 화면 점진 적용
3. 기능: **F7(툴) · F3 · F4**(가벼운 개인화) → **F1**(자동매칭, KST 버그 포함) → **F2**(북마크) → **F6**(시각화) → **F5**(푸시, 최후)

## 상시 준수 (mistakes.md 요약)
- 시각은 KST `ZoneInfo`/timezone-aware, 문자열 사전순 비교 금지, 자정 넘김 고려
- 표시 로직(반올림·포맷·day_type)은 헬퍼 일원화
- 반응형 = JS 브레이크포인트 조건부 마운트
- 다층 캐시 TTL ≤ cron 간격
- 외부 API 배열은 요청 키로 필터 후 빈 여부 판정
- 시크릿 커밋 금지, 커밋 메시지 의미있게, 머지 후 브랜치 삭제
