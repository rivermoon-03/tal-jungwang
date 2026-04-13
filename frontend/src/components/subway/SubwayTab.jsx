import { useState } from 'react'
import { TrainFront, ChevronLeft } from 'lucide-react'
import { useSubwayTimetable } from '../../hooks/useSubway'
import SubwayLineCard from './SubwayLineCard'
import SubwayCountdown from './SubwayCountdown'
import SubwayTimetable from './SubwayTimetable'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function getNextDestination(trains) {
  if (!trains?.length) return null
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  return trains.find((t) => timeToMinutes(t.depart_at) > nowMin)?.destination ?? null
}

const CARD_DEFS = [
  { key: 'line4_up',   lineName: '4호선',    upDown: '상행', fallback: '당고개', color: '#1B5FAD', lightColor: '#E8F0FB' },
  { key: 'line4_down', lineName: '4호선',    upDown: '하행', fallback: '오이도', color: '#1B5FAD', lightColor: '#E8F0FB' },
  { key: 'up',         lineName: '수인분당선', upDown: '상행', fallback: '왕십리', color: '#F5A623', lightColor: '#FEF6E6' },
  { key: 'down',       lineName: '수인분당선', upDown: '하행', fallback: '인천',   color: '#F5A623', lightColor: '#FEF6E6' },
]

export default function SubwayTab() {
  const [selectedKey, setSelectedKey] = useState(null)
  const { data: timetable, loading } = useSubwayTimetable()

  const CARDS = CARD_DEFS.map((def) => {
    const dest = getNextDestination(timetable?.[def.key]) ?? def.fallback
    return { ...def, dirLabel: `${def.upDown} · ${dest} 방면` }
  })

  const selected = selectedKey ? CARDS.find((c) => c.key === selectedKey) : null
  const trains = selected ? (timetable?.[selected.key] ?? []) : []

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextIndex = selected
    ? trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
    : -1
  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null

  // ── 상세 뷰 ──────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex flex-col h-full animate-slide-in-right">
        <div
          className="flex items-center gap-2 text-white px-4 py-4"
          style={{ backgroundColor: selected.color }}
        >
          <button onClick={() => setSelectedKey(null)} className="p-0.5 -ml-1 rounded">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <TrainFront size={20} strokeWidth={2} />
          <h2 className="text-lg font-bold">
            {selected.lineName} · {selected.dirLabel.split(' · ')[1]}
          </h2>
        </div>

        <SubwayCountdown nextTrain={nextTrain} lineColor={selected.color} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <SubwayTimetable
            entries={trains}
            nextIndex={nextIndex}
            lineColor={selected.color}
            lineLightColor={selected.lightColor}
          />
        )}
      </div>
    )
  }

  // ── 카드 목록 뷰 ─────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <TrainFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">정왕역</h2>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">불러오는 중...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28 md:pb-4">
          {CARDS.map((card) => (
            <SubwayLineCard
              key={card.key}
              lineName={card.lineName}
              dirLabel={card.dirLabel}
              color={card.color}
              lightColor={card.lightColor}
              trains={timetable?.[card.key] ?? []}
              onClick={() => setSelectedKey(card.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
