# Page dependency trees

## `/schedule`

Entry: `frontend/src/pages/SchedulePage.jsx`

- `frontend/src/components/schedule/SchedulePage.jsx`
  - `frontend/src/components/ui/SegmentTabs.jsx`
  - `frontend/src/components/ui/SegmentedControl.jsx`
  - `frontend/src/components/schedule/ScheduleSection.jsx`
  - `frontend/src/components/schedule/ScheduleDetailModal.jsx`
  - `frontend/src/components/schedule/StatsSheet.jsx`
  - `frontend/src/components/dashboard/busStationConfig.js`
  - `frontend/src/hooks/useBus.js`
  - `frontend/src/hooks/useShuttle.js`
  - `frontend/src/hooks/useSubway.js`
  - `frontend/src/hooks/useMap.js`
  - `frontend/src/stores/useAppStore.js`
- `frontend/src/components/common/FloatingDock.jsx`
- `frontend/src/App.jsx`

실제 모바일 렌더 분기는 `SchedulePage.jsx`의 `!isDesktop` 경로이며, 상단 모드 탭 → 그룹 세그먼트 → 스크롤 목록 → 하단 dock 순서다.

## `/route/:id`

Entry: `frontend/src/pages/RouteDetailPage.jsx`

- `frontend/src/components/schedule/ScheduleDetailModal.jsx`
- `frontend/src/components/dashboard/busStationConfig.js`
- `frontend/src/hooks/useBus.js`

