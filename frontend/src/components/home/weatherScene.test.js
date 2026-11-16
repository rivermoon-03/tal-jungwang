import { describe, it, expect } from 'vitest'
import { sceneOf, particlesOf, SCENES, sceneAlt } from './weatherScene'

describe('sceneOf', () => {
  it('비와 눈이 계절보다 먼저다', () => {
    expect(sceneOf('rainy', new Date(2026, 3, 1))).toBe('rain')
    expect(sceneOf('snowy', new Date(2026, 6, 1))).toBe('snow')
  })
  it('달로 계절을 고른다', () => {
    expect(sceneOf('sunny', new Date(2026, 3, 1))).toBe('spring')
    expect(sceneOf('cloudy', new Date(2026, 7, 1))).toBe('summer')
    expect(sceneOf('sunny', new Date(2026, 10, 16))).toBe('autumn')
    expect(sceneOf('sunny', new Date(2026, 0, 5))).toBe('winter')
  })
})

it('모든 장면에 대체 텍스트가 있고, 겨울과 여름 외에는 입자가 있다', () => {
  for (const s of SCENES) expect(sceneAlt(s)).toBeTruthy()
  expect(particlesOf('winter')).toEqual([])
  expect(particlesOf('rain').length).toBeGreaterThan(0)
  expect(particlesOf('autumn')[0].kind).toMatch(/^leaf/)
})
