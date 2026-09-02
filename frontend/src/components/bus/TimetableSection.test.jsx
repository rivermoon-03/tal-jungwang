import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TimetableSection from './TimetableSection'

// 07:10 · 07:40 · 08:15 · 08:50 · 22:50 — 08:15 이후를 "지금"으로 고정해
// 07시대는 전부 과거, 08:15이 다음 차가 되도록 한다.
const TIMETABLE = {
  weekday: [
    { depart_at: '07:10' },
    { depart_at: '07:40' },
    { depart_at: '08:15' },
    { depart_at: '08:50' },
    { depart_at: '22:50' },
  ],
  saturday: [],
  sunday: [],
}

const NOW_MIN = 8 * 60 + 10 // 08:10

function renderExpanded(props = {}) {
  render(
    <TimetableSection
      timetable={TIMETABLE}
      dayTab="weekday"
      onDayTabChange={() => {}}
      nowMin={NOW_MIN}
      originStopName={null}
      onJumpToHistory={null}
      {...props}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: '전체 시간표 보기' }))
}

describe('TimetableSection — 시 그룹 + 지금 앵커', () => {
  let scrollIntoViewSpy

  beforeEach(() => {
    // jsdom은 scrollIntoView를 구현하지 않는다 — 호출 여부만 스파이로 확인.
    scrollIntoViewSpy = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy
  })

  afterEach(() => {
    delete window.HTMLElement.prototype.scrollIntoView
  })

  it('전체 시간표를 펼치면 시(hour) 그룹 헤더로 묶어 보여준다', () => {
    renderExpanded()
    // groupTimesByHour는 "HH" 두 자리 문자열을 그대로 쓴다("07", "08", "22").
    expect(screen.getByText('07시')).toBeInTheDocument()
    expect(screen.getByText('08시')).toBeInTheDocument()
    expect(screen.getByText('22시')).toBeInTheDocument()
  })

  it('다음 차(08:15) 앞에 "지금 HH:MM · 다음 N분" 앵커를 붙인다', () => {
    renderExpanded()
    // 08:10 기준 다음 차 08:15까지 5분 — eta.js(formatEta)에 위임한 라운딩과 같아야 한다.
    expect(screen.getByText('지금 08:10 · 다음 5분')).toBeInTheDocument()
    expect(screen.getByText('08:15')).toBeInTheDocument()
  })

  it('다음 차가 시(hour) 그룹 중간에 있으면 그룹 앞이 아니라 그룹 안에서 갈라 넣는다', () => {
    render(
      <TimetableSection
        timetable={{
          weekday: [{ depart_at: '09:00' }, { depart_at: '09:20' }, { depart_at: '09:40' }],
          saturday: [],
          sunday: [],
        }}
        dayTab="weekday"
        onDayTabChange={() => {}}
        nowMin={9 * 60 + 5} // 09:05 — 09:20이 다음 차, 같은 09시 그룹 중간에 위치.
        originStopName={null}
        onJumpToHistory={null}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '전체 시간표 보기' }))

    expect(screen.getAllByTestId('now-anchor-line')).toHaveLength(1)
    expect(screen.getByText('지금 09:05 · 다음 15분')).toBeInTheDocument()
  })

  it('지난 시간대(07시)는 흐리게 처리한다', () => {
    renderExpanded()
    const pastHeader = screen.getByText('07시')
    expect(pastHeader.closest('div').className).toMatch(/opacity-50/)
  })

  it('펼침 뷰가 열리면 다음 차 위치로 스크롤한다(scrollIntoView 호출)', () => {
    renderExpanded()
    expect(scrollIntoViewSpy).toHaveBeenCalled()
  })

  it('접힌 상태에서는 스크롤을 시도하지 않는다', () => {
    render(
      <TimetableSection
        timetable={TIMETABLE}
        dayTab="weekday"
        onDayTabChange={() => {}}
        nowMin={NOW_MIN}
        originStopName={null}
        onJumpToHistory={null}
      />
    )
    expect(scrollIntoViewSpy).not.toHaveBeenCalled()
  })
})
