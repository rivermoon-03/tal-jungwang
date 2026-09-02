import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ShuttleTimetableGroups from './ShuttleTimetableGroups'
import { annotateShuttleEntries, buildShuttleGroups } from './shuttleSchedule'

const NOW = new Date(2026, 8, 1, 9, 45)

describe('ShuttleTimetableGroups — 수시운행 블록', () => {
  it('묶음 블록 배경과 "10분 간격 수시운행" 라벨을 먼저 보여주고 개별 시각을 나열한다', () => {
    const entries = annotateShuttleEntries(
      [
        { depart_at: '08:40', note: '수시운행' },
        { depart_at: '08:50', note: '수시운행' },
        { depart_at: '09:00', note: '수시운행' },
      ],
      '09:45'
    )
    const groups = buildShuttleGroups(entries)
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor={false} />)
    expect(screen.getByText('10분 간격 수시운행')).toBeTruthy()
    expect(screen.getByText('08:40')).toBeTruthy()
    expect(screen.getByText('08:50')).toBeTruthy()
    expect(screen.getByText('09:00')).toBeTruthy()
  })
})

describe('ShuttleTimetableGroups — 회차편 블록', () => {
  const returnEntries = annotateShuttleEntries(
    [
      { depart_at: '17:10', note: '회차편 · 학교 18:00 출발' },
      { depart_at: '17:40', note: '회차편 · 학교 수시운행 출발' },
    ],
    '00:00'
  )
  const groups = buildShuttleGroups(returnEntries)

  it('등교(isOutbound) 방향에서는 승차 안내를 블록 상단에 보여준다', () => {
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor={false} isOutbound />)
    expect(screen.getByText('정왕역 파리바게뜨 건너편 승차')).toBeTruthy()
  })

  it('하교 방향에서는 승차 안내를 보여주지 않는다', () => {
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor={false} isOutbound={false} />)
    expect(screen.queryByText('정왕역 파리바게뜨 건너편 승차')).toBeNull()
  })

  it('원편 시각이 정해져 있으면 "학교 HH:MM 출발"을 부제로 병기한다', () => {
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor={false} isOutbound />)
    expect(screen.getByText('학교 18:00 출발')).toBeTruthy()
  })

  it('원편이 수시운행 중이면 "수시운행 회차"를 부제로 병기한다', () => {
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor={false} isOutbound />)
    expect(screen.getByText('수시운행 회차')).toBeTruthy()
  })

  it('막차(마지막 회차편)에는 "막차" 배지를 붙인다', () => {
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor={false} isOutbound />)
    expect(screen.getByText('막차')).toBeTruthy()
  })
})

describe('ShuttleTimetableGroups — 시(hour) 그룹 + "지금" 앵커', () => {
  it('"다음" 항목(그룹 중간/마지막)이 있으면 그 항목 바로 앞에 "지금" 앵커를 끼워 넣는다(결함 4)', () => {
    // 09:00 09:20 09:48(다음) 은 같은 09시 그룹, 10:10은 다음 10시 그룹.
    // 예전에는 09시 그룹이 통째로 끝난 뒤(=09:48 바로 뒤)에 앵커를 넣어
    // 09:48이 앵커보다 위(과거 쪽)에 그려지는 결함이 있었다. 이제는 09:48
    // 바로 앞(09:20과 09:48 사이)에 앵커가 와야 한다.
    const entries = annotateShuttleEntries(['09:00', '09:20', '09:48', '10:10'], '09:45')
    const groups = buildShuttleGroups(entries)
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor />)
    const anchor = screen.getByTestId('now-anchor-line')
    expect(anchor.textContent).toContain('지금 09:45')
    expect(anchor.textContent).toContain('다음 3분')

    const chip0920 = screen.getByText('09:20')
    const chip0948 = screen.getByText('09:48')
    expect(chip0920.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(anchor.compareDocumentPosition(chip0948) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // 09시 헤더는 그룹이 쪼개져도 하나만 렌더된다.
    expect(screen.getAllByText('09시')).toHaveLength(1)
  })

  it('showAnchor가 false면(폴백·미리보기 모드) "지금" 앵커를 숨긴다', () => {
    const entries = annotateShuttleEntries(['09:00', '09:20', '09:48'], '09:45')
    const groups = buildShuttleGroups(entries)
    render(<ShuttleTimetableGroups groups={groups} now={NOW} showAnchor={false} />)
    expect(screen.queryByTestId('now-anchor-line')).toBeNull()
  })

  it('nextRef를 "다음" 칩에 연결한다', () => {
    let ref = null
    const entries = annotateShuttleEntries(['09:00', '09:48'], '09:45')
    const groups = buildShuttleGroups(entries)
    render(
      <ShuttleTimetableGroups
        groups={groups}
        now={NOW}
        showAnchor
        nextRef={(el) => { ref = el }}
      />
    )
    expect(ref).not.toBeNull()
    expect(ref.textContent).toContain('09:48')
  })
})
