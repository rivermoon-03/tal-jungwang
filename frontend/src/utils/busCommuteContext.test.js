import { describe, expect, it } from 'vitest'
import {
  BUS_COMMUTE_GROUPS,
  getCommuteContext,
  getRoutesForCommuteGroup,
} from './busCommuteContext'

const ROUTES = [
  { route_number: '11-A', category: '하교' },
  { route_number: '20-1', category: '하교' },
  { route_number: '시흥33', category: '하교' },
  { route_number: '3401', category: '하교' },
  { route_number: '5602', category: '하교' },
  { route_number: '3400', category: '하교' },
  { route_number: '3400', category: '등교' },
  { route_number: '3401', category: '등교' },
  { route_number: '5602', category: '등교' },
  { route_number: '6502', category: '등교' },
  { route_number: '시흥33', category: '등교' },
]

describe('busCommuteContext — 통학 방면 분류', () => {
  it('하교는 정왕역·시흥시청·서울 방면 그룹을 제공한다', () => {
    expect(BUS_COMMUTE_GROUPS.하교.map((group) => group.label)).toEqual([
      '정왕역 방면',
      '시흥시청 방면',
      '서울 방면',
    ])
  })

  it('3401과 5602는 시흥시청 방면과 서울 방면 양쪽에 중복 노출한다', () => {
    const cityHall = getRoutesForCommuteGroup(ROUTES, '하교', 'to-siheung-city-hall')
    const seoul = getRoutesForCommuteGroup(ROUTES, '하교', 'to-seoul')

    expect(cityHall.map((route) => route.route_number)).toEqual(['시흥33', '3401', '5602'])
    expect(seoul.map((route) => route.route_number)).toEqual(['3401', '5602', '3400'])
  })

  it('등교는 서울 출발과 시흥시청 출발로 분리하고 노선을 중복 허용한다', () => {
    const seoul = getRoutesForCommuteGroup(ROUTES, '등교', 'from-seoul')
    const cityHall = getRoutesForCommuteGroup(ROUTES, '등교', 'from-siheung-city-hall')

    expect(seoul.map((route) => route.route_number)).toEqual(['3400', '3401', '5602', '6502'])
    expect(cityHall.map((route) => route.route_number)).toEqual(['3401', '5602', '시흥33'])
  })

  it('선택 맥락은 해당 승차점의 실시간 정류장과 여정만 반환한다', () => {
    expect(getCommuteContext('3401', '등교', 'from-seoul')).toMatchObject({
      origin: '석수역',
      destination: '학교',
      realtimeStationId: null,
    })
    expect(getCommuteContext('3401', '등교', 'from-siheung-city-hall')).toMatchObject({
      origin: '시흥시청역',
      destination: '학교',
      realtimeStationId: '224000586',
    })
  })
})
