import { useState, useEffect } from 'react'
import { TrainFront, ChevronLeft } from 'lucide-react'
import { useSubwayTimetable } from '../../hooks/useSubway'
import SubwayLineCard from './SubwayLineCard'
import SubwayCountdown from './SubwayCountdown'
import SubwayTimetable from './SubwayTimetable'
import { getLastTrainStatus, getSpecialTrainIndices } from '../../utils/trainTime'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function getNextDestination(trains) {
  if (!trains?.length) return null
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  return trains.find((t) => timeToMinutes(t.depart_at) > nowMin)?.destination ?? null
}

// 역별 카드 정의
const STATION_GROUPS = [
  {
    stationName: '정왕역',
    cards: [
      { key: 'line4_up',   lineName: '4호선',    upDown: '상행', fallback: '당고개', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
      { key: 'line4_down', lineName: '4호선',    upDown: '하행', fallback: '오이도', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
      { key: 'up',         lineName: '수인분당선', upDown: '상행', fallback: '왕십리', color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
      { key: 'down',       lineName: '수인분당선', upDown: '하행', fallback: '인천',   color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
    ],
  },
  {
    stationName: '초지역',
    cards: [
      { key: 'choji_up', lineName: '서해선', upDown: '상행', fallback: '대곡/일산', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
      { key: 'choji_dn', lineName: '서해선', upDown: '하행', fallback: '원시', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
    ],
  },
  {
    stationName: '시흥시청역',
    cards: [
      { key: 'siheung_up', lineName: '서해선', upDown: '상행', fallback: '대곡/일산', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
      { key: 'siheung_dn', lineName: '서해선', upDown: '하행', fallback: '원시', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
    ],
  },
]

const ALL_CARD_DEFS = STATION_GROUPS.flatMap((g) => g.cards)

function useLastTrainWarnings(timetable) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  void tick

  if (!timetable) return []
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  return ALL_CARD_DEFS.flatMap((def) => {
    const trains = timetable[def.key] ?? []
    const status = getLastTrainStatus(trains, nowMin)
    if (!status?.isLast) return []
    const [hh, mm] = status.nextTrain.depart_at.split(':').map(Number)
    let rawMin = hh * 60 + mm
    if (rawMin < 3 * 60 && nowMin > 22 * 60) rawMin += 1440
    const diffMin = rawMin - nowMin
    if (diffMin > 30) return []
    return [{ lineName: def.lineName, upDown: def.upDown, destination: status.nextTrain.destination, diffMin }]
  })
}

function LastTrainBanner({ warnings }) {
  if (warnings.length === 0) return null
  return (
    <div className="mx-4 mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3">
      <p className="text-xs font-extrabold text-red-500 uppercase tracking-wide mb-1.5">막차 임박</p>
      <div className="flex flex-col gap-1">
        {warnings.map((w, i) => (
          <p key={i} className="text-sm text-red-700 dark:text-red-400">
            <span className="font-bold">{w.lineName} {w.upDown}</span>
            {' · '}{w.destination} 방면 — <span className="font-bold tabular-nums">{w.diffMin}분 후</span> 막차
          </p>
        ))}
      </div>
    </div>
  )
}

const STATION_TABS = STATION_GROUPS.map((g) => g.stationName)

export default function SubwayTab() {
  const [selectedKey, setSelectedKey] = useState(null)
  const [stationTab, setStationTab] = useState(STATION_TABS[0])
  const { data: timetable, loading } = useSubwayTimetable()
  const lastTrainWarnings = useLastTrainWarnings(timetable)

  const selected = selectedKey ? ALL_CARD_DEFS.find((c) => c.key === selectedKey) : null
  const trains = selected ? (timetable?.[selected.key] ?? []) : []

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextIndex = selected
    ? trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
    : -1
  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
  const { lastIdx, firstIdx } = selected ? getSpecialTrainIndices(trains) : {}

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
            {selected.lineName} · {getNextDestination(timetable?.[selected.key]) ?? selected.fallback} 방면
          </h2>
        </div>

        <SubwayCountdown nextTrain={nextTrain} lineColor={selected.color} lineDarkColor={selected.darkColor} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <SubwayTimetable
            entries={trains}
            nextIndex={nextIndex}
            lastIdx={lastIdx ?? null}
            firstIdx={firstIdx ?? null}
            lineColor={selected.color}
            lineDarkColor={selected.darkColor}
            lineLightColor={selected.lightColor}
          />
        )}
      </div>
    )
  }

  // ── 카드 목록 뷰 ─────────────────────────────────────────
  const activeGroup = STATION_GROUPS.find((g) => g.stationName === stationTab) ?? STATION_GROUPS[0]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <TrainFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">지하철</h2>
      </div>

      {/* 역 탭 */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        {STATION_TABS.map((name) => (
          <button
            key={name}
            onClick={() => setStationTab(name)}
            className={`pressable px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              stationTab === name
                ? 'bg-navy text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">불러오는 중...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
          <LastTrainBanner warnings={lastTrainWarnings} />
          <div className="p-4 flex flex-col gap-3">
            {[activeGroup].map((group) => (
              <div key={group.stationName} className="animate-fade-in">
                <div className="flex flex-col gap-3">
                  {group.cards.map((card) => {
                    const dest = getNextDestination(timetable?.[card.key]) ?? card.fallback
                    return (
                      <SubwayLineCard
                        key={card.key}
                        lineName={card.lineName}
                        dirLabel={`${card.upDown} · ${dest} 방면`}
                        color={card.color}
                        darkColor={card.darkColor}
                        lightColor={card.lightColor}
                        trains={timetable?.[card.key] ?? []}
                        onClick={() => setSelectedKey(card.key)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
