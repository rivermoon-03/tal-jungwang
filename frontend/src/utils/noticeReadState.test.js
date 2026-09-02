import { describe, it, expect, beforeEach } from 'vitest'
import { isNoticeUnread, markNoticesSeen, markNoticesSeenByOwnCategory } from './noticeReadState'

beforeEach(() => {
  localStorage.clear()
})

describe('isNoticeUnread', () => {
  it('처음 방문(저장된 값 없음)이면 전부 안읽음이다', () => {
    expect(isNoticeUnread('app', 10)).toBe(true)
  })

  it('마지막 확인 id보다 큰 id는 안읽음이다', () => {
    markNoticesSeen('app', [5])
    expect(isNoticeUnread('app', 6)).toBe(true)
  })

  it('마지막 확인 id 이하는 읽음이다', () => {
    markNoticesSeen('app', [10])
    expect(isNoticeUnread('app', 10)).toBe(false)
    expect(isNoticeUnread('app', 3)).toBe(false)
  })

  it('id가 없으면 안읽음이 아니다', () => {
    expect(isNoticeUnread('app', null)).toBe(false)
    expect(isNoticeUnread('app', undefined)).toBe(false)
  })

  it('카테고리마다 독립적으로 추적한다', () => {
    markNoticesSeen('academic', [100])
    expect(isNoticeUnread('scholarship', 50)).toBe(true)
  })
})

describe('markNoticesSeen', () => {
  it('여러 id 중 가장 큰 값을 마지막 확인으로 기록한다', () => {
    markNoticesSeen('app', [3, 7, 5])
    expect(isNoticeUnread('app', 7)).toBe(false)
    expect(isNoticeUnread('app', 8)).toBe(true)
  })

  it('이미 기록된 값보다 작은 값으로는 뒤로 가지 않는다', () => {
    markNoticesSeen('app', [10])
    markNoticesSeen('app', [4])
    // 마지막 확인은 여전히 10이어야 하므로 6은 이미 읽은 것으로 취급된다.
    expect(isNoticeUnread('app', 6)).toBe(false)
    expect(isNoticeUnread('app', 11)).toBe(true)
  })

  it('빈 배열이면 아무것도 기록하지 않는다', () => {
    markNoticesSeen('app', [])
    expect(isNoticeUnread('app', 1)).toBe(true)
  })
})

describe('markNoticesSeenByOwnCategory', () => {
  it('각 항목의 category 필드로 묶어 카테고리별로 기록한다', () => {
    markNoticesSeenByOwnCategory([
      { id: 1, category: 'academic' },
      { id: 5, category: 'academic' },
      { id: 2, category: 'scholarship' },
    ])
    expect(isNoticeUnread('academic', 5)).toBe(false)
    expect(isNoticeUnread('academic', 6)).toBe(true)
    expect(isNoticeUnread('scholarship', 2)).toBe(false)
    expect(isNoticeUnread('scholarship', 3)).toBe(true)
  })

  it('category나 id가 없는 항목은 건너뛴다', () => {
    markNoticesSeenByOwnCategory([{ id: null, category: 'academic' }, { id: 1, category: null }])
    expect(isNoticeUnread('academic', 1)).toBe(true)
  })
})
