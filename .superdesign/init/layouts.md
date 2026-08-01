# Shared layouts

## `frontend/src/App.jsx`

pathname 기반 수동 라우팅을 담당한다. 모바일은 `mobileContent`, 데스크톱은 `PCMainShell`을 렌더한다. `/schedule`에서는 `pages/SchedulePage.jsx`를 마운트한다.

## `frontend/src/components/common/FloatingDock.jsx`

모바일 하단 내비게이션. 홈/시간표/학식/더보기 네 항목이며 `/schedule`을 시간표 활성 상태로 판정한다.

```jsx
const NAV_ITEMS = [
  { id: 'home', href: '/', label: '홈' },
  { id: 'schedule', href: '/schedule', label: '시간표' },
  { id: 'cafeteria', href: '/cafeteria', label: '학식' },
  { id: 'more', href: '/more', label: '더보기' },
]
```

## `frontend/src/components/layout/PCMainShell.jsx`

데스크톱 앱 셸. 지도는 유지하고 페이지 콘텐츠를 불투명 패널로 덮는다.

