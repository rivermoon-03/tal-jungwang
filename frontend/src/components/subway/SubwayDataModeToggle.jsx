import SegmentTabs from '../ui/SegmentTabs'

const ITEMS = [
  { id: 'timetable', label: '시간표' },
  { id: 'realtime',  label: '실시간' },
]

export default function SubwayDataModeToggle({ value, onChange }) {
  return (
    <SegmentTabs
      items={ITEMS}
      active={value}
      onChange={onChange}
    />
  )
}
