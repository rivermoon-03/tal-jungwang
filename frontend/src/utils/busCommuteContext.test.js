import { describe, expect, it } from 'vitest'
import { BUS_COMMUTE_GROUPS } from './busCommuteContext'

describe('busCommuteContext — 통학 선택 축', () => {
  it('하교는 정왕역·시흥시청·서울 방면 그룹을 제공한다', () => {
    expect(BUS_COMMUTE_GROUPS.하교.map((group) => group.label)).toEqual([
      '정왕역 방면',
      '시흥시청 방면',
      '서울 방면',
    ])
  })

  it('등교는 서울·시흥시청 출발 그룹을 제공한다', () => {
    expect(BUS_COMMUTE_GROUPS.등교.map((group) => group.label)).toEqual([
      '서울 출발',
      '시흥시청 출발',
    ])
  })
})
