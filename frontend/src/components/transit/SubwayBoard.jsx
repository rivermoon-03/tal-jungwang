import { WifiOff } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext, useSubwayRealtime, normalizeRealtimeStation } from '../../hooks/useSubway'
import { navigate } from '../../lib/nav'
import LineBadge from '../kit/LineBadge'
import Freshness from '../kit/Freshness'
import { Banner, Skeleton } from '../kit/bits'
import { SUBWAY_STATIONS, SUBWAY_LINES, realtimePosition } from './subwayConfig'
import { minutesLabel, isSoon } from './format'

export default function SubwayBoard() {
  const station = useAppStore((s) => s.selectedSubwayStation) ?? '정왕'
  const setStation = useAppStore((s) => s.setSubwayStation)
  const { data: next, loading, error, fetchedAt } = useSubwayNext()
  const { data: rtAll } = useSubwayRealtime()
  const rt = normalizeRealtimeStation(rtAll?.[station])
  const rtLive = rt.items.length > 0 && !rt.stale

  return (
    <section aria-label="지하철 도착">
      <div className="flex gap-1.5 pt-3" role="tablist" aria-label="역">
        {SUBWAY_STATIONS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={s === station}
            onClick={() => setStation(s)}
            className={`h-10 rounded-full border px-4 text-f15 font-bold ${
              s === station ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && !next && (
        <div className="mt-4">
          <Banner kind="error" title="지하철 정보를 불러오지 못했어요">잠시 뒤 다시 시도할게요.</Banner>
        </div>
      )}
      {!rtLive && next && (
        <div className="mt-4">
          <Banner Icon={WifiOff} title="실시간 연결이 끊겼어요">시간표로 보여드려요.</Banner>
        </div>
      )}

      {SUBWAY_LINES[station].map(({ line, dirs }) => (
        <div key={line}>
          <div className="flex items-center justify-between px-1 pb-2 pt-5">
            <LineBadge route={line} />
            {rtLive && <Freshness fetchedAt={fetchedAt} label="" />}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {dirs.map((d) =>
              loading && !next ? (
                <Skeleton key={d.key} className="h-40 rounded-[20px]" />
              ) : (
                <DirCard key={d.key} dir={d} line={line} train={next?.[d.key]} position={rtLive ? realtimePosition(rt.items, line, d.rt) : null} />
              ),
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

function DirCard({ dir, line, train, position }) {
  const go = () => navigate(`/transit/subway/timetable?key=${dir.key}`)
  if (!train) {
    return (
      <button type="button" onClick={go} className="flex min-h-40 flex-col gap-1 rounded-[20px] border border-line bg-surface-2 p-4 text-left">
        <span className="text-f14 font-extrabold text-ink-2">{dir.label}</span>
        <span className="text-f17 font-extrabold text-ink-2">오늘 운행이 끝났어요</span>
      </button>
    )
  }
  const soon = isSoon(train.arrive_in_seconds)
  return (
    <button
      type="button"
      onClick={go}
      aria-label={`${line} ${dir.label} 시간표`}
      className="flex min-h-40 flex-col gap-1 rounded-[20px] border border-line bg-surface p-4 text-left active:scale-[0.98] transition-transform duration-100"
    >
      <span className="text-f14 font-extrabold text-ink-2">{dir.label}</span>
      <span className="flex items-center gap-1.5 text-f16 font-extrabold text-ink">
        {train.destination}행
        {train.is_last && <span className="rounded bg-imminent-bg px-1.5 text-f12 text-amber-900 dark:text-amber-200">막차</span>}
      </span>
      <span className={`text-f40 font-extrabold leading-none tracking-tight tabular-nums ${soon ? 'text-amber-700 dark:text-amber-400' : 'text-ink'}`}>
        {minutesLabel(train.arrive_in_seconds)}
      </span>
      <span className={`text-f15 font-extrabold ${position ? 'text-ink' : 'text-mute'}`}>{position ?? '시간표 기준'}</span>
      {train.next_arrive_in_seconds != null && (
        <span className="text-f13 text-ink-2">다음 {minutesLabel(train.next_arrive_in_seconds)}</span>
      )}
    </button>
  )
}
