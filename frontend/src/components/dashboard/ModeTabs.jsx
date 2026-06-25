import useAppStore from '../../stores/useAppStore'
import SegmentTabs from '../ui/SegmentTabs.jsx'

/**
 * ModeTabs — 버스 / 지하철 / 셔틀 / 택시 모드 탭.
 * ui/SegmentTabs(items prop, 44px, bg-ink 활성) 사용.
 */
const MODES = [
  { id: 'bus',     label: '버스' },
  { id: 'subway',  label: '지하철' },
  { id: 'shuttle', label: '셔틀' },
  { id: 'taxi',    label: '택시' },
]

export default function ModeTabs() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)

  return (
    <div aria-label="교통수단 선택" className="px-4 pt-2 pb-1.5">
      <SegmentTabs
        items={MODES}
        active={selectedMode}
        onChange={setSelectedMode}
      />
    </div>
  )
}
