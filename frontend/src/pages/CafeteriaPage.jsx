/**
 * CafeteriaPage — /cafeteria 페이지 (학식)
 * 한국공학대 TIP 학생식당 + E동 레스토랑 주간 식단표.
 */
import { useMemo, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import SegmentTabs from '../components/common/SegmentTabs'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import { useCafeteriaMenu } from '../hooks/useCafeteria'

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

// "5.11" + 연도 + 요일 인덱스 → 'D'(day) 키
function dayKeyForToday(weekStart, year) {
  if (!weekStart || !year) return null
  const [mStr, dStr] = weekStart.split('.')
  const m = Number(mStr)
  const d = Number(dStr)
  if (!m || !d) return null
  const monday = new Date(year, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today - monday) / 86400000)
  // 0..5 (월~토). 일요일/주차 밖이면 null
  if (diffDays < 0 || diffDays > 5) return null
  return String(d + diffDays)
}

function formatUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yy}.${mm}.${dd} ${hh}:${mi} 갱신`
}

function dayLabelFromMonth(monthNum, dayKey) {
  const d = Number(dayKey)
  if (!Number.isFinite(d) || !monthNum) return `${dayKey}일`
  const date = new Date(new Date().getFullYear(), monthNum - 1, d)
  const wd = WEEKDAY_KO[date.getDay()]
  return `${d}일 (${wd})`
}

// "*복수메뉴*" 같은 안내 마커는 xlsx 원본에서 메뉴 셀에 그대로 들어 있다.
// 메뉴 항목이 아닌 메타 안내라 헤더 옆 배지로 빼서 보여준다.
const NOTE_MARKER_RE = /^\*([^*]+)\*$/

function partitionItems(items) {
  const notes = []
  const cleaned = []
  for (const it of items) {
    const m = NOTE_MARKER_RE.exec(it)
    if (m) notes.push(m[1].trim())
    else cleaned.push(it)
  }
  return { notes, cleaned }
}

function MealCard({ meal, dayKey }) {
  const rawItems = meal.by_day?.[dayKey] ?? []
  const { notes, cleaned } = partitionItems(rawItems)
  const isOff = cleaned.length === 0 && notes.length === 0
    || (cleaned.length === 1 && cleaned[0] === '미운영')

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 14,
        border: '1px solid var(--tj-line)',
        background: 'transparent',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--tj-ink)', letterSpacing: '-0.01em' }}>
          {meal.type}
        </span>
        {meal.time && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tj-mute)' }}>{meal.time}</span>
        )}
        {notes.map((note) => (
          <span
            key={note}
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 999,
              background: 'var(--tj-line-soft)',
              color: 'var(--tj-mute)',
              letterSpacing: '-0.01em',
              lineHeight: 1.4,
            }}
          >
            {note}
          </span>
        ))}
      </header>

      {isOff ? (
        <p style={{ fontSize: 13, color: 'var(--tj-mute-2)' }}>미운영</p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
          {cleaned.map((item, i) => (
            <li
              key={`${item}-${i}`}
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--tj-ink)', lineHeight: 1.4 }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function CafeteriaPage() {
  const { data, loading, error } = useCafeteriaMenu()

  const month = useMemo(() => {
    const wk = data?.week_start
    if (!wk) return null
    return Number(wk.split('.')[0]) || null
  }, [data?.week_start])

  const dayKeys = useMemo(() => {
    if (!data?.cafeterias?.length) return []
    const first = data.cafeterias[0]
    const sample = first?.meals?.[0]?.by_day ?? {}
    return Object.keys(sample).sort((a, b) => Number(a) - Number(b))
  }, [data])

  const [selectedCafeteriaIdx, setSelectedCafeteriaIdx] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  const effectiveDay = useMemo(() => {
    if (selectedDay && dayKeys.includes(selectedDay)) return selectedDay
    const today = dayKeyForToday(data?.week_start, data?.year)
    if (today && dayKeys.includes(today)) return today
    return dayKeys[0] ?? null
  }, [selectedDay, dayKeys, data?.week_start, data?.year])

  const cafeteria = data?.cafeterias?.[selectedCafeteriaIdx] ?? null
  const updatedLabel = formatUpdated(data?.fetched_at)

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark animate-fade-in-up">
      <PageHeader title="학식" />

      {updatedLabel && (
        <p className="px-4 -mt-2 mb-2 text-[11px] text-slate-400 dark:text-slate-500">
          {updatedLabel}
        </p>
      )}

      {/* 식당 선택 */}
      {data?.cafeterias?.length > 0 && (
        <div className="px-4 pb-2">
          <SegmentTabs
            size="sm"
            tabs={data.cafeterias.map((c, i) => ({ id: String(i), label: c.name }))}
            active={String(selectedCafeteriaIdx)}
            onChange={(id) => setSelectedCafeteriaIdx(Number(id))}
          />
        </div>
      )}

      {/* 요일 선택 */}
      {dayKeys.length > 0 && (
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
            {dayKeys.map((dk) => {
              const isActive = dk === effectiveDay
              return (
                <button
                  key={dk}
                  type="button"
                  onClick={() => setSelectedDay(dk)}
                  aria-pressed={isActive}
                  className="pressable whitespace-nowrap flex-shrink-0"
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    border: isActive ? '1.5px solid var(--tj-pill-active-bg)' : '1.5px solid var(--tj-line)',
                    background: isActive ? 'var(--tj-pill-active-bg)' : 'transparent',
                    color: isActive ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background var(--dur-press) var(--ease-ios), color var(--dur-press) var(--ease-ios), border-color var(--dur-press) var(--ease-ios)',
                  }}
                >
                  {dayLabelFromMonth(month, dk)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
        {loading && !data && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-[14px] bg-slate-100 dark:bg-surface-dark animate-pulse" />
            ))}
          </div>
        )}

        {error && !data && (
          <ErrorState message="식단표를 불러오지 못했어요" />
        )}

        {!loading && !error && (!cafeteria || cafeteria.meals.length === 0) && (
          <EmptyState title="현재 등록된 식단이 없어요" />
        )}

        {cafeteria && effectiveDay && (
          <div className="flex flex-col gap-2 animate-fade-in" key={`${selectedCafeteriaIdx}:${effectiveDay}`}>
            {cafeteria.meals.map((meal, i) => (
              <MealCard key={`${meal.type}-${i}`} meal={meal} dayKey={effectiveDay} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
