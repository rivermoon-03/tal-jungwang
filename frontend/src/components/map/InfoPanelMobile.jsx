import { useState, useEffect } from 'react'
import useAppStore from '../../stores/useAppStore'
import InfoPanelTabs from './InfoPanelTabs'
import { toMin } from '../../utils/boardingStatus'

// ── 유틸 ──────────────────────────────────────────────────────────────────

/** depart_at("HH:MM") → 현재로부터 남은 초. 이미 지났으면 null */
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

/** 03:00~12:59 → '등교', 13:00~02:59 → '하교' */
function getShuttleMode() {
  const h = new Date().getHours()
  return (h >= 3 && h < 13) ? '등교' : '하교'
}

function matchesMode(direction, mode) {
  return direction.includes(mode)
}

// ── 서브 pill 컴포넌트 ────────────────────────────────────────────────────

/** 정왕역 pill — 원형 배지로 노선 표시, 너비 절반 */
function JeongwangPill({ subwayData, busJeongwangData, walkSec, active, onClick }) {
  const sdUp   = departAtToSec(subwayData?.up?.depart_at)
  const sdDown = departAtToSec(subwayData?.down?.depart_at)
  const l4Up   = departAtToSec(subwayData?.line4_up?.depart_at)
  const l4Down = departAtToSec(subwayData?.line4_down?.depart_at)

  const minSec = getMinSec(sdUp, sdDown, l4Up, l4Down,
    busJeongwangData?.arrivals?.map((a) => a.arrive_in_seconds))
  const dotClass = getDotClass(minSec, walkSec)

  const fmt = (sec) => sec != null ? `${toMin(sec)}분` : '—'
  const val = active ? 'text-white' : 'text-slate-900'
  const arrow = active ? 'text-white/70' : 'text-slate-900'

  return (
    <button
      aria-label="정왕역"
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl shadow-lg transition-colors ${
        active ? 'bg-navy text-white' : 'bg-white text-slate-900'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-white/70' : dotClass}`} />
        <span className={`text-[15px] font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>정왕역</span>
      </div>
      <div className="flex flex-col gap-0.5 pl-[16px]">
        {/* 수인분당선 */}
        <div className="flex items-center gap-1 text-[12px]">
          <span className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-white text-[8px] font-black flex-shrink-0">수</span>
          <span className={`font-bold ${arrow}`}>↑</span>
          <span className={`tabular-nums font-bold ${val}`}>{fmt(sdUp)}</span>
          <span className={`font-bold ${arrow}`}>↓</span>
          <span className={`tabular-nums font-bold ${val}`}>{fmt(sdDown)}</span>
        </div>
        {/* 4호선 */}
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

function timeToDiffMin(timeStr) {
  if (!timeStr) return null
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [hh, mm] = timeStr.split(':').map(Number)
  const diff = hh * 60 + mm - nowMin
  return diff > 0 ? diff : null
}

/** 서울 pill — 3400·6502 다음 출발까지 N분 후 */
function SeoulPill({ seoulNextDepartures, walkSec, active, onClick }) {
  const val = active ? 'text-white' : 'text-slate-900'

  return (
    <button
      aria-label="서울"
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl shadow-lg flex-1 transition-colors ${
        active ? 'bg-navy text-white' : 'bg-white text-slate-900'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-white/70' : 'bg-slate-300'}`} />
        <span className={`text-[15px] font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>서울</span>
      </div>
      <div className={`flex flex-col gap-0.5 pl-[16px] text-[12px] font-semibold ${active ? 'text-white/85' : 'text-slate-600'}`}>
        {seoulNextDepartures.length === 0 ? (
          <span>정보 없음</span>
        ) : (
          seoulNextDepartures.map(({ route, time }) => {
            const diffMin = timeToDiffMin(time)
            return (
              <div key={route} className="flex items-center gap-1.5">
                <span className="w-[44px] flex-shrink-0 whitespace-nowrap font-bold">{route}</span>
                <span className={`tabular-nums font-bold whitespace-nowrap ${val}`}>
                  {diffMin != null ? `${diffMin}분 후` : '없음'}
                </span>
              </div>
            )
          })
        )}
      </div>
    </button>
  )
}

/** 셔틀 pill — 시간대 기반으로 등교/하교 하나만 표시 */
function ShuttlePill({ shuttleDirections, walkSec, active, onClick }) {
  const mode = getShuttleMode()   // '등교' | '하교'
  const filtered = shuttleDirections.filter((d) => matchesMode(d.direction, mode))
  const target = filtered[0] ?? null

  const minSec = target?.diffSec ?? null
  const dotClass = getDotClass(minSec, walkSec)

  return (
    <button
      aria-label="셔틀"
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3 rounded-2xl shadow-lg flex-1 transition-colors ${
        active ? 'bg-navy text-white' : 'bg-white text-slate-900'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-white/70' : dotClass}`} />
        <span className={`text-[15px] font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>셔틀</span>
      </div>
      <div className={`pl-[16px] text-[12px] font-semibold ${active ? 'text-white/85' : 'text-slate-600'}`}>
        <p className="text-[10px] mb-0.5">{mode}</p>
        <p className={`tabular-nums font-bold text-[13px] ${active ? 'text-white' : 'text-slate-900'}`}>
          {target
            ? (target.diffSec != null ? `${toMin(target.diffSec)}분` : '수시운행')
            : '없음'}
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
  walkSec,
}) {
  const [open, setOpen] = useState(false)
  const setSheetOpen = useAppStore((s) => s.setSheetOpen)

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
      {/* ── 지도 위 2줄 pill 레이아웃 ── */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-auto" style={{ maxWidth: 420 }}>
        {/* Row 1: 정왕역 (절반 너비) */}
        <JeongwangPill
          subwayData={subwayData}
          busJeongwangData={busJeongwangData}
          walkSec={walkSec}
          active={tab === 'jeongwang' && open}
          onClick={() => openTab('jeongwang')}
        />
        {/* Row 2: 서울 + 셔틀 나란히 */}
        <div className="flex gap-2">
          <SeoulPill
            seoulNextDepartures={seoulNextDepartures ?? []}
            walkSec={walkSec}
            active={tab === 'seoul' && open}
            onClick={() => openTab('seoul')}
          />
          <ShuttlePill
            shuttleDirections={shuttleDirections}
            walkSec={walkSec}
            active={tab === 'shuttle' && open}
            onClick={() => openTab('shuttle')}
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
        className={`fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl p-5 pb-8 pointer-events-auto transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-10 h-1.5 bg-slate-200 rounded-full" />
          <button
            aria-label="닫기"
            onClick={close}
            className="absolute right-0 text-slate-400 hover:text-slate-600 text-base leading-none"
          >✕</button>
        </div>
        <InfoPanelTabs
          tab={tab}
          setTab={setTab}
          subwayData={subwayData}
          busJeongwangData={busJeongwangData}
          walkSec={walkSec}
        />
      </div>
    </>
  )
}
