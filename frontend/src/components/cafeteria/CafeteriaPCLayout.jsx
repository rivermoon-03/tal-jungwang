/**
 * CafeteriaPCLayout.jsx — /cafeteria PC 전폭 콘텐츠
 *
 * 예전엔 좌측 CafeteriaVenueRail(식당 카드 세로 목록, 300px 고정폭)을 별도
 * 컬럼으로 두고 있었지만, 전역 PCSidebar가 컨텍스트 서브내비(식단/운영정보)를
 * 맡게 되면서 이 rail은 PCSidebar와 중복되는 세 번째 컬럼이 됐다. 이제
 * mainTab은 store(useAppStore.pcCafeteriaTab)가 단일 출처이고, 식당(venue)
 * 선택만 이 컴포넌트 안에서 전폭 가로 chips로 처리한다.
 *
 * 데이터 훅(useCafeteriaMenu)은 호출부(CafeteriaPage)가 그대로 넘겨준다 —
 * 이 컴포넌트는 표시 레이아웃만 담당한다.
 */
import { useMemo, useState } from 'react'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import MealGridSection from './MealGridSection'
import CafeteriaVenues from './CafeteriaVenues'
import LibrarySection from '../facilities/LibrarySection'
import useAppStore from '../../stores/useAppStore'
import { useNow } from '../../hooks/useNow'
import DayChips from './DayChips'
import { formatUpdated } from '../../utils/cafeteriaFormat'
import { isMealTypeOpenNow, getCafeteriaStatus, isCafeteriaStatusOpen } from '../../utils/cafeteriaMenuVenue'
import {
  buildDayLabelMap,
  getTodayDayKey,
  getFirstDayKey,
  extractDayKeys,
  isKstWeekend,
  hasDayMenu,
  getNearestMenuDayKey,
} from '../../utils/cafeteriaDays'

