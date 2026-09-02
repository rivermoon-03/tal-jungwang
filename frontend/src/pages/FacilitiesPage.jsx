/**
 * FacilitiesPage — /facilities 페이지 (학교시설. 옛 주소 /cafeteria 도 그대로 연다)
 * 백엔드 형식: week_start, year, fetched_at, cafeterias[{ name, meals[{ type, time, by_day }] }]
 *
 * 상단 메인 탭: [학식 | 매장 | 도서관]
 *   - 학식: 시안1 메뉴 그리드 레이아웃
 *   - 매장: CafeteriaVenues 컴포넌트(교내 매장 운영정보)
 *   - 도서관: 열람실 개관시간(LibraryPanel) — 예전에는 홈 하단에 있어 스크롤
 *     끝까지 가야 보였다. "오늘 뭐 먹지"와 "지금 어디 열었지"는 같은 질문의
 *     변주라 한 탭에 둔다.
 */
import { useMemo, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import SegmentTabs from '../components/common/SegmentTabs'
import StationChips from '../components/ui/StationChips'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import CafeteriaVenues from '../components/cafeteria/CafeteriaVenues'
import LibrarySection from '../components/facilities/LibrarySection'
import MealGridSection from '../components/cafeteria/MealGridSection'
import NowBadge from '../components/cafeteria/NowBadge'
import DayChips from '../components/cafeteria/DayChips'
import CafeteriaPCLayout from '../components/cafeteria/CafeteriaPCLayout'
import { useCafeteriaMenu } from '../hooks/useCafeteria'
import { useIsDesktop } from '../hooks/useMediaQuery'
import {
  buildDayLabelMap,
  getTodayDayKey,
  getFirstDayKey,
  extractDayKeys,
  isKstWeekend,
  hasDayMenu,
  getNearestMenuDayKey,
  isMenuWeekStale,
} from '../utils/cafeteriaDays'
import { formatUpdated } from '../utils/cafeteriaFormat'
import { isMealTypeOpenNow } from '../utils/cafeteriaMenuVenue'
import { useNow } from '../hooks/useNow'

// 메인 탭 정의. id 는 기존 딥링크(/cafeteria?tab=diet|venues)와 PC 사이드바
// 서브내비가 쓰던 값이라 그대로 둔다 — 라벨만 탭 이름에 맞춰 바꾼다.
const MAIN_TABS = [
  { id: 'diet', label: '학식' },
  { id: 'venues', label: '매장' },
  { id: 'library', label: '도서관' },
]

export default function FacilitiesPage() {
  const { data, loading, error, refetch } = useCafeteriaMenu()
  const isDesktop = useIsDesktop()

  // 메인 탭: 식단(diet) / 운영정보(venues)
  const [mainTab, setMainTab] = useState('venues')

  const [selectedCafeteriaIdx, setSelectedCafeteriaIdx] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  // 첫 번째 cafeteria 기준으로 dayKeys 추출
  const cafeteriaForDays = data?.cafeterias?.[selectedCafeteriaIdx] ?? null

  const dayKeys = useMemo(
    () => extractDayKeys(cafeteriaForDays, data?.week_start, data?.year),
    [cafeteriaForDays, data?.week_start, data?.year]
  )

  // 1분 주기 tick — CafeteriaPCLayout과 같은 패턴(useNow가 visibility 정리 담당).
  const nowMs = useNow(60_000)
  const nowDate = useMemo(() => new Date(nowMs), [nowMs])

  // 오늘이 이번 주차 안에 있으면 그 날짜 키. 요일 칩의 "오늘" 표시와
  // 끼니 배지의 "지금" 판정이 같은 값을 본다.
  const todayKey = useMemo(
    () => getTodayDayKey(data?.week_start, data?.year, dayKeys),
    [data?.week_start, data?.year, dayKeys]
  )

  // 요일 라벨 맵 구성
  const dayLabelMap = useMemo(
    () => buildDayLabelMap(data?.week_start, data?.year, dayKeys),
    [data?.week_start, data?.year, dayKeys]
  )

  // 오늘 자동 선택 (KST 기준)
  // 오늘에 메뉴가 없으면 가장 가까운 메뉴 있는 날로 폴백.
  const effectiveDay = useMemo(() => {
    if (selectedDay && dayKeys.includes(selectedDay)) return selectedDay
    if (todayKey && hasDayMenu(cafeteriaForDays, todayKey)) return todayKey
    // 오늘 메뉴 없거나 오늘이 dayKeys에 없는 경우: 가장 가까운 메뉴 있는 날
    const nearest = getNearestMenuDayKey(data?.week_start, data?.year, dayKeys, cafeteriaForDays)
    if (nearest) return nearest
    // 메뉴 있는 날이 하나도 없으면 첫 번째 날 표시 (미운영 안내라도 보여줌)
    return getFirstDayKey(dayKeys, data?.week_start, data?.year)
  }, [selectedDay, dayKeys, todayKey, data?.week_start, data?.year, cafeteriaForDays])

  const cafeteria = data?.cafeterias?.[selectedCafeteriaIdx] ?? null
  const updatedLabel = formatUpdated(data?.fetched_at)

  // 식당 세그먼트 탭 items
  const cafeteriaTabItems = useMemo(
    () =>
      (data?.cafeterias ?? []).map((c, i) => ({
        id: String(i),
        label: c.name,
      })),
    [data?.cafeterias]
  )

  // 요일 칩 items (hasMenu: 해당 날 메뉴 존재 여부, isToday: 오늘 여부)
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

  // PC 레이아웃 분기
  if (isDesktop) {
    return <CafeteriaPCLayout data={data} loading={loading} error={error} refetch={refetch} />
  }

  return (
    <div className="flex flex-col h-full bg-surface animate-fade-in-up">
      {/* 헤더는 에러여도 항상 표시 */}
      <PageHeader title="학교시설" />

      {/* 갱신 시각 */}
      {updatedLabel && (
        <p className="px-4 -mt-2 mb-2 text-caption text-mute">
          {updatedLabel}
        </p>
      )}

      {/* 원본(주간 식단표)이 아직 다음 주를 게시하지 않아 지난주 식단이 보이는 상태 —
          이번 주 식단으로 오해하지 않게 명시한다 */}
      {mainTab === 'diet' && isMenuWeekStale(data?.week_start, data?.year, dayKeys) && (
        <div className="px-4 pb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-imminent-bg text-imminent text-caption font-semibold">
            지난주 식단 · 새 식단이 아직 게시되지 않았어요
          </span>
        </div>
      )}

      {/* 메인 탭: 학식 / 매장 / 도서관 */}
      <div className="px-4 pb-3">
        <SegmentTabs
          tabs={MAIN_TABS}
          active={mainTab}
          onChange={setMainTab}
        />
      </div>

      {/* 식단 탭 */}
      {mainTab === 'diet' && (
        <>
          {/* 식당 세그먼트 탭 — 에러여도 data가 있으면 표시 */}
          {cafeteriaTabItems.length > 0 && (
            <div className="px-4 pb-2">
              <SegmentTabs
                tabs={cafeteriaTabItems}
                active={String(selectedCafeteriaIdx)}
                onChange={(id) => {
                  setSelectedCafeteriaIdx(Number(id))
                  setSelectedDay(null)
                }}
              />
            </div>
          )}

          {/* 요일 칩 — hasMenu 없는 날은 흐리게 표시 */}
          {dayChipItems.length > 0 && (
            <div className="px-4 pb-3 flex-shrink-0 overflow-x-auto">
              <DayChips items={dayChipItems} value={effectiveDay} onChange={setSelectedDay} />
            </div>
          )}

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
            {/* 로딩 스켈레톤 */}
            {loading && !data && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-card bg-surface-2 animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* NO_MENU 에러 — 주말/평일 분기 */}
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

            {/* 기타 에러 — onRetry={refetch} 연결 */}
            {error && !data && error.code !== 'NO_MENU' && (
              <ErrorState
                message="식단표를 불러오지 못했어요"
                onRetry={refetch}
              />
            )}

            {/* 데이터 없음 */}
            {!loading && !error && data && (!cafeteria || cafeteria.meals.length === 0) && (
              <EmptyState title="현재 등록된 식단이 없어요" />
            )}

            {/* 시안1: 메뉴 그리드 섹션 */}
            {cafeteria && effectiveDay && (
              <div
                className="flex flex-col animate-fade-in"
                key={`${selectedCafeteriaIdx}:${effectiveDay}`}
              >
                {cafeteria.meals.map((meal, i) => {
                  // "지금 운영 중" 판정은 오늘을 보고 있을 때만 뜻이 있다.
                  // 다른 요일을 넘겨보는 중에 오늘 기준 배지가 붙으면 거짓말이 된다.
                  const isNow =
                    effectiveDay === todayKey &&
                    isMealTypeOpenNow(cafeteria.name, meal.type, nowDate)
                  return (
                    <MealGridSection
                      key={`${meal.type}-${i}`}
                      meal={meal}
                      dayKey={effectiveDay}
                      badge={isNow ? <NowBadge /> : null}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 매장 탭 */}
      {mainTab === 'venues' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6">
          <CafeteriaVenues
            onVenueClick={(venueId) => {
              window.history.pushState(null, '', `/cafeteria/${encodeURIComponent(venueId)}`)
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          />
        </div>
      )}

      {/* 도서관 탭 */}
      {mainTab === 'library' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6">
          <LibrarySection />
        </div>
      )}
    </div>
  )
}
