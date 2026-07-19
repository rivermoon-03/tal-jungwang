import { describe, it, expect } from 'vitest'
import { pickGreeting, HERO_GREETINGS } from './heroGreeting'

// 모든 now는 '+09:00' 오프셋을 명시해 KST 시각을 직접 지정한다.
// 로컬 타임존에 의존하는 Date.getHours()/getMonth() 등은 쓰지 않는다.

const CHEONGPODO = '내 고장 칠월은\n청포도가 익어 가는 시절'
const SUNNY_DAY_POOL = [
  '돌담에 속삭이는 햇발같이\n풀 아래 웃음 짓는 샘물같이',
  '뜰에는 반짝이는\n금모래빛',
]
const MIDNIGHT_POOL = ['거울속에는소리가없소', '그믐달은 요염하여\n감히 손을 댈 수도 없다']

describe('HERO_GREETINGS 풀', () => {
  it('최소 30개 이상의 글귀를 유지한다', () => {
    expect(HERO_GREETINGS.length).toBeGreaterThanOrEqual(30)
  })

  it('윤동주 서시 인용은 강풍(tier 2) 하나만 남는다', () => {
    const seosi = HERO_GREETINGS.filter((e) => e.source?.includes('서시'))
    expect(seosi.length).toBe(1)
    expect(seosi[0].tier).toBe(2)
  })
})

describe('pickGreeting', () => {
  it('7월 맑은 낮에는 청포도 또는 맑음-낮 풀에서 고른다', () => {
    const now = new Date('2026-07-10T14:00:00+09:00')
    const result = pickGreeting({ mood: 'sunny' }, now)
    expect([CHEONGPODO, ...SUNNY_DAY_POOL]).toContain(result.text)
  })

  it('8월 15일은 다른 조건보다 특정일 글귀가 우선한다', () => {
    const now = new Date('2026-08-15T12:00:00+09:00')
    const result = pickGreeting({ mood: 'cloudy', temp: 33 }, now)
    expect(result.text).toBe('그날이 오면,\n그날이 오면은')
    expect(result.source).toBe('심훈, 그날이 오면')
  })

  it('강풍(6m/s 이상)은 mood 일치보다 우선한다', () => {
    const now = new Date('2026-07-10T14:00:00+09:00')
    const result = pickGreeting({ mood: 'sunny', windSpeed: 7 }, now)
    expect(result.text).toBe('잎새에 이는 바람에도\n나는 괴로워했다')
    expect(result.source).toBe('윤동주, 서시')
  })

  it('비 오는 밤에는 비-밤 풀에서 고른다', () => {
    const now = new Date('2026-07-10T21:00:00+09:00')
    const result = pickGreeting({ mood: 'rainy' }, now)
    expect(result.text).toBe('창밖에 밤비가 속살거려')
    expect(result.source).toBe('윤동주, 쉽게 씌어진 시')
  })

  it('심야(0~4시)에는 mood와 무관하게 심야 풀에서 고른다', () => {
    const now = new Date('2026-07-10T02:00:00+09:00')
    const resultCloudy = pickGreeting({ mood: 'cloudy' }, now)
    const resultSunny = pickGreeting({ mood: 'sunny' }, now)
    expect(MIDNIGHT_POOL).toContain(resultCloudy.text)
    expect(resultSunny.text).toBe(resultCloudy.text)
  })

  it('같은 날 두 번 호출하면 동일한 결과를 반환한다(안정성)', () => {
    const first = pickGreeting({ mood: 'sunny' }, new Date('2026-07-10T09:00:00+09:00'))
    const second = pickGreeting({ mood: 'sunny' }, new Date('2026-07-10T16:30:00+09:00'))
    expect(second).toEqual(first)
  })

  it('날짜가 바뀌면 후보군 안에서 로테이션될 수 있다', () => {
    const seenTexts = new Set()
    for (let day = 1; day <= 20; day++) {
      const dateStr = `2026-07-${String(day).padStart(2, '0')}T14:00:00+09:00`
      const result = pickGreeting({ mood: 'sunny' }, new Date(dateStr))
      seenTexts.add(result.text)
    }
    expect(seenTexts.size).toBeGreaterThan(1)
    for (const text of seenTexts) {
      expect(SUNNY_DAY_POOL).toContain(text)
    }
  })

  it('혹서(32도 이상)는 mood/시간대보다 우선한다', () => {
    const now = new Date('2026-07-10T14:00:00+09:00')
    const result = pickGreeting({ mood: 'sunny', temp: 33 }, now)
    expect(result.text).toBe('한낮이 뜨거워요.\n그늘로 걸어요.')
    expect(result.sub).toBe('물 챙기기')
    expect(result.source).toBeNull()
  })

  it('source가 있으면 sub는 항상 null이다(표시층이 source를 부제로 사용)', () => {
    const now = new Date('2026-07-10T21:00:00+09:00')
    const result = pickGreeting({ mood: 'rainy' }, now)
    expect(result.source).not.toBeNull()
    expect(result.sub).toBeNull()
  })
})
