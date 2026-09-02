import { describe, it, expect } from 'vitest'
import { toMinutes, groupItemsByHour, anchorLabel, findAnchorSplit } from './timetableGroups'

describe('toMinutes', () => {
  it('HH:MM을 하루 중 분으로 변환한다', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('23:59')).toBe(1439)
  })

  it('콜론이 없거나 문자열이 아니면 null을 반환한다', () => {
    expect(toMinutes('0930')).toBeNull()
    expect(toMinutes(null)).toBeNull()
    expect(toMinutes(undefined)).toBeNull()
  })
})

describe('groupItemsByHour', () => {
  it('같은 시(hour)의 항목을 하나의 그룹으로 묶는다', () => {
    const items = [
      { time: '20:05' }, { time: '20:25' }, { time: '20:45' },
      { time: '21:00' }, { time: '21:20' },
      { time: '22:10' },
    ]
    const groups = groupItemsByHour(items)
    expect(groups.map((g) => g.hour)).toEqual(['20', '21', '22'])
    expect(groups[0].items).toHaveLength(3)
    expect(groups[1].items).toHaveLength(2)
    expect(groups[2].items).toHaveLength(1)
  })

  it('입력 순서와 무관하게 시(hour) 오름차순으로 정렬한다', () => {
    const items = [{ time: '22:10' }, { time: '09:00' }, { time: '20:05' }]
    const groups = groupItemsByHour(items)
    expect(groups.map((g) => g.hour)).toEqual(['09', '20', '22'])
  })

  it('그룹 내부 순서는 입력 순서를 유지한다', () => {
    const items = [{ time: '20:45' }, { time: '20:05' }, { time: '20:25' }]
    const groups = groupItemsByHour(items)
    expect(groups[0].items.map((i) => i.time)).toEqual(['20:45', '20:05', '20:25'])
  })

  it('시 앞자리 0을 떼지 않는다("09시"로 렌더할 원본 문자열 유지)', () => {
    const groups = groupItemsByHour([{ time: '09:00' }])
    expect(groups[0].hour).toBe('09')
  })

  it('파싱 실패 항목은 건너뛴다', () => {
    const groups = groupItemsByHour([{ time: '20:05' }, { time: 'invalid' }, { time: null }])
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(1)
  })

  it('배열이 아니면 빈 배열을 반환한다', () => {
    expect(groupItemsByHour(null)).toEqual([])
    expect(groupItemsByHour(undefined)).toEqual([])
  })
})

describe('anchorLabel', () => {
  it('다음 차 시각이 없으면(오늘 운행 종료) null을 반환한다', () => {
    const now = new Date(2026, 8, 1, 21, 45, 0)
    expect(anchorLabel(now, null)).toBeNull()
  })

  it('"지금 HH:MM · 다음 N분" 형식으로 렌더한다', () => {
    const now = new Date(2026, 8, 1, 21, 45, 0)
    expect(anchorLabel(now, '21:48')).toBe('지금 21:45 · 다음 3분')
  })

  it('임박(90초 이하)이면 "곧 출발"로 표시한다', () => {
    const now = new Date(2026, 8, 1, 21, 45, 0)
    expect(anchorLabel(now, '21:46')).toBe('지금 21:45 · 곧 출발')
  })

  it('현재 시각(now)의 시/분을 그대로 앞부분에 붙인다', () => {
    const now = new Date(2026, 8, 1, 9, 5, 0)
    expect(anchorLabel(now, '09:10')).toBe('지금 09:05 · 다음 5분')
  })

  it('now에 초가 섞여 있어도 화면에 보이는 두 HH:MM 그대로 분 차이를 계산한다(결함 5)', () => {
    // 19:32:45에 열었을 때 "지금 19:32 · 다음 12분"으로 나오던 결함 — 19:32에서
    // 19:45까지는 13분인데, now의 초(45초)까지 정밀하게 뺀 뒤 내림해서 12분으로
    // 짧게 나왔다. 화면엔 초가 없으니 두 HH:MM을 그대로 분 단위로 빼야 한다.
    const now = new Date(2026, 8, 1, 19, 32, 45)
    expect(anchorLabel(now, '19:45')).toBe('지금 19:32 · 다음 13분')
  })

  it('now의 초가 0이 아니어도 임박(90초 이하) 판정은 분 차이 기준으로 흔들리지 않는다', () => {
    const now = new Date(2026, 8, 1, 21, 45, 50)
    expect(anchorLabel(now, '21:46')).toBe('지금 21:45 · 곧 출발')
  })
})

describe('findAnchorSplit', () => {
  const groups = [
    { hour: '19', items: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
    { hour: '20', items: [{ key: 'd' }, { key: 'e' }] },
  ]

  it('다음 항목이 없으면(오늘 운행 종료) null을 반환한다', () => {
    expect(findAnchorSplit(groups, null)).toBeNull()
  })

  it('다음 항목이 그룹의 첫 항목이면 그룹 앞(insideAfterIndex: null)에 놓는다', () => {
    expect(findAnchorSplit(groups, 'a')).toEqual({ groupIndex: 0, insideAfterIndex: null })
    expect(findAnchorSplit(groups, 'd')).toEqual({ groupIndex: 1, insideAfterIndex: null })
  })

  it('다음 항목이 그룹 중간이나 마지막이면 그 앞 항목 뒤(insideAfterIndex)에 놓는다', () => {
    expect(findAnchorSplit(groups, 'b')).toEqual({ groupIndex: 0, insideAfterIndex: 0 })
    expect(findAnchorSplit(groups, 'c')).toEqual({ groupIndex: 0, insideAfterIndex: 1 })
    expect(findAnchorSplit(groups, 'e')).toEqual({ groupIndex: 1, insideAfterIndex: 0 })
  })

  it('groups가 배열이 아니거나 key를 찾지 못하면 null을 반환한다', () => {
    expect(findAnchorSplit(null, 'a')).toBeNull()
    expect(findAnchorSplit(groups, 'zzz')).toBeNull()
  })
})
