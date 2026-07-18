import { describe, it, expect } from 'vitest'
import { describeJeongwangWind } from './jeongwangWind'

describe('describeJeongwangWind (정왕풍)', () => {
  it('null/음수/NaN이면 null (바람 줄 미표시)', () => {
    expect(describeJeongwangWind(null)).toBeNull()
    expect(describeJeongwangWind(undefined)).toBeNull()
    expect(describeJeongwangWind(NaN)).toBeNull()
    expect(describeJeongwangWind(-1)).toBeNull()
  })

  it('정수 풍속은 소수점 없이 표기', () => {
    expect(describeJeongwangWind(3).value).toBe('3m/s')
  })

  it('소수 풍속은 소수점 1자리로 반올림', () => {
    expect(describeJeongwangWind(3.47).value).toBe('3.5m/s')
    expect(describeJeongwangWind(7.02).value).toBe('7m/s')
  })

  it('세기 구간별 문구 매핑', () => {
    expect(describeJeongwangWind(1).phrase).toBe('잔잔한 바람')
    expect(describeJeongwangWind(3).phrase).toBe('살랑이는 바람')
    expect(describeJeongwangWind(5).phrase).toBe('선선한 바람')
    expect(describeJeongwangWind(7).phrase).toBe('제법 부는 바람')
    expect(describeJeongwangWind(10).phrase).toBe('쌩쌩 부는 정왕풍')
    expect(describeJeongwangWind(13).phrase).toBe('몸이 날아갈 듯한 정왕풍')
  })

  it('경계값은 상위 구간에 포함 (>=)', () => {
    expect(describeJeongwangWind(2).phrase).toBe('살랑이는 바람')
    expect(describeJeongwangWind(4).phrase).toBe('선선한 바람')
    expect(describeJeongwangWind(6).phrase).toBe('제법 부는 바람')
    expect(describeJeongwangWind(9).phrase).toBe('쌩쌩 부는 정왕풍')
    expect(describeJeongwangWind(12).phrase).toBe('몸이 날아갈 듯한 정왕풍')
  })

  it('6m/s 이상은 strong=true (강조 표시)', () => {
    expect(describeJeongwangWind(5).strong).toBe(false)
    expect(describeJeongwangWind(6).strong).toBe(true)
    expect(describeJeongwangWind(13).strong).toBe(true)
  })

  it('0m/s은 잔잔한 바람 (무풍도 표시)', () => {
    const r = describeJeongwangWind(0)
    expect(r.value).toBe('0m/s')
    expect(r.phrase).toBe('잔잔한 바람')
  })
})
