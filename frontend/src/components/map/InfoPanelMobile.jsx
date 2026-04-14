import { useState, useEffect } from 'react'
import { ChevronLeft, Info, Car, Moon, Sun, X } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import InfoPanelTabs from './InfoPanelTabs'
import { toMin } from '../../utils/boardingStatus'

// ── 유틸 ──────────────────────────────────────────────────────────────────

function departAtToSec(departAt) {
  if (!departAt) return null
  const [hh, mm] = departAt.split(':').map(Number)
  const now = new Date()
  const diff = (hh * 3600 + mm * 60) - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())
  return diff > 0 ? diff : null
}

function getDotClass(minSec, walkSec) {
  if (minSec == null || walkSec == null) return 'bg-slate-300'
  const margin = minSec - walkSec
  if (margin >= 300) return 'bg-green-500'
  if (margin >= 60)  return 'bg-yellow-400'
  return 'bg-red-500'
}

function getMinSec(...secValues) {
  const candidates = secValues.flat().filter((v) => v != null && v !== Infinity)
  return candidates.length ? Math.min(...candidates) : null
}

function getShuttleMode() {
  const h = new Date().getHours()
  return (h >= 3 && h < 13) ? 0 : 1  // 0=등교, 1=하교
}

function matchesMode(direction, mode) {
  return direction === mode
}

function timeToDiffMin(timeStr) {
  if (!timeStr) return null
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [hh, mm] = timeStr.split(':').map(Number)
  const diff = hh * 60 + mm - nowMin
  return diff > 0 ? diff : null
}

// ── 정왕역 pill ───────────────────────────────────────────────────────────

