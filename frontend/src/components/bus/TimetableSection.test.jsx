import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import TimetableSection from './TimetableSection'
import useAppStore from '../../stores/useAppStore'

// 07:10 · 07:40 · 08:15 · 08:50 · 22:50 — 08:10을 "지금"으로 고정해
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

function renderSection(props = {}) {
  return render(
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
}

beforeEach(() => {
  // 시간표 보기 기본값(list)으로 되돌린다 — 그리드 테스트가 다음 테스트로 새지 않게.
  useAppStore.setState({ scheduleViewMode: 'list' })
})

describe('TimetableSection — 시간표 탭과 같은 시(hour) 그룹 렌더', () => {
  it('출발 시각을 접지 않고 바로 보여준다(펼침 버튼 없음)', () => {
    renderSection()
    expect(screen.getByText('08:15')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /전체 시간표/ })).not.toBeInTheDocument()
  })

  it('시(hour) 그룹 헤더에 시각과 편수를 함께 적는다', () => {
    renderSection()
    // groupItemsByHour는 "HH" 두 자리 문자열을 그대로 쓴다("07", "08", "22").
    expect(screen.getByText('07시')).toBeInTheDocument()
    expect(screen.getByText('08시')).toBeInTheDocument()
    // 07시 2편 / 08시 2편 / 22시는 막차가 속한 그룹.
    expect(screen.getAllByText('2편').length).toBe(2)
    expect(screen.getByText('1편 · 막차')).toBeInTheDocument()
  })

  it('다음 차(08:15) 앞에 "지금 HH:MM · 다음 N분" 앵커를 붙인다', () => {
    renderSection()
    // 08:10 기준 다음 차 08:15까지 5분 — eta.js(formatEta)에 위임한 라운딩과 같아야 한다.
    expect(screen.getByText('지금 08:10 · 다음 5분')).toBeInTheDocument()
  })

  it('다음 차가 시(hour) 그룹 중간에 있으면 그룹 앞이 아니라 그룹 안에서 갈라 넣는다', () => {
    renderSection({
      timetable: {
        weekday: [{ depart_at: '09:00' }, { depart_at: '09:20' }, { depart_at: '09:40' }],
        saturday: [],
        sunday: [],
      },
      nowMin: 9 * 60 + 5, // 09:05 — 09:20이 다음 차, 같은 09시 그룹 중간에 위치.
    })

    expect(screen.getAllByTestId('now-anchor-line')).toHaveLength(1)
    expect(screen.getByText('지금 09:05 · 다음 15분')).toBeInTheDocument()
  })

  it('지나간 시각 칩은 흐리게, 다음 차 칩은 accent로 채운다', () => {
    renderSection()
    // 07:10/22:50은 첫차·막차 타일에도 같은 문자열로 나오므로 중간 시각으로 고른다.
    expect(screen.getByText('07:40').parentElement.className).toMatch(/opacity-40/)
    expect(screen.getByText('08:15').parentElement.className).toMatch(/bg-accent/)
  })

  it('시간표 보기 설정이 grid면 4열 그리드로 그린다', () => {
    useAppStore.setState({ scheduleViewMode: 'grid' })
    const { container } = renderSection()
    expect(container.querySelector('.grid-cols-4')).toBeTruthy()
    expect(screen.queryByText('07시')).not.toBeInTheDocument()
    expect(screen.getByText('08:15')).toBeInTheDocument()
  })
})

describe('TimetableSection — 요약 한 줄 + 블록 순서', () => {
  it('요약 한 줄은 "{요일} 시간표 · 총 N회 · 남은 M회" 형태다(기점 정류장명 없음)', () => {
    renderSection()
    // NOW_MIN(08:10) 기준 08:15/08:50/22:50 세 편이 남는다.
    expect(screen.getByText('평일 시간표 · 총 5회 · 남은 3회')).toBeInTheDocument()
  })

  it('originStopName이 있으면 요약 한 줄 끝에 "OO 승차"를 붙인다', () => {
    renderSection({ originStopName: '강남역' })
    expect(screen.getByText('평일 시간표 · 총 5회 · 남은 3회 · 강남역 승차')).toBeInTheDocument()
  })

  it('요약 한 줄 → 3타일 → (지난 시 그룹) → 앵커 → (다음 시 그룹) 순서로 나온다', () => {
    renderSection()
    const section = screen.getByRole('region', { name: '시간표' })
    const text = section.textContent
    const summaryIdx = text.indexOf('시간표 · 총')
    const tileIdx = text.indexOf('첫차')
    const pastGroupIdx = text.indexOf('07시') // 08:15 이전 — 앵커보다 앞에 나와야 한다.
    const anchorIdx = text.indexOf('지금 08:10')
    const futureGroupIdx = text.indexOf('22시') // 08:15 이후 — 앵커보다 뒤에 나와야 한다.
    expect(summaryIdx).toBeGreaterThan(-1)
    expect(summaryIdx).toBeLessThan(tileIdx)
    expect(tileIdx).toBeLessThan(pastGroupIdx)
    expect(pastGroupIdx).toBeLessThan(anchorIdx)
    expect(anchorIdx).toBeLessThan(futureGroupIdx)
  })

  it('요일이 둘 이상이면 요일 칩이 요약 한 줄보다 앞에 나온다', () => {
    renderSection({
      timetable: {
        weekday: TIMETABLE.weekday,
        saturday: [{ depart_at: '09:00' }],
        sunday: [],
      },
    })
    const section = screen.getByRole('region', { name: '시간표' })
    const text = section.textContent
    const chipIdx = text.indexOf('토요일')
    const summaryIdx = text.indexOf('시간표 · 총')
    expect(chipIdx).toBeGreaterThan(-1)
    expect(chipIdx).toBeLessThan(summaryIdx)
  })
})

describe('TimetableSection — 심야 운행 공백', () => {
  // 00:30 다음 차가 07:00이라 390분 벌어진다 — 3400 등교 실측 패턴을 축약한 형태.
  const TIMETABLE_WITH_GAP = {
    weekday: [
      { depart_at: '00:10' },
      { depart_at: '00:30' },
      { depart_at: '07:00' },
      { depart_at: '07:30' },
      { depart_at: '07:55' },
    ],
    saturday: [],
    sunday: [],
  }

  it('심야 공백은 배차 타일에서 빠지고 별도 문구로 안내한다', () => {
    renderSection({ timetable: TIMETABLE_WITH_GAP, nowMin: 8 * 60 })
    // 남은 간격은 20, 30, 25분뿐이라 배차는 20~30분으로 나와야 한다(390분 섞이면 안 됨).
    expect(screen.getByText('20~30분')).toBeInTheDocument()
    expect(screen.getByText('00:30~07:00 운행 공백')).toBeInTheDocument()
  })

  it('심야 공백이 없으면 안내 문구를 렌더하지 않는다', () => {
    // 20분 간격으로 고르게 이어져 튀는 값이 없다 — TIMETABLE 픽스처는
    // 08:50 다음이 22:50이라(14시간 공백) 이 테스트 목적에 맞지 않아 쓰지 않는다.
    renderSection({
      timetable: {
        weekday: [
          { depart_at: '07:10' },
          { depart_at: '07:30' },
          { depart_at: '07:50' },
          { depart_at: '08:10' },
          { depart_at: '08:30' },
        ],
        saturday: [],
        sunday: [],
      },
    })
    expect(screen.queryByText(/운행 공백/)).not.toBeInTheDocument()
  })
})
