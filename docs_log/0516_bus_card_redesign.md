# 0516 — 버스 시간표 카드 v5 리디자인

## 변경

- `BusArrivalCard` 전면 교체 (`frontend/src/components/bus/BusArrivalCard.jsx`)
  - chip = 카테고리 솔리드 컬러 (bg-line-express / bg-line-201 / bg-line-33)
  - from-line "○○ 에서 출발" — 출발지명 카테고리 컬러 강조, "에서 출발"은 작은 uppercase muted 라벨
  - 행선지(head) + crowd 배지(실시간) 또는 정시 라벨(시간표)
  - 트랙(`MiniTrack` 위임): 출발지 도트 11px 컬러 + halo ring, 경유·종점은 7px 검정 / 라벨 출발지만 컬러 강조
  - ETA 임박(<60s)일 때 imminent 컬러 + halo 펄스 애니메이션 / 정보 없음일 때 `—`
- `MiniTrack` 신설 (`frontend/src/components/bus/MiniTrack.jsx`) — t2/t3/t4 그리드 변형, muted 상태 지원, 단위 테스트 5건.
- `ArrivalList` 카테고리 sub-그룹화 — 등교/하교/기타 top 그룹 안에서 express → trunk → local 순으로 sub-그룹 + swatch 헤더("N ROUTES" 카운트 포함).
- `busStationConfig.js` 데이터 모델 확장
  - `ROUTE_DISPLAY_CONFIG`에 `category` 필드 (express/trunk/local)
  - `ROUTE_PATH` 구조화 데이터 (origin / waypoints / terminus / label)
  - `getRouteCategory`, `getRoutePath`, `ROUTE_CATEGORY_*` 상수/헬퍼
  - `getRouteCardDisplay`는 `ROUTE_PATH` 파생으로 호환 유지 (MapView/BusPanel 영향 없음)
- Tailwind `route-halo-{express,trunk,local}` (라이트/다크) 컬러 토큰 6개.

## 비변경 (의도)

- 백엔드 API · DB 스키마 — 변경 없음.
- `ArrivalDistributionBar` / `BusStatsHeader` — 그대로. 카드에서는 분포 바를 빼고 상세 시트로만 보여줌 (`StatsSheet` / `ScheduleDetailModal`).
- `RouteProgressStrip` — 기존 구현 유지 (`BusTimetableDetail.jsx`, `ScheduleDetailModal.jsx`에서 사용 중). v5 카드는 `MiniTrack`을 쓰지만 다른 화면은 영향 없음.
- `getRouteCardDisplay` — 시그니처 유지, `ROUTE_PATH` 파생 호환.

## 커밋 (총 6 commit)

```
f5dced0 feat(bus): ArrivalList에 route 카테고리(광역/간선/시내) sub-그룹 추가
0970750 fix(bus): BusArrivalCard 정정 — text 토큰 / halo 펄스 / RouteProgressStrip 복원
1c3bf05 feat(bus): v5 카드 디자인 적용 — from-line + MiniTrack + 출발지 강조
009d7cb feat(bus): MiniTrack 컴포넌트 신설
9ab084a feat(bus): 노선 카테고리·경로 데이터 모델 확장
713309c feat(ui): tailwind에 route halo 컬러 토큰 추가
```

## 테스트

- 단위 테스트 71/71 통과 (전체 frontend vitest).
- 신규 테스트: MiniTrack 5건, BusArrivalCard 6건 (v5 layout 검증), ArrivalList 3건 (카테고리 sub-그룹 검증).

## 수동 QA 체크리스트 (사용자 확인 필요)

```bash
cd frontend && npm run dev
```

`/schedule` → 버스 탭:
- [ ] 하교 탭에 광역/간선/시내·마을 카테고리 헤더 표시
- [ ] 각 카드의 from-line "○○ 에서 출발" — 출발지는 카테고리 컬러
- [ ] 트랙의 출발 도트가 카테고리 컬러 + 옅은 halo ring으로 강조
- [ ] 트랙의 경유·종점 도트는 검정, 라벨도 검정
- [ ] ETA 정렬이 모든 카드 동일 우정렬
- [ ] 정보 없음 카드(예: 11-A): 트랙·라벨 회색, ETA `—`
- [ ] 임박 카드: ETA "곧" + 빨강 halo 펄스
- [ ] 다크 모드 토글 시 컬러 정상

등교 탭:
- [ ] 시흥시청 정류장 등교 노선(시흥33 / 3401 / 5602) 카테고리별 분류
- [ ] from-line "시흥시청역 에서 출발", 종점 "한국공대"

## 알려진 한계 · 후속

- **`ROUTE_PATH`는 노선 단위 기본 path** — 노선이 여러 정류장에서 보일 때(예: 99-2가 시화터미널·이마트 둘 다 등장) origin이 노선의 절대 origin으로 표시됨. 사용자가 보고 있는 정류장 컨텍스트와 다르면 혼란 가능. 후속: 정류장×노선 단위 path로 세분화.
- **`11-A` terminus** 데이터를 정왕역으로 설정했으나 실제 노선이 정왕역 너머로 이어진다면 정정 필요.
- 카테고리 필터 토글("광역만 보기")은 후속.
- 마커 시트(`MarkerSheet`) 동일 적용은 후속.

## QA 후 정정해야 할 사항

수동 QA에서 위 한계 사항이나 다른 회귀가 발견되면 빠른 후속 커밋으로 정정.