function JeongwangPill({ subwayData, busJeongwangData, walkSec, active, onClick, collapsed }) {
  const sdUp   = departAtToSec(subwayData?.up?.depart_at)
  const sdDown = departAtToSec(subwayData?.down?.depart_at)
  const l4Up   = departAtToSec(subwayData?.line4_up?.depart_at)
  const l4Down = departAtToSec(subwayData?.line4_down?.depart_at)
  const minSec = getMinSec(sdUp, sdDown, l4Up, l4Down,
    busJeongwangData?.arrivals?.map((a) => a.arrive_in_seconds))
  const dotClass = getDotClass(minSec, walkSec)
  const fmt = (sec) => {
    if (sec == null) return '—'
    const m = toMin(sec)
    return m === 0 ? '곧 출발' : `${m}분`
  }

  if (collapsed) {
    return (
      <button
        aria-label="정왕역"
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg text-[12px] font-bold transition-colors pressable ${
          active ? 'bg-navy text-white' : 'bg-white dark:bg-slate-700/90 text-slate-900 dark:text-slate-100'
        }`}
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-white/70' : dotClass}`} />
        <span className={active ? 'text-white' : 'text-slate-900 dark:text-slate-100'}>정왕역</span>
        <span className={`${active ? 'text-amber-300' : 'text-amber-500'} font-black`}>수</span>
        <span className={active ? 'text-white/90' : 'text-slate-700 dark:text-slate-200'}>↑{fmt(sdUp)} ↓{fmt(sdDown)}</span>
        <span className={`${active ? 'text-blue-300' : 'text-blue-600 dark:text-blue-400'} font-black`}>4</span>
        <span className={active ? 'text-white/90' : 'text-slate-700 dark:text-slate-200'}>↑{fmt(l4Up)} ↓{fmt(l4Down)}</span>
      </button>
    )
  }

  const val = active ? 'text-white' : 'text-slate-900 dark:text-slate-100'
  const arrow = active ? 'text-white/70' : 'text-slate-900 dark:text-slate-100'

  return (
    <button
      aria-label="정왕역"
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl shadow-lg transition-colors pressable ${
        active ? 'bg-navy text-white' : 'bg-white dark:bg-slate-700/90 text-slate-900 dark:text-slate-100'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-white/70' : dotClass}`} />
        <span className={`text-[15px] font-extrabold ${active ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>정왕역</span>
      </div>
      <div className="flex flex-col gap-0.5 pl-[16px]">
        <div className="flex items-center gap-1 text-[12px]">
          <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-white text-[8px] font-black flex-shrink-0">수</span>
          <span className={`font-bold ${arrow}`}>↑</span>
          <span className={`tabular-nums font-bold ${val}`}>{fmt(sdUp)}</span>
          <span className={`font-bold ${arrow}`}>↓</span>
          <span className={`tabular-nums font-bold ${val}`}>{fmt(sdDown)}</span>
        </div>
        <div className="flex items-center gap-1 text-[12px]">
          <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] font-black flex-shrink-0">4</span>
          <span className={`font-bold ${arrow}`}>↑</span>
          <span className={`tabular-nums font-bold ${val}`}>{fmt(l4Up)}</span>
          <span className={`font-bold ${arrow}`}>↓</span>
          <span className={`tabular-nums font-bold ${val}`}>{fmt(l4Down)}</span>
        </div>
      </div>
    </button>
  )
}

// ── 서울 pill ─────────────────────────────────────────────────────────────

function SeoulPill({ seoulNextDepartures, walkSec, active, onClick, collapsed }) {
  const val = active ? 'text-white' : 'text-slate-900 dark:text-slate-100'

  if (collapsed) {
    return (
      <button
        aria-label="서울"
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg text-[11px] font-bold transition-colors pressable ${
          active ? 'bg-navy text-white' : 'bg-white dark:bg-slate-700/90 text-slate-900 dark:text-slate-100'
        }`}
      >
        {(seoulNextDepartures ?? []).map(({ route, time }, i) => {
          const m = timeToDiffMin(time)
          return (
            <span key={route} className="flex items-center gap-1">
              {i > 0 && <span className={active ? 'text-white/40' : 'text-slate-300 dark:text-slate-600'}>/</span>}
              <span className={active ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}>{route}</span>
              <span className={active ? 'text-white' : 'text-slate-900 dark:text-slate-100'}>{m != null ? (m === 0 ? '곧 출발' : `${m}분`) : '없음'}</span>
            </span>
          )
        })}
      </button>
    )
  }

  return (
    <button
      aria-label="서울"
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl shadow-lg flex-1 transition-colors pressable ${
        active ? 'bg-navy text-white' : 'bg-white dark:bg-slate-700/90 text-slate-900 dark:text-slate-100'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-white/70' : 'bg-slate-300'}`} />
        <span className={`text-[15px] font-extrabold ${active ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>서울</span>
      </div>
      <div className={`flex flex-col gap-0.5 pl-[16px] text-[12px] font-semibold ${active ? 'text-white/85' : 'text-slate-600'}`}>
        {(seoulNextDepartures ?? []).length === 0 ? (
          <span>정보 없음</span>
        ) : (
          (seoulNextDepartures ?? []).map(({ route, time }) => {
            const diffMin = timeToDiffMin(time)
            return (
              <div key={route} className="flex items-center gap-1.5">
                <span className="w-[44px] flex-shrink-0 whitespace-nowrap font-bold">{route}</span>
                <span className={`tabular-nums font-bold whitespace-nowrap ${val}`}>
                  {diffMin != null ? (diffMin === 0 ? '곧 출발' : `${diffMin}분 후`) : '없음'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </button>
  )
}

// ── 셔틀 pill ─────────────────────────────────────────────────────────────

function ShuttlePill({ shuttleDirections, walkSec, active, onClick, collapsed }) {
  const mode = getShuttleMode()
  const filtered = (shuttleDirections ?? []).filter((d) => matchesMode(d.direction, mode))
  const target = filtered[0] ?? null
  const minSec = target?.diffSec ?? null
  const dotClass = getDotClass(minSec, walkSec)

  const haegyo = (shuttleDirections ?? []).find((d) => d.direction === 1)
  const deungyo = (shuttleDirections ?? []).find((d) => d.direction === 0)
  const fmtTarget = (t) => {
    if (!t) return '없음'
    if (t.inFrequent) return '수시운행'
    if (t.inFrequentReturn) return '수시 회차 중'
    if (t.diffSec == null) return '없음'
    const m = toMin(t.diffSec)
    return m === 0 ? '곧 출발' : `${m}분`
  }

  if (collapsed) {
    const modeTarget = mode === 1 ? haegyo : deungyo
    const modeLabel = mode === 1 ? '하교' : '등교'
    const modeTime = fmtTarget(modeTarget)
    return (
      <button
        aria-label="셔틀"
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg text-[11px] font-bold transition-colors pressable ${
          active ? 'bg-navy text-white' : 'bg-white dark:bg-slate-700/90 text-slate-900 dark:text-slate-100'
        }`}
      >
        <span className={active ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}>셔틀</span>
        <span className={active ? 'text-white/40' : 'text-slate-300 dark:text-slate-600'}>/</span>
        <span className={active ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}>{modeLabel}</span>
        <span className={active ? 'text-white' : 'text-slate-900 dark:text-slate-100'}>{modeTime}</span>
      </button>
    )
  }

  return (
    <button
      aria-label="셔틀"
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl shadow-lg flex-1 transition-colors pressable ${
        active ? 'bg-navy text-white' : 'bg-white dark:bg-slate-700/90 text-slate-900 dark:text-slate-100'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-white/70' : dotClass}`} />
        <span className={`text-[15px] font-extrabold ${active ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>셔틀</span>
      </div>
      <div className={`pl-[16px] text-[12px] font-semibold ${active ? 'text-white/85' : 'text-slate-600'}`}>
        <p className="text-[10px] mb-0.5">{mode === 1 ? '하교' : '등교'}</p>
        <p className={`font-bold text-[13px] ${active ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
          {fmtTarget(target)}
        </p>
      </div>
    </button>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export default function InfoPanelMobile({
  tab, setTab,
  subwayData, busJeongwangData, busSeoulData,
  shuttleDirections,
  seoulNextDepartures,
  walkTimes,
  timetableData,
  onInfoClick,
  isFirstVisit,
}) {
  const [open, setOpen] = useState(false)
  const [panelVisible, setPanelVisible] = useState(true)
  const setSheetOpen    = useAppStore((s) => s.setSheetOpen)
  const setActiveTab    = useAppStore((s) => s.setActiveTab)
  const darkMode        = useAppStore((s) => s.darkMode)
  const toggleDarkMode  = useAppStore((s) => s.toggleDarkMode)
  const taxiOpen        = useAppStore((s) => s.taxiOpen)
  const toggleTaxiOpen  = useAppStore((s) => s.toggleTaxiOpen)
  const setTaxiOpen     = useAppStore((s) => s.setTaxiOpen)
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)

  useEffect(() => {
    setSheetOpen(open)
    return () => setSheetOpen(false)
  }, [open, setSheetOpen])

  function openTab(id) {
    setTab(id)
    setOpen(true)
  }

  function close() {
    setOpen(false)
  }

  return (
    <>
      {/* ── 항상 고정된 제어 버튼 (토글 + 정보 + 택시 + 다크모드) ── */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          aria-label={panelVisible ? '카드 숨기기' : '카드 표시'}
          onClick={() => setPanelVisible((v) => !v)}
          className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-700/90 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 pressable"
        >
          <ChevronLeft
            size={18}
            className={`transition-transform duration-300 ${!panelVisible ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          aria-label="정보"
          onClick={onInfoClick}
          className={`w-10 h-10 rounded-full backdrop-blur-md shadow-lg border flex items-center justify-center pressable ${
            isFirstVisit
              ? 'info-btn-glow border-transparent text-white'
              : 'bg-white/90 dark:bg-slate-700/90 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300'
          }`}
        >
          <Info size={18} />
        </button>
        <button
          aria-label="학교에서 가는 시간"
          onClick={toggleTaxiOpen}
          className={`w-10 h-10 rounded-full backdrop-blur-md shadow-lg border-2 flex items-center justify-center pressable transition-colors ${
            taxiOpen
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'bg-white/90 dark:bg-slate-700/90 border-emerald-400 text-emerald-500'
          }`}
        >
          <Car size={18} strokeWidth={2} />
        </button>
        <button
          aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-full bg-white/90 dark:bg-slate-700/90 backdrop-blur-md shadow-lg border border-slate-200 dark:border-slate-600 flex items-center justify-center pressable transition-colors"
        >
          {darkMode
            ? <Sun  size={18} strokeWidth={2} className="text-yellow-400" />
            : <Moon size={18} strokeWidth={2} className="text-slate-500 dark:text-slate-300" />
          }
        </button>
      </div>

      {/* ── 카드 컨테이너 — 왼쪽으로 슬라이드 인/아웃 ── */}
      <div
        className={`absolute top-3 left-[60px] z-10 flex flex-col gap-2 transition-transform duration-300 ease-in-out ${
          panelVisible ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        style={{
          maxWidth: 420,
          transform: panelVisible ? 'translateX(0)' : 'translateX(calc(-100% - 60px))',
        }}
      >
        {/* 정왕역 */}
        <JeongwangPill
          subwayData={subwayData}
          busJeongwangData={busJeongwangData}
          walkSec={walkTimes.station}
          active={tab === 'jeongwang' && open}
          onClick={() => openTab('jeongwang')}
          collapsed
        />

        {/* 서울 + 셔틀 */}
        <div className="flex gap-2">
          <SeoulPill
            seoulNextDepartures={seoulNextDepartures ?? []}
            walkSec={walkTimes.bus}
            active={tab === 'seoul' && open}
            onClick={() => openTab('seoul')}
            collapsed
          />
          <ShuttlePill
            shuttleDirections={shuttleDirections}
            walkSec={walkTimes.shuttle}
            active={tab === 'shuttle' && open}
            onClick={() => openTab('shuttle')}
            collapsed
          />
        </div>
      </div>

      {/* 배경 dimmer */}
      <div
        data-testid="sheet-backdrop"
        className={`fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />

      {/* 하단 시트 — 슬라이드 업 */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] bg-white dark:bg-slate-900 rounded-t-2xl shadow-xl p-5 pb-8 pointer-events-auto transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-10 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
          <button
            aria-label="닫기"
            onClick={close}
            className="absolute right-0 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-base leading-none"
          ><X size={16} /></button>
        </div>
        <InfoPanelTabs
          tab={tab}
          setTab={setTab}
          subwayData={subwayData}
          busJeongwangData={busJeongwangData}
          walkTimes={walkTimes}
          timetableData={timetableData}
          onNavigate={(mainTab) => { close(); setActiveTab(mainTab) }}
        />
      </div>
    </>
  )
}
