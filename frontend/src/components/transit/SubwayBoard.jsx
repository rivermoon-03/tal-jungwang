import useAppStore from '../../stores/useAppStore'
import { useSubwayNext } from '../../hooks/useSubway'
import { navigate } from '../../lib/nav'
import LineBadge from '../kit/LineBadge'
import { Banner, Skeleton } from '../kit/bits'
import { SUBWAY_STATIONS, SUBWAY_LINES } from './subwayConfig'
import { minutesLabel, isSoon } from './format'

/** 지하철은 시간표 기준으로만 보여준다. 실시간 API 가 시간표와 자주 어긋나 걷어냈다. */
export default function SubwayBoard() {
  const station = useAppStore((s) => s.selectedSubwayStation) ?? '정왕'
  const setStation = useAppStore((s) => s.setSubwayStation)
  const { data: next, loading, error } = useSubwayNext()

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

      {SUBWAY_LINES[station].map(({ line, dirs }) => (
        <div key={line}>
          <div className="px-1 pb-2 pt-5">
            <LineBadge route={line} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {dirs.map((d) =>
              loading && !next ? (
                <Skeleton key={d.key} className="h-36 rounded-[20px]" />
              ) : (
                <DirCard key={d.key} dir={d} line={line} train={next?.[d.key]} />
              ),
            )}
          </div>
        </div>
      ))}

      <p className="pt-4 text-center text-f13 text-mute">시간표 기준</p>
    </section>
  )
}

function DirCard({ dir, line, train }) {
  const go = () => navigate(`/transit/subway/timetable?key=${dir.key}`)
  if (!train) {
    return (
      <button type="button" onClick={go} className="flex min-h-36 flex-col gap-1 rounded-[20px] border border-line bg-surface-2 p-4 text-left">
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
      className="flex min-h-36 flex-col gap-1 rounded-[20px] border border-line bg-surface p-4 text-left transition-transform duration-100 active:scale-[0.98]"
    >
      <span className="text-f14 font-extrabold text-ink-2">{dir.label}</span>
      <span className="flex items-center gap-1.5 text-f16 font-extrabold text-ink">
        {train.destination}행
        {train.is_last && <span className="rounded bg-imminent-bg px-1.5 text-f12 text-amber-900 dark:text-amber-200">막차</span>}
      </span>
      <span className={`text-f40 font-extrabold leading-none tracking-tight tabular-nums ${soon ? 'text-amber-700 dark:text-amber-400' : 'text-ink'}`}>
        {minutesLabel(train.arrive_in_seconds)}
      </span>
      <span className="text-f14 font-bold text-ink">{train.depart_at} 출발</span>
      {train.next_arrive_in_seconds != null && <span className="text-f13 text-ink-2">다음 {minutesLabel(train.next_arrive_in_seconds)}</span>}
    </button>
  )
}
