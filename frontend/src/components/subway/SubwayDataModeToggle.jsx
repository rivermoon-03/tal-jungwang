import SegmentedControl from '../ui/SegmentedControl'

// 정본 세그먼트 컨트롤(ui/SegmentedControl)을 쓴다. 전에는 이 토글만 별도
// ui/SegmentTabs를 써서 홈 ModeTabs·시간표 그룹 탭과 슬라이드 인디케이터 색이
// 달랐다.
const OPTIONS = [
  { value: 'timetable', label: '시간표' },
  { value: 'realtime',  label: '실시간' },
]

export default function SubwayDataModeToggle({ value, onChange }) {
  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="지하철 데이터 모드 선택"
    />
  )
}
