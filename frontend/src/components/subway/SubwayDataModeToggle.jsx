import SegmentedControl from '../ui/SegmentedControl'

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
