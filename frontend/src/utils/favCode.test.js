import { describe, it, expect } from 'vitest'
import { parseFavCode } from './favCode'

// 즐겨찾기 문자열은 세 세대가 공존한다. 하나라도 못 읽으면 그 별은 독 팝오버와
// PC 사이드바에서 조용히 사라진다(filter(Boolean) 에서 제거).
describe('parseFavCode', () => {
  it('신규 버스 키를 읽는다 — id 가 숫자면 routeId 로 돌려준다', () => {
    expect(parseFavCode('bus:3:하교')).toMatchObject({
      type: 'bus', routeCode: '3', category: '하교', routeId: 3,
    })
  })

  it('신규 버스 키의 id 가 노선번호일 수도 있다', () => {
    expect(parseFavCode('bus:20-1:하교')).toMatchObject({
      type: 'bus', routeCode: '20-1', category: '하교', routeId: null,
    })
  })

  it('신규 셔틀 키를 읽는다 — 예전엔 "셔틀main:등교" 가 화면에 그대로 찍혔다', () => {
    expect(parseFavCode('shuttle:main:등교')).toMatchObject({
      type: 'shuttle', title: '셔틀버스 등교',
    })
    expect(parseFavCode('shuttle:second:하교')).toMatchObject({
      type: 'shuttle', title: '2캠 셔틀버스 하교',
    })
  })

  it('레거시 셔틀 키도 계속 읽는다', () => {
    expect(parseFavCode('shuttle:2캠 하교')).toMatchObject({ type: 'shuttle', title: '2캠 셔틀버스 하교' })
    expect(parseFavCode('shuttle:등교')).toMatchObject({ type: 'shuttle', title: '셔틀버스 등교' })
  })

  it('레거시 버스 키와 순수 노선번호를 읽는다', () => {
    expect(parseFavCode('하교:3400')).toMatchObject({ type: 'bus', routeCode: '3400', category: '하교' })
    expect(parseFavCode('3400')).toMatchObject({ type: 'bus', routeCode: '3400', category: null })
  })

  it('지하철은 내부 키가 아니라 행선지로 푼다', () => {
    expect(parseFavCode('subway:정왕:up')).toMatchObject({ title: '정왕 왕십리행' })
    expect(parseFavCode('subway:정왕:down')).toMatchObject({ title: '정왕 인천행' })
  })

  it('해석할 수 없으면 null 이다', () => {
    expect(parseFavCode('')).toBeNull()
    expect(parseFavCode(null)).toBeNull()
    expect(parseFavCode('bus::하교')).toBeNull()
    expect(parseFavCode('shuttle:bogus:등교')).toBeNull()
  })
})