function navigateToVenueDetail(venueId) {
  window.history.pushState(null, '', `/cafeteria/${encodeURIComponent(venueId)}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** 운영상태 pill — CafeteriaVenueRail의 StatusPill과 동일한 표시 규칙(unknown이면 숨김). */
function StatusPill({ status, primaryLabel }) {
  if (status === 'unknown') return null
  const isOpen = isCafeteriaStatusOpen(status)
  return (
    <span
      className={[
        'inline-flex items-center justify-center flex-shrink-0',
        'px-2 py-0.5 rounded-pill text-caption font-semibold whitespace-nowrap',
        isOpen ? 'bg-chip-green-bg text-chip-green-fg' : 'bg-chip-red-bg text-chip-red-fg',
      ].join(' ')}
    >
      {isOpen ? '운영 중' : (primaryLabel || '운영 종료')}
    </span>
  )
}

/** 식당 선택 — 가로 chips. 세로 rail(300px 컬럼) 대신 전폭 콘텐츠 상단에 둔다. */
function VenueChip({ name, isSelected, onSelect, nowDate }) {
  const status = getCafeteriaStatus(name, nowDate)
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className={[
        'inline-flex items-center gap-2 flex-shrink-0',
        'h-[42px] px-4 rounded-pill border',
        'text-label font-semibold whitespace-nowrap select-none',
        'transition-colors duration-press',
        isSelected
          ? 'border-accent bg-accent-bg text-accent-ink'
          : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
      ].join(' ')}
      style={{ touchAction: 'manipulation' }}
    >
      {name}
      <StatusPill status={status.status} primaryLabel={status.primaryLabel} />
    </button>
  )
}

export default function CafeteriaPCLayout({ data, loading, error, refetch }) {
  // 1분 주기 tick — CafeteriaVenues.jsx와 동일 패턴(useNow가 visibility 정리 담당).
  const nowMs = useNow(60_000)
  const nowDate = useMemo(() => new Date(nowMs), [nowMs])

  // mainTab(식단/운영정보)의 단일 출처는 store다(PCSidebar 컨텍스트 서브내비와
  // 공유). store 필드가 없는 환경(단독 렌더 테스트 등)에서는 로컬 상태로
  // 자연히 폴백한다 — MorePCLayout.pcMoreNav와 동일한 패턴.
  // mainTab 전환 UI(구 상단 세그먼트)는 PCSidebar 컨텍스트 서브내비로 이관돼
  // 이 컴포넌트 안에는 더 이상 스위처가 없다 — store 값을 그대로 읽기만 한다.
  // store 필드가 없는 환경(단독 렌더 테스트 등)에서는 기본값 'diet'로 폴백한다.
  const pcCafeteriaTab = useAppStore((s) => s.pcCafeteriaTab)
  const mainTab = pcCafeteriaTab ?? 'diet'

  const [selectedVenueIdx, setSelectedVenueIdx] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  const updatedLabel = formatUpdated(data?.fetched_at)

  const cafeteriaForDays = data?.cafeterias?.[selectedVenueIdx] ?? null

  const dayKeys = useMemo(
    () => extractDayKeys(cafeteriaForDays, data?.week_start, data?.year),
    [cafeteriaForDays, data?.week_start, data?.year]
  )

  const dayLabelMap = useMemo(
    () => buildDayLabelMap(data?.week_start, data?.year, dayKeys),
    [data?.week_start, data?.year, dayKeys]
  )

  // 오늘 자동 선택 + 폴백 — 모바일 CafeteriaPage.jsx와 동일 로직.
  const effectiveDay = useMemo(() => {
    if (selectedDay && dayKeys.includes(selectedDay)) return selectedDay
    const today = getTodayDayKey(data?.week_start, data?.year, dayKeys)
    if (today && hasDayMenu(cafeteriaForDays, today)) return today
    const nearest = getNearestMenuDayKey(data?.week_start, data?.year, dayKeys, cafeteriaForDays)
    if (nearest) return nearest
    return getFirstDayKey(dayKeys, data?.week_start, data?.year)
  }, [selectedDay, dayKeys, data?.week_start, data?.year, cafeteriaForDays])

  const cafeteria = data?.cafeterias?.[selectedVenueIdx] ?? null

  const todayKey = useMemo(
    () => getTodayDayKey(data?.week_start, data?.year, dayKeys),
    [data?.week_start, data?.year, dayKeys]
  )

  const dayChipItems = useMemo(
    () =>
      dayKeys.map((dk) => ({
        id: dk,
        label: dayLabelMap[dk] ?? `${dk}일`,
        hasMenu: hasDayMenu(cafeteriaForDays, dk),
        isToday: dk === todayKey,
      })),
    [dayKeys, dayLabelMap, cafeteriaForDays, todayKey]
  )

  // 상단 바 좌측 타이틀 — 식당명이 아니라 지금 보고 있는 날짜다. 식당은
  // 우측 세그먼트가 이미 알려준다.
  //
  // 결함: 예전엔 data?.source_file(학교가 올린 엑셀 원본 파일명, 예:
  // "학생식당,E동레스토랑식단표(08.31).xlsx")을 갱신 시각 옆에 그대로 붙였다.
  // 파일명은 내부 수집 과정의 흔적일 뿐 사용자가 읽을 정보가 아니고,
  // 파일명에 박힌 날짜가 지금 보는 주(week_start)와 어긋나 보이면 오히려
  // 혼란을 준다. 모바일(FacilitiesPage)은 애초에 갱신 시각만 보여준다 —
  // PC도 같은 표기로 맞춘다.
  const dateTitle = dayLabelMap[effectiveDay] ?? null

  function handleSelectVenue(idx) {
    setSelectedVenueIdx(idx)
    setSelectedDay(null)
  }

  if (mainTab === 'library') {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-bg px-8 py-6">
        <div className="max-w-[720px]">
          <LibrarySection />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-surface">
      {mainTab === 'venues' ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-bg px-8 py-6">
          <div className="max-w-[1000px]">
            <CafeteriaVenues onVenueClick={navigateToVenueDetail} />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto bg-bg px-8 py-6">
          <div className="max-w-[1240px] flex flex-col gap-4">
            {/* 상단 바: 좌측 날짜 제목 + 갱신 시각, 우측 식당 세그먼트(전폭
                가로 chips — 예전 좌측 rail 대체). 요일 칩은 이 아래 전체 폭. */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-head font-bold text-ink">
                  {dateTitle ? `${dateTitle} 식단` : '식단'}
                </h2>
                {updatedLabel && (
                  <p className="mt-1 text-caption text-mute">{updatedLabel}</p>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(data?.cafeterias ?? []).map((c, idx) => (
                  <VenueChip
                    key={c.name}
                    name={c.name}
                    isSelected={idx === selectedVenueIdx}
                    onSelect={() => handleSelectVenue(idx)}
                    nowDate={nowDate}
                  />
                ))}
              </div>
            </div>

            {/* 요일 칩 — 전체 폭 */}
            {dayChipItems.length > 0 && (
              <div className="overflow-x-auto">
                <DayChips items={dayChipItems} value={effectiveDay} onChange={setSelectedDay} />
              </div>
            )}

            {/* 로딩 스켈레톤 */}
            {loading && !data && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 rounded-card bg-surface-2 animate-pulse" />
                ))}
              </div>
            )}

            {/* NO_MENU 에러 — 주말/평일 분기 (모바일과 동일 조건) */}
            {error && !data && error.code === 'NO_MENU' && (
              isKstWeekend() ? (
                <EmptyState
                  title="주말에는 학식을 운영하지 않아요"
                  desc="평일에 다시 확인해 주세요."
                />
              ) : (
                <EmptyState
                  title="지금은 등록된 식단이 없어요"
                  desc="방학 기간이거나 아직 식단이 올라오지 않았을 수 있어요."
                  action={{ label: '다시 확인', onClick: refetch }}
                />
              )
            )}

            {/* 기타 에러 */}
            {error && !data && error.code !== 'NO_MENU' && (
              <ErrorState message="식단표를 불러오지 못했어요" onRetry={refetch} />
            )}

            {/* 데이터 없음 */}
            {!loading && !error && data && (!cafeteria || cafeteria.meals.length === 0) && (
              <EmptyState title="현재 등록된 식단이 없어요" />
            )}

            {/* 끼니 그리드 — 1280px 폭이면 xl:grid-cols-3이 실제로 3열을 쓴다.
                items-start를 주지 않으면 메뉴가 2개뿐인 조식 카드가 석식 높이까지
                늘어나 카드 안이 통째로 빈칸이 된다. "지금" 판정은 오늘 요일을 보고
                있을 때만(showLiveStatus) 뜻이 있다 — 모바일 FacilitiesPage와 같은 규칙. */}
            {cafeteria && effectiveDay && (
              <div
                key={`${selectedVenueIdx}:${effectiveDay}`}
                className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-[14px] items-start animate-fade-in"
              >
                {cafeteria.meals.map((meal, i) => {
                  const showLiveStatus = effectiveDay === todayKey
                  const isNowOpen =
                    showLiveStatus && isMealTypeOpenNow(cafeteria.name, meal.type, nowDate)
                  return (
                    <MealGridSection
                      key={`${meal.type}-${i}`}
                      meal={meal}
                      dayKey={effectiveDay}
                      isNowOpen={isNowOpen}
                      showLiveStatus={showLiveStatus}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
