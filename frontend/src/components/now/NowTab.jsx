// frontend/src/components/now/NowTab.jsx
import { useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'
import { useNowDepartures } from '../../hooks/useNowDepartures'
import NowHeader            from './NowHeader'
import CommuteTabs          from './CommuteTabs'
import DestinationPicker    from './DestinationPicker'
import SubwayStationPicker  from './SubwayStationPicker'
import HeroCardStack        from './HeroCardStack'
import HeroNextDeparture    from './HeroNextDeparture'
import HeroTrafficFlow      from './HeroTrafficFlow'
import AltChipRow           from './AltChipRow'
import FullDepartureList    from './FullDepartureList'

export default function NowTab() {
  const mode = useAppStore((s) => s.commuteMode)
  const { data } = useNowDepartures()
  const departures = data?.departures ?? []
  const [primary, ...rest] = departures
  const alt = rest.slice(0, 5)

  const cards = useMemo(
    () => [
      <HeroNextDeparture key="next" departure={primary} />,
      <HeroTrafficFlow   key="flow" />,
    ],
    [primary]
  )

  return (
    <div className="h-full overflow-auto pb-24 bg-slate-50 dark:bg-bg-dark">
      <NowHeader />
      <CommuteTabs />
      {mode === '하교'   && <DestinationPicker />}
      {mode === '지하철' && <SubwayStationPicker />}

      <HeroCardStack cards={cards} />
      <AltChipRow departures={alt} />
      <FullDepartureList departures={departures} />
    </div>
  )
}
