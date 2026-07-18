import { describe, it, expect } from 'vitest'
import { resolveVenueForCafeteria, getCafeteriaStatus } from './cafeteriaMenuVenue'

// 고정 시각 — 시간 의존 없이 결정적으로 테스트한다.
// 2026-03-11(수) 12:00 KST — 학기 중 평일, TIP 학생식당 중식(11:00~14:00) 영업 중
const WEEKDAY_LUNCH = new Date('2026-03-11T12:00:00+09:00')
// 2026-03-15(일) 10:00 KST — TIP 학생식당은 일요일 휴무(closedDays: ['sunday'])
const SUNDAY = new Date('2026-03-15T10:00:00+09:00')

describe('resolveVenueForCafeteria', () => {
  it('별칭 테이블로 "TIP 학생식당"을 student-cafeteria venue에 매칭한다', () => {
    const venue = resolveVenueForCafeteria('TIP 학생식당')
    expect(venue).not.toBeNull()
    expect(venue.id).toBe('student-cafeteria')
  })

  it('별칭 테이블로 "E동 레스토랑"을 e-restaurant venue에 매칭한다', () => {
    const venue = resolveVenueForCafeteria('E동 레스토랑')
    expect(venue).not.toBeNull()
    expect(venue.id).toBe('e-restaurant')
  })

  it('별칭 테이블에 없어도 정규화(공백 제거)로 매칭한다', () => {
    const venue = resolveVenueForCafeteria(' 학생식당 ')
    expect(venue).not.toBeNull()
    expect(venue.id).toBe('student-cafeteria')
  })

  it('건물 접두어가 없는 venue.name과 공백만 다른 경우도 정규화로 매칭한다', () => {
    const venue = resolveVenueForCafeteria('E동레스토랑')
    expect(venue).not.toBeNull()
    expect(venue.id).toBe('e-restaurant')
  })

  it('매칭되는 venue가 없으면 null을 반환한다', () => {
    expect(resolveVenueForCafeteria('없는식당')).toBeNull()
  })

  it('문자열이 아니거나 빈 값이면 null을 반환한다', () => {
    expect(resolveVenueForCafeteria('')).toBeNull()
    expect(resolveVenueForCafeteria(null)).toBeNull()
    expect(resolveVenueForCafeteria(undefined)).toBeNull()
    expect(resolveVenueForCafeteria(42)).toBeNull()
  })
})

describe('getCafeteriaStatus', () => {
  it('영업 중인 시각이면 status가 open 계열이고 timeLabel에 오늘 슬롯이 담긴다', () => {
    const result = getCafeteriaStatus('TIP 학생식당', WEEKDAY_LUNCH)
    expect(result.status).toBe('open')
    expect(result.primaryLabel).toBe('영업 중')
    expect(result.location).toBe('TIP B1')
    expect(result.timeLabel).toContain('11:00 ~ 14:00')
  })

  it('휴무일이면 status가 closed_day이다', () => {
    const result = getCafeteriaStatus('TIP 학생식당', SUNDAY)
    expect(result.status).toBe('closed_day')
    expect(result.primaryLabel).toBe('오늘 휴무')
    expect(result.location).toBe('TIP B1')
  })

  it('매핑 실패 시 예외 없이 status unknown으로 폴백한다', () => {
    const result = getCafeteriaStatus('존재하지않는식당', WEEKDAY_LUNCH)
    expect(result).toEqual({
      status: 'unknown',
      primaryLabel: '정보 없음',
      location: null,
      timeLabel: null,
    })
  })

  it('cafeteriaName이 비어 있어도 throw하지 않는다', () => {
    expect(() => getCafeteriaStatus(null, WEEKDAY_LUNCH)).not.toThrow()
    expect(getCafeteriaStatus(null, WEEKDAY_LUNCH).status).toBe('unknown')
  })
})
