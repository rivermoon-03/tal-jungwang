import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useNow } from '../../hooks/useNow'
import { linkProps } from '../../lib/nav'
import Segmented from '../kit/Segmented'
import { Card, Pill, SectionLabel } from '../kit/bits'
import { openCount, pillKindOf, venuesByCategory } from './venueList'

const VIEWS = [
  { value: 'open', label: '지금 열린 곳' },
  { value: 'all', label: '전체' },
]

/** 교내 매장. 카테고리별 한 줄씩, 상태 칩이 오른쪽에 온다. */
export default function VenuesView() {
  const now = useNow(60_000)
  const [view, setView] = useState('open')
  const groups = venuesByCategory(new Date(now), view === 'open')
  const count = openCount(groups)

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-3">
      <Segmented label="보기" options={VIEWS} value={view} onChange={setView} />
      {view === 'open' && <p className="px-1 pt-3 text-f15 font-bold text-ink-2">영업 중 {count}곳</p>}
      {groups.length === 0 && <p className="px-1 py-8 text-f16 text-ink-2">지금 열린 곳이 없어요</p>}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <SectionLabel>{g.label}</SectionLabel>
          <Card as="ul" className="divide-y divide-line-soft">
            {g.rows.map(({ venue, state }) => (
              <li key={venue.id}>
                <a {...linkProps(`/cafeteria/${encodeURIComponent(venue.id)}`)} className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-f17 font-extrabold text-ink">{venue.name}</p>
                    <p className="flex items-center gap-1 truncate text-f13 text-mute">
                      <MapPin size={13} aria-hidden="true" />
                      {venue.location}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill kind={pillKindOf(state.status)}>{state.primaryLabel}</Pill>
                    {state.subLabel && <span className="whitespace-nowrap text-f14 font-bold text-ink">{state.subLabel}</span>}
                  </div>
                </a>
              </li>
            ))}
          </Card>
        </section>
      ))}
    </div>
  )
}
