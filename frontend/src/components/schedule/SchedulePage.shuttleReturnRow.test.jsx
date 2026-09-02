/**
 * SchedulePage — 셔틀 목록 회차편 행 회귀 테스트 (결함 6).
 *
 * 버그: /schedule 셔틀 목록에서 등교 행이 회차편일 때, 시각 칸에 실제
 * depart_at이 있는데도 이를 버리고 "회차편 탑승"이라는 상태 문구만 넣었다.
 * 오른쪽 부제(subtitle)도 같은 문구를 그대로 반복해 같은 칸이 한 행은 시각,
 * 한 행은 상태 문구를 담는 비일관성이 있었다.
 *
 * 이 테스트는 curl로 확인한 실제 백엔드 응답 스키마(depart_at + note:
 * "회차편 · 학교 HH:MM 출발")를 그대로 고정값으로 재현해, 시각 칸에 실제
 * depart_at이 뜨고 "회차편"이라는 사실은 부제로만 옮겨져 시각 칸과
 * 중복되지 않는지 확인한다. SchedulePage.jsx 전체를 새로 mount하는 무거운
 * 테스트라 기존 SchedulePage.test.jsx의 공유 mock과 섞이지 않도록 별도
 * 파일로 둔다.
 */
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import SchedulePage from './SchedulePage'

const SHUTTLE_SCHEDULE_FIXTURE = {
  schedule_type: 'SEMESTER',
  schedule_name: '2026학년도 2학기',
  is_holiday: false,
  holiday_name: null,
  directions: [
    {
      direction: 0,
      times: [
        { depart_at: '19:15', note: null, variant: null },
        { depart_at: '19:40', note: '회차편 · 학교 19:30 출발', variant: null },
        { depart_at: '19:55', note: '회차편 · 학교 19:45 출발', variant: null },
      ],
    },
    {
      direction: 1,
      times: [
        { depart_at: '19:20', note: null, variant: null },
        { depart_at: '19:35', note: null, variant: null },
      ],
    },
  ],
}

vi.mock('../../hooks/useShuttle', () => ({
  useShuttleSchedule: () => ({ data: SHUTTLE_SCHEDULE_FIXTURE, loading: false, error: null }),
  useShuttlePeriods: () => ({ data: { periods: [] }, loading: false }),
}))

vi.mock('../../hooks/useSubway', () => ({
  useSubwayTimetable: () => ({ data: null, loading: false }),
  useSubwayNext: () => ({ data: null, loading: false }),
}))

vi.mock('../../hooks/useBus', () => ({
  useBusCommuteContexts: () => ({ data: [], loading: false }),
  useBusRoutesByCategory: () => ({ data: [], loading: false }),
  useBusTimetable: () => ({ data: null, loading: false }),
  useBusTimetableByRoute: () => ({ data: null, loading: false }),
  useBusArrivals: () => ({ data: null, loading: false }),
  useBusHistoryPreview: () => ({ data: null, loading: false }),
  useBusArrivalStats: () => ({ data: null, loading: false }),
}))

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      selectedMode: 'shuttle',
      setSelectedMode: vi.fn(),
      selectedShuttleCampus: 'main',
      setShuttleCampus: vi.fn(),
      scheduleHint: null,
      setScheduleHint: vi.fn(),
      favorites: { routes: [], stations: [], venues: [], keys: [] },
      toggleFavoriteKey: vi.fn(),
      setMapPanTarget: vi.fn(),
      setSubwayDetailSheet: vi.fn(),
      scheduleViewMode: 'list',
      setScheduleViewMode: vi.fn(),
    }),
}))

beforeEach(() => {
  window.history.replaceState({}, '', '/schedule?type=shuttle')
  // 2026-09-01은 평일(화)이라 본캠 셔틀 미운행일 폴백 분기를 타지 않는다.
  // 19:32에 열었을 때 등교(direction 0)의 다음 편이 19:40 회차편이 되도록 고정한다.
  vi.setSystemTime(new Date(2026, 8, 1, 19, 32, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SchedulePage — 셔틀 목록 회차편 행(결함 6)', () => {
  it('등교 행의 시각 칸에는 회차편의 실제 depart_at이 뜨고, "회차편" 문구는 부제로만 옮겨진다', () => {
    render(<SchedulePage />)

    const outboundCard = screen.getAllByText('셔틀 등교')[0].closest('[role="button"]')
    expect(outboundCard).toBeTruthy()

    const timeColumn = within(outboundCard).getByTestId('schedule-time-column')
    // 시각 칸에는 depart_at(19:40)이 그대로 떠야 한다 — "회차편"/"탑승" 같은
    // 상태 문구가 아니라 실제 시각이어야 한다(결함 6).
    expect(timeColumn).toHaveTextContent('19:40')
    expect(timeColumn).not.toHaveTextContent('탑승')

    // "회차편"이라는 사실은 카드 안 어딘가(부제)에는 남아 있어야 하되,
    // 시각 칸 문구를 그대로 반복해서는 안 된다(같은 문구 두 칸 중복 금지).
    expect(outboundCard).toHaveTextContent('회차편')
    expect(timeColumn).not.toHaveTextContent('회차편')
  })

  it('하교 행은 회차편이 아니므로 그대로 실제 시각(19:35)과 카운트다운을 보여준다', () => {
    // 19:20은 now(19:32)보다 과거라 futureEntries에서 걸러지고, 다음 편인
    // 19:35(3분 뒤)이 첫 행으로 뜬다 — 이 테스트는 회차편이 아닌 일반 행이
    // 기존 카운트다운 표시를 그대로 유지하는지(회귀 없음)만 확인한다.
    render(<SchedulePage />)

    const inboundCard = screen.getAllByText('셔틀 하교')[0].closest('[role="button"]')
    expect(inboundCard).toBeTruthy()

    const timeColumn = within(inboundCard).getByTestId('schedule-time-column')
    expect(timeColumn).toHaveTextContent('19:35')
    expect(timeColumn).toHaveTextContent('3분')
  })
})
