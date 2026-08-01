# Shared UI components

## `frontend/src/components/ui/SegmentTabs.jsx`

모드 전환(버스/지하철/셔틀)에 쓰는 슬라이딩 세그먼트 탭. 전체 구현은 원본 파일을 단일 출처로 사용한다.

```jsx
export default function SegmentTabs({ items = [], active, onChange, size = 'md' }) {
  // ResizeObserver로 활성 버튼 위치를 측정하고, 각 button의 onClick에서 onChange(item.id)를 호출한다.
  // button은 role="tab", aria-selected를 가지며 기본 높이는 44px다.
}
```

## `frontend/src/components/ui/SegmentedControl.jsx`

하교/등교 및 정류장 그룹 선택용 공통 세그먼트 컨트롤. `options`, `value`, `onChange`, `size`, `ariaLabel`을 받는다.

```jsx
export default function SegmentedControl({ options = [], value, onChange, size = 'md', ariaLabel }) {
  // role="tablist" 안에 role="tab" 버튼을 렌더하고 단일 pill indicator를 이동한다.
}
```

## `frontend/src/components/schedule/ScheduleSection.jsx`

시간표 목록의 공통 노선 행. 노선 배지, 목적지, 여정 체인, 실시간/시간표 상태와 ETA를 표시한다.

```jsx
export default function ScheduleSection({
  type = 'bus', routeCode, title, subtitle, journey, badge, chips = [],
  minutesUntil, hhmm, timeLines, imminent = false, onClick,
  isFavorite, onToggleFavorite, selected = false, loading = false, footer,
}) {
  // 클릭 가능한 article/button 형태의 단일 노선 카드 렌더
}
```

## `frontend/src/components/ui/TransitCard.jsx`

홈 대시보드 버스 카드. 배지/제목/부제/칩/ETA 3열 구조를 사용한다.

```jsx
export default function TransitCard({ badge, title, subtitle, chips, eta, onClick, muted }) {
  // grid-template-columns: auto 1fr auto
}
```

