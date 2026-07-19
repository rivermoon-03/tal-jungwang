import { describe, it, expect } from 'vitest'
import { buildWeekLanes, categorizeEvent, formatDayRangeLabel } from './academicWeekLanes'

// 기준 주: 2026-07-12(일) ~ 2026-07-18(토).
const WEEK_START = '2026-07-14' // 화요일을 줘도 buildWeekGrid가 그 주 일요일로 정규화한다.

describe('categorizeEvent', () => {
  it('제목에 "수강"이 들어가면 enrollment', () => {
    expect(categorizeEvent('수강신청 미리담기')).toBe('enrollment')
    expect(categorizeEvent('재수강신청')).toBe('enrollment')
  })

  it('제목에 "졸업"/"학위"가 들어가면 degree', () => {
    expect(categorizeEvent('졸업논문 제출')).toBe('degree')
    expect(categorizeEvent('학위수여식')).toBe('degree')
  })

  it('제목에 "등록"이 들어가면 registration', () => {
    expect(categorizeEvent('등록금 납부기간')).toBe('registration')
  })

  it('매칭되는 키워드가 없으면 etc', () => {
    expect(categorizeEvent('개교기념일')).toBe('etc')
    expect(categorizeEvent('')).toBe('etc')
    expect(categorizeEvent(undefined)).toBe('etc')
  })
})

describe('buildWeekLanes — 클리핑', () => {
  it('주 경계를 넘는 일정은 그 주 안으로 클리핑한다(colStart=1, span=7)', () => {
    const events = [{ title: '기말고사', start_date: '2026-07-09', end_date: '2026-07-22' }]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes).toHaveLength(1)
    expect(lanes[0]).toMatchObject({ title: '기말고사', colStart: 1, span: 7, row: 0 })
  })

  it('주 시작 쪽 절반만 걸치는 일정은 그만큼만 클리핑한다', () => {
    // 7/10(금)~7/14(화) → 이번 주(7/12~7/18)에서는 7/12(일, col1)~7/14(화, col3).
    const events = [{ title: '수강정정', start_date: '2026-07-10', end_date: '2026-07-14' }]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes[0]).toMatchObject({ colStart: 1, span: 3 })
  })

  it('주 끝 쪽 절반만 걸치는 일정은 그만큼만 클리핑한다', () => {
    // 7/17(금)~7/25(토) → 이번 주에서는 7/17(금, col6)~7/18(토, col7).
    const events = [{ title: '방학식', start_date: '2026-07-17', end_date: '2026-07-25' }]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes[0]).toMatchObject({ colStart: 6, span: 2 })
  })

  it('단일일 일정은 span=1이고 해당 요일의 colStart를 갖는다', () => {
    // 7/15(수)는 이번 주의 4번째 칸(일=1 기준).
    const events = [{ title: '개교기념일', start_date: '2026-07-15', end_date: '2026-07-15' }]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes[0]).toMatchObject({ colStart: 4, span: 1 })
  })

  it('end_date가 없으면 start_date와 같은 단일일로 취급한다', () => {
    const events = [{ title: '개교기념일', start_date: '2026-07-15' }]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes[0]).toMatchObject({ colStart: 4, span: 1 })
  })

  it('주 밖 일정은 결과에서 제외한다', () => {
    const events = [
      { title: '지난 학기 일정', start_date: '2026-06-01', end_date: '2026-06-05' },
      { title: '다음 학기 일정', start_date: '2026-08-01', end_date: '2026-08-05' },
    ]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes).toHaveLength(0)
  })

  it('start_date가 없는 이벤트는 무시한다', () => {
    const lanes = buildWeekLanes([{ title: '잘못된 이벤트' }], WEEK_START)
    expect(lanes).toHaveLength(0)
  })
})

