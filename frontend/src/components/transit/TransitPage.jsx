import { Bus, BusFront, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import Segmented from '../kit/Segmented'
import BusBoard from './BusBoard'
import SubwayBoard from './SubwayBoard'
import ShuttleBoard from './ShuttleBoard'

const MODES = [
  { value: 'bus', label: '버스', Icon: BusFront },
  { value: 'subway', label: '지하철', Icon: TrainFront },
  { value: 'shuttle', label: '셔틀', Icon: Bus },
]

export default function TransitPage() {
  const stored = useAppStore((s) => s.selectedMode)
  const setMode = useAppStore((s) => s.setSelectedMode)
  const mode = MODES.some((m) => m.value === stored) ? stored : 'bus'

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4">
      <h1 className="sr-only">교통</h1>
      <Segmented label="교통 종류" options={MODES} value={mode} onChange={setMode} />
      {mode === 'bus' && <BusBoard />}
      {mode === 'subway' && <SubwayBoard />}
      {mode === 'shuttle' && <ShuttleBoard />}
    </div>
  )
}
