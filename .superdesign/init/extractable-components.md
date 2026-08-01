# Extractable components

## SegmentTabs
- Source: `frontend/src/components/ui/SegmentTabs.jsx`
- Category: basic
- Description: 버스/지하철/셔틀 모드 전환 탭
- Extractable props: `items`, `active`
- Hardcoded: 슬라이딩 인디케이터 스타일, 44px 터치 영역

## SegmentedControl
- Source: `frontend/src/components/ui/SegmentedControl.jsx`
- Category: basic
- Description: 하교/등교 및 정류장 그룹 선택
- Extractable props: `options`, `value`, `size`
- Hardcoded: semantic pill tokens

## ScheduleSection
- Source: `frontend/src/components/schedule/ScheduleSection.jsx`
- Category: basic
- Description: 시간표 노선 목록 카드
- Extractable props: `routeCode`, `title`, `subtitle`, `journey`, `chips`, `minutesUntil`, `hhmm`, `selected`
- Hardcoded: 카드 정보 계층 및 ETA 열

## FloatingDock
- Source: `frontend/src/components/common/FloatingDock.jsx`
- Category: layout
- Description: 모바일 하단 앱 내비게이션
- Extractable props: `activeItem`
- Hardcoded: 홈/시간표/학식/더보기 메뉴와 아이콘

