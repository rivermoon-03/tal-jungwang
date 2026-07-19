import { describe, it, expect } from 'vitest'
import { searchEntries } from './searchIndex'

describe('searchEntries', () => {
  it('빈 질의는 빈 배열', () => {
    expect(searchEntries('')).toEqual([])
    expect(searchEntries('   ')).toEqual([])
  })

  it('숫자 부분일치: "34" → 3400/3401 노선', () => {
    const ids = searchEntries('34').map((e) => e.id)
    expect(ids).toContain('3400')
    expect(ids).toContain('3401')
    // 무관한 노선(20-1, 5602 등)은 섞이지 않는다
    expect(ids).not.toContain('5602')
    expect(ids).not.toContain('20-1')
  })

  it('노선번호는 모두 type=route', () => {
    const results = searchEntries('34')
    expect(results.every((e) => e.type === 'route')).toBe(true)
  })

  it('"정왕" → 정왕역(지하철)이 결과에 포함된다', () => {
    const results = searchEntries('정왕')
    const subway = results.find((e) => e.type === 'subway' && e.id === '정왕')
    expect(subway).toBeTruthy()
    expect(subway.label).toBe('정왕역')
  })

  it('정류장 표시명으로도 검색된다: "본캠" → 한국공학대 정류장', () => {
    const results = searchEntries('본캠')
    const station = results.find((e) => e.type === 'station' && e.id === '한국공학대')
    expect(station).toBeTruthy()
    expect(station.label).toBe('본캠')
  })

  it('"셔틀" → 셔틀 등교/하교 엔트리가 포함된다', () => {
    const results = searchEntries('셔틀')
    expect(results.some((e) => e.type === 'shuttle')).toBe(true)
  })

  it('일치 결과가 없으면 빈 배열', () => {
    expect(searchEntries('존재하지않는검색어xyz')).toEqual([])
  })

  it('최대 8건까지만 반환한다', () => {
    // "역"은 대부분의 지하철 엔트리 label에 포함되어 많은 매치를 만든다
    const results = searchEntries('역')
    expect(results.length).toBeLessThanOrEqual(8)
  })

  it('id 완전/접두 일치가 라벨/키워드 일치보다 먼저 온다', () => {
    const results = searchEntries('시흥33')
    expect(results[0]?.id).toBe('시흥33')
  })
})
