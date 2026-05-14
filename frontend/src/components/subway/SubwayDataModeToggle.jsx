import SegmentTabs from '../common/SegmentTabs'

const TABS = [
  { id: 'realtime',  label: '실시간' },
  { id: 'timetable', label: '시간표' },
]

export default function SubwayDataModeToggle({ value, onChange, size = 'sm' }) {
  return (
    <SegmentTabs
      tabs={TABS}
      active={value}
      onChange={onChange}
      size={size}
    />
  )
}
