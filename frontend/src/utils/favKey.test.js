import { describe, it, expect } from 'vitest'
import { makeFavKey, parseFavKey, matchesLegacy, allFavoriteCodes } from './favKey'

describe('makeFavKey', () => {
  it('mode:id:direction 형태로 조립한다', () => {
    expect(makeFavKey({ mode: 'bus', id: '3', direction: '하교' })).toBe('bus:3:하교')
  })

  it('subway 예시', () => {
    expect(makeFavKey({ mode: 'subway', id: 'suin', direction: 'up' })).toBe('subway:suin:up')
  })

  it('shuttle 예시', () => {
    expect(makeFavKey({ mode: 'shuttle', id: 'main', direction: '등교' })).toBe('shuttle:main:등교')
  })

  it('direction 생략 시 빈 문자열로 채운다(세 세그먼트 유지)', () => {
    expect(makeFavKey({ mode: 'bus', id: '20-1' })).toBe('bus:20-1:')
  })

  it('mode를 소문자로 정규화한다', () => {
    expect(makeFavKey({ mode: 'BUS', id: '3', direction: '하교' })).toBe('bus:3:하교')
  })

  it('id/mode 앞뒤 공백을 다듬는다', () => {
    expect(makeFavKey({ mode: ' bus ', id: ' 3 ', direction: '하교' })).toBe('bus:3:하교')
  })
})

describe('parseFavKey', () => {
  it('makeFavKey 결과를 되돌린다(round-trip)', () => {
    const key = makeFavKey({ mode: 'bus', id: '3', direction: '하교' })
    expect(parseFavKey(key)).toEqual({ mode: 'bus', id: '3', direction: '하교' })
  })

  it('direction 없는 키는 direction:null로 파싱한다', () => {
    expect(parseFavKey('bus:20-1:')).toEqual({ mode: 'bus', id: '20-1', direction: null })
  })

  it('콜론이 부족한(레거시 가능성 있는) 문자열은 null', () => {
    expect(parseFavKey('20-1')).toBeNull()
    expect(parseFavKey('하교:20-1')).toBeNull()
  })

  it('빈 문자열/비문자열은 null', () => {
    expect(parseFavKey('')).toBeNull()
    expect(parseFavKey(null)).toBeNull()
    expect(parseFavKey(undefined)).toBeNull()
  })
})

describe('matchesLegacy — 회귀 버그 재현: 별 저장 "20-1" vs 필터 비교 "하교:20-1"', () => {
  it('순수 노선번호로 저장된 즐겨찾기를 routeNumber로 매칭한다', () => {
    const favList = ['20-1']
    expect(matchesLegacy(favList, { routeNumber: '20-1' })).toBe(true)
  })

  it('"${busGroup}:${routeNo}" 레거시 형태도 routeNumber로 매칭한다', () => {
    const favList = ['하교:20-1']
    expect(matchesLegacy(favList, { routeNumber: '20-1' })).toBe(true)
  })

  it('서울행 등 다른 busGroup 접두사도 매칭한다', () => {
    const favList = ['버스 - 서울행:3400']
    expect(matchesLegacy(favList, { routeNumber: '3400' })).toBe(true)
  })

  it('신규 favKey는 정확히 일치할 때만 매칭한다', () => {
    const key = makeFavKey({ mode: 'bus', id: '3', direction: '하교' })
    expect(matchesLegacy([key], { favKey: key })).toBe(true)
    expect(matchesLegacy(['bus:3:등교'], { favKey: key })).toBe(false)
  })

  it('routeNumber와 favKey를 함께 넘기면 둘 중 하나만 맞아도 true', () => {
    const favList = ['20-1']
    const key = makeFavKey({ mode: 'bus', id: '3', direction: '하교' })
    expect(matchesLegacy(favList, { routeNumber: '20-1', favKey: key })).toBe(true)
  })

  it('일치하는 값이 없으면 false', () => {
    expect(matchesLegacy(['20-1'], { routeNumber: '99-9' })).toBe(false)
    expect(matchesLegacy([], { routeNumber: '20-1' })).toBe(false)
    expect(matchesLegacy(undefined, { routeNumber: '20-1' })).toBe(false)
  })

  it('routeNumber/favKey 둘 다 없으면 false', () => {
    expect(matchesLegacy(['20-1'], {})).toBe(false)
  })
})

// 저장 위치가 두 갈래(favorites.routes / favorites.keys)라 한쪽만 읽는 소비처가
// 있었다. 푸시 구독과 독 팝오버와 PC 사이드바가 그랬고, 시간표에서 누른 별이
// 세 곳 모두에서 조용히 빠졌다.
describe('allFavoriteCodes', () => {
  it('routes 와 keys 를 합친다', () => {
    const result = allFavoriteCodes({ routes: ['하교:3400'], keys: ['bus:3:하교'] })
    expect(result).toEqual(['하교:3400', 'bus:3:하교'])
  })

  it('중복을 없애고 저장 순서를 지킨다', () => {
    const result = allFavoriteCodes({ routes: ['a', 'b'], keys: ['b', 'c'] })
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('빈 값과 비문자열을 버린다', () => {
    expect(allFavoriteCodes({ routes: ['', null, 3, 'a'], keys: undefined })).toEqual(['a'])
  })

  it('배열이 아니거나 없으면 빈 배열이다', () => {
    expect(allFavoriteCodes(undefined)).toEqual([])
    expect(allFavoriteCodes({})).toEqual([])
    expect(allFavoriteCodes({ routes: 'nope', keys: null })).toEqual([])
  })
})
