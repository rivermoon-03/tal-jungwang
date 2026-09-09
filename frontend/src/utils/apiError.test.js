import { describe, it, expect } from 'vitest'
import { apiErrorCode, isNoScheduleError } from './apiError'

// 학기 종료일(2026-12-22) 다음 날부터 적용되는 셔틀 운행 기간이 DB 에 없다.
// 그때 백엔드는 정상적으로 NO_SCHEDULE 실패 응답을 주는데, useApi 가 그걸
// 예외로 바꿔 보내서 통신 실패와 같은 자리로 들어온다. 갈라 두지 않으면
// 셔틀 상세가 통째로 "다시 시도" 버튼이 달린 오류 화면이 되고, 그 버튼은
// 영원히 성공하지 않는다.
describe('셔틀 상세 — 운행 기간 없음과 통신 실패 구분', () => {
  it('NO_SCHEDULE 은 오류가 아니라 상태로 말한다', () => {
    const err = Object.assign(new Error('해당 날짜에 적용되는 스케줄이 없습니다.'), {
      code: 'NO_SCHEDULE',
    })
    expect(isNoScheduleError(err)).toBe(true)
  })

  it('통신 실패는 그대로 오류다', () => {
    expect(isNoScheduleError(Object.assign(new Error('API 500'), { status: 500 }))).toBe(false)
    expect(isNoScheduleError(new Error('boom'))).toBe(false)
  })

  it('boolean 으로 뭉개진 값은 코드가 없으니 오류로 본다', () => {
    // 예전 코드가 `today.error && (...)` 로 두어 Error 객체를 잃던 자리다.
    expect(isNoScheduleError(true)).toBe(false)
    expect(isNoScheduleError(null)).toBe(false)
    expect(isNoScheduleError(undefined)).toBe(false)
  })
})

describe('apiErrorCode', () => {
  it('code 가 문자열일 때만 돌려준다', () => {
    expect(apiErrorCode(Object.assign(new Error('x'), { code: 'BUS_STATION_NOT_FOUND' })))
      .toBe('BUS_STATION_NOT_FOUND')
    expect(apiErrorCode(Object.assign(new Error('x'), { code: 500 }))).toBeNull()
    expect(apiErrorCode('문자열')).toBeNull()
  })
})
