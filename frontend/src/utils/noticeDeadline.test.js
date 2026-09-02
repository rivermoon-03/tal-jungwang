import { describe, it, expect } from 'vitest'
import { parseNoticeDeadline, formatNoticeDday, isNoticeDdayImminent } from './noticeDeadline'

describe('parseNoticeDeadline', () => {
  it('연-월-일 전체 표기를 파싱한다', () => {
    expect(parseNoticeDeadline('2026학년도 근로장학생 모집 (2026.9.15까지)')).toBe('2026-09-15')
  })

  it('월/일(요일) 까지 표기를 파싱한다', () => {
    expect(
      parseNoticeDeadline('국가장학금 2차 신청 9/15(화)까지', '2026-09-01T00:00:00+09:00')
    ).toBe('2026-09-15')
  })

  it('한글 월일 표기를 파싱한다', () => {
    expect(
      parseNoticeDeadline('교내 공모전 참가 신청 9월 15일까지', '2026-09-01T00:00:00+09:00')
    ).toBe('2026-09-15')
  })

  it('마감 표기가 없으면 null이다', () => {
    expect(parseNoticeDeadline('2026학년도 2학기 수강신청 안내')).toBeNull()
  })

  it('제목이 없으면 null이다', () => {
    expect(parseNoticeDeadline('')).toBeNull()
    expect(parseNoticeDeadline(null)).toBeNull()
  })

  it('연도 표기가 없고 게시월보다 마감월이 한참 이르면 해를 넘긴 것으로 본다', () => {
    // 12월에 올라온 "1/5까지"는 다음 해 1월.
    expect(parseNoticeDeadline('동계 계절학기 신청 1/5까지', '2026-12-20T00:00:00+09:00')).toBe(
      '2027-01-05'
    )
  })
})

describe('formatNoticeDday', () => {
  it('오늘이 마감이면 D-DAY다', () => {
    const now = new Date('2026-09-15T09:00:00+09:00')
    expect(formatNoticeDday('신청 9/15까지', '2026-09-01T00:00:00+09:00', now)).toBe('D-DAY')
  })

  it('며칠 남았으면 D-N이다', () => {
    const now = new Date('2026-09-10T09:00:00+09:00')
    expect(formatNoticeDday('신청 9/15까지', '2026-09-01T00:00:00+09:00', now)).toBe('D-5')
  })

  it('이미 마감이 지났으면 null이다(배지를 그리지 않는다)', () => {
    const now = new Date('2026-09-20T09:00:00+09:00')
    expect(formatNoticeDday('신청 9/15까지', '2026-09-01T00:00:00+09:00', now)).toBeNull()
  })

  it('마감 표기가 없으면 null이다', () => {
    expect(formatNoticeDday('수강신청 안내')).toBeNull()
  })
})

describe('isNoticeDdayImminent', () => {
  it('D-3 이내면 임박이다', () => {
    const now = new Date('2026-09-13T09:00:00+09:00')
    expect(isNoticeDdayImminent('신청 9/15까지', '2026-09-01T00:00:00+09:00', now)).toBe(true)
  })

  it('D-4 이상이면 임박이 아니다', () => {
    const now = new Date('2026-09-11T09:00:00+09:00')
    expect(isNoticeDdayImminent('신청 9/15까지', '2026-09-01T00:00:00+09:00', now)).toBe(false)
  })
})
