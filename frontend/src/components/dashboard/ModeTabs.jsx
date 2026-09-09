import useAppStore from '../../stores/useAppStore'
import SegmentedControl from '../ui/SegmentedControl.jsx'

/**
 * ModeTabs — 버스 / 지하철 / 셔틀 / 택시 모드 탭.
 */
const MODES = [
  { value: 'bus',     label: '버스' },
  { value: 'subway',  label: '지하철' },
  { value: 'shuttle', label: '셔틀' },
  { value: 'taxi',    label: '택시' },
]

export default function ModeTabs() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)

  return (
    <div className="px-4 pt-2 pb-1.5">
      <SegmentedControl
        options={MODES}
        value={selectedMode}
        onChange={setSelectedMode}
        ariaLabel="교통수단 선택"
      />
    </div>
  )
}
