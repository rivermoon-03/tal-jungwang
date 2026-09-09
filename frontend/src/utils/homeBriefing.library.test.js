/**
 * 도서관 열람실 개관시간 파싱 회귀 테스트.
 *
 * 도서관 배너 API(library.tukorea.ac.kr)는 학기 중 제2일반열람실을
 * "[학기] 24시간 개방" 으로 내려준다. 파서가 "HH:MM ~ HH:MM" 만 읽어서
 * 이 표기를 못 잡았고, 화면에는 "오늘 없음 · 미개방" 으로 떴다.
 */
import { describe, it, expect } from 'vitest'
import { roomStateToday, summarizeLibraryHours } from './homeBriefing'

// 2026-09-10 목요일 08:17 KST 기준
const THU_MORNING = new Date('2026-09-10T08:17:00+09:00')
const THU_DAWN = new Date('2026-09-10T03:00:00+09:00')
const SAT = new Date('2026-09-12T15:00:00+09:00')

const ALWAYS_ROOM = { room: '제2일반열람실', period: '학기', hours: '24시간 개방', closed: false }
const DAILY_ROOM = { room: '제1일반열람실', period: '학기', hours: '매일 06:30~23:00', closed: false }
const WEEKDAY_ROOM = { room: '자료열람실(3층)', period: '학기', hours: '평일 09:30 ~ 22:00', closed: false }
const CLOSED_ROOM = { room: '그룹 스터디룸', period: '방학', hours: '미개방', closed: true }

describe('roomStateToday — 24시간 개방', () => {
  it('시각 범위가 없어도 열린 것으로 읽는다', () => {
    const s = roomStateToday(ALWAYS_ROOM, THU_MORNING)
    expect(s.state).toBe('open')
    expect(s.always).toBe(true)
  })

  it('아무 시각에나 열려 있다', () => {
    expect(roomStateToday(ALWAYS_ROOM, THU_DAWN).state).toBe('open')
    expect(roomStateToday(ALWAYS_ROOM, SAT).state).toBe('open')
  })

  it('미개방은 여전히 off 다', () => {
    expect(roomStateToday(CLOSED_ROOM, THU_MORNING).state).toBe('off')
  })

  it('시각 범위 표기는 그대로 동작한다', () => {
    const s = roomStateToday(DAILY_ROOM, THU_MORNING)
    expect(s.state).toBe('open')
    expect(s.always).toBeUndefined()
    expect(s.startText).toBe('06:30')
    expect(s.endText).toBe('23:00')
  })

  it('평일 표기는 토요일에 off 다', () => {
    expect(roomStateToday(WEEKDAY_ROOM, SAT).state).toBe('off')
  })
})

describe('summarizeLibraryHours — 24시간 개방이 섞였을 때', () => {
  it('닫는 시각 대신 24시간이라는 사실을 말한다', () => {
    const r = summarizeLibraryHours([DAILY_ROOM, ALWAYS_ROOM], THU_MORNING)
    expect(r.open).toBe(true)
    expect(r.sub).toBe('제2일반열람실 24시간')
  })

  it('새벽에도 열린 곳으로 센다', () => {
    const r = summarizeLibraryHours([DAILY_ROOM, ALWAYS_ROOM], THU_DAWN)
    expect(r.open).toBe(true)
    expect(r.label).toBe('지금 1곳 열림')
  })

  it('24시간 개방이 없으면 가장 늦게 닫는 곳을 말한다', () => {
    const r = summarizeLibraryHours([DAILY_ROOM, WEEKDAY_ROOM], THU_MORNING)
    expect(r.sub).toBe('제1일반열람실 23:00까지')
  })
})