describe('buildWeekLanes — 겹침 분리(그리디 행 배치)', () => {
  it('겹치는 두 일정은 서로 다른 행에 배치된다', () => {
    const events = [
      { title: '수강신청 미리담기', start_date: '2026-07-13', end_date: '2026-07-15' }, // 월~수
      { title: '등록기간', start_date: '2026-07-14', end_date: '2026-07-16' }, // 화~목, 위와 겹침
    ]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes).toHaveLength(2)
    const rows = lanes.map((l) => l.row)
    expect(new Set(rows).size).toBe(2)
  })

  it('겹치지 않는 일정은 같은 행(row 0)을 공유한다', () => {
    const events = [
      { title: '수강신청', start_date: '2026-07-12', end_date: '2026-07-13' }, // 일~월
      { title: '등록기간', start_date: '2026-07-14', end_date: '2026-07-15' }, // 화~수 (겹치지 않음)
    ]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes.every((l) => l.row === 0)).toBe(true)
  })

  it('세 겹의 일정은 3개 행으로 분리된다', () => {
    const events = [
      { title: 'A', start_date: '2026-07-12', end_date: '2026-07-18' },
      { title: 'B', start_date: '2026-07-13', end_date: '2026-07-17' },
      { title: 'C', start_date: '2026-07-14', end_date: '2026-07-16' },
    ]
    const lanes = buildWeekLanes(events, WEEK_START)
    const rows = lanes.map((l) => l.row).sort()
    expect(rows).toEqual([0, 1, 2])
  })

  it('먼저 끝나는 일정 뒤로 이어지는 일정은 같은 행을 재사용한다', () => {
    const events = [
      { title: 'A', start_date: '2026-07-12', end_date: '2026-07-13' }, // 일~월, span 2
      { title: 'B', start_date: '2026-07-15', end_date: '2026-07-16' }, // 수~목(A와 안 겹침 → row0 재사용)
    ]
    const lanes = buildWeekLanes(events, WEEK_START)
    const byTitle = Object.fromEntries(lanes.map((l) => [l.title, l.row]))
    expect(byTitle.A).toBe(0)
    expect(byTitle.B).toBe(0)
  })

  it('같은 colStart면 넓은(span이 큰) 레인을 먼저 배치하고, 좁은 레인이 뒤로 밀린다', () => {
    const events = [
      { title: 'A', start_date: '2026-07-12', end_date: '2026-07-13' }, // 일~월, span 2
      { title: 'B', start_date: '2026-07-14', end_date: '2026-07-15' }, // 화~수, span 2 (A와 안 겹침)
      { title: 'C', start_date: '2026-07-12', end_date: '2026-07-16' }, // 일~목, span 5(A와 colStart 동률, 더 넓음)
    ]
    const lanes = buildWeekLanes(events, WEEK_START)
    const byTitle = Object.fromEntries(lanes.map((l) => [l.title, l.row]))
    // C가 colStart 동률 타이브레이크로 먼저 row0을 차지하고, A/B는 C와 겹쳐 row1로 밀린다.
    expect(byTitle.C).toBe(0)
    expect(byTitle.A).toBe(1)
    expect(byTitle.B).toBe(1)
  })
})

describe('buildWeekLanes — 카테고리', () => {
  it('각 레인에 categorizeEvent로 판정한 category가 포함된다', () => {
    const events = [{ title: '수강신청 미리담기', start_date: '2026-07-13', end_date: '2026-07-13' }]
    const lanes = buildWeekLanes(events, WEEK_START)
    expect(lanes[0].category).toBe('enrollment')
  })
})

describe('formatDayRangeLabel', () => {
  it('같은 날이면 "D일" 단일 표기', () => {
    expect(formatDayRangeLabel('2026-07-20', '2026-07-20')).toBe('20일')
  })

  it('endDate가 없으면 startDate와 같은 단일일로 취급한다', () => {
    expect(formatDayRangeLabel('2026-07-20', null)).toBe('20일')
  })

  it('같은 달 안이면 "D일~D일"', () => {
    expect(formatDayRangeLabel('2026-07-20', '2026-07-22')).toBe('20일~22일')
  })

  it('달이 걸치면 "M월 D일~M월 D일"', () => {
    expect(formatDayRangeLabel('2026-07-31', '2026-08-02')).toBe('7월 31일~8월 2일')
  })

  it('startDate가 없으면 빈 문자열', () => {
    expect(formatDayRangeLabel(null, '2026-07-22')).toBe('')
  })
})
