/**
 * SubwayRealtimeCard + SubwayDataModeToggle — 재작성 검증 테스트
 *
 * TDD: 이 테스트는 구현 전에 먼저 작성한다.
 * 핵심 단언:
 *  1. 9~11px 극소 글자 클래스 미사용
 *  2. 베타 표시가 이모지/점 아닌 텍스트 칩 (StatusChip)
 *  3. 도착 텍스트가 formatEta 기반
 *  4. StaleHintBadge 툴팁 트리거가 터치 44px 이상
 *  5. DataModeToggle이 ui/SegmentTabs (items prop) 사용
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── 외부 의존성 mock ────────────────────────────────────────────────────────
vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({ favorites: { routes: [] }, darkMode: false }),
}))

// ── 컴포넌트 import (mock 이후) ─────────────────────────────────────────────
import { RealtimeCompactCard, RealtimeSlot } from './SubwayRealtimeCard'
import SubwayDataModeToggle from './SubwayDataModeToggle'

// ── 공통 fixture ────────────────────────────────────────────────────────────
const UP_TRAIN = {
  line: '수인분당선',
  direction: '상행',
  destination: '오이도',
  arrive_seconds: 240,   // 4분
  status_code: null,
  status_msg: null,
  smart_status: null,
  location_msg: null,
  current_station: '신길온천',
  recptn_dt: null,
  is_last_train: false,
  ordkey: null,
}

const DOWN_TRAIN = {
  line: '수인분당선',
  direction: '하행',
  destination: '인천',
  arrive_seconds: 90,    // 1분 30초 → formatEta: '곧 도착'
  status_code: null,
  status_msg: null,
  smart_status: null,
  location_msg: null,
  current_station: '정왕',
  recptn_dt: null,
  is_last_train: false,
  ordkey: null,
}

const CARD_PROPS = {
  lineName: '수인분당선',
  symbol: '수',
  color: '#F5A623',
  upTrain: UP_TRAIN,
  downTrain: DOWN_TRAIN,
  stationName: '정왕',
}

// ══════════════════════════════════════════════════════════════════════════════
describe('RealtimeCompactCard — 9~11px 극소 글자 클래스 제거', () => {
  it('text-[9px] / text-[10px] / text-[11px] 클래스가 HTML 어디에도 없다', () => {
    const { container } = render(<RealtimeCompactCard {...CARD_PROPS} />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:9|10|11)px\]/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('RealtimeCompactCard — "실시간(베타)" 텍스트 칩', () => {
  it('"베타" 라벨이 텍스트로 렌더된다', () => {
    render(<RealtimeCompactCard {...CARD_PROPS} />)
    expect(screen.getByText('베타')).toBeTruthy()
  })

  it('"베타" 라벨 요소가 StatusChip — span.rounded-full 구조다', () => {
    const { container } = render(<RealtimeCompactCard {...CARD_PROPS} />)
    const chip = [...container.querySelectorAll('span')].find(
      (el) => el.textContent.trim() === '베타' && el.className.includes('rounded-full'),
    )
    expect(chip).toBeTruthy()
  })

  it('색 점(w-1.5 h-1.5 rounded-full bg-amber) 이 없다', () => {
    const { container } = render(<RealtimeCompactCard {...CARD_PROPS} />)
    expect(container.innerHTML).not.toMatch(/bg-amber/)
  })

  it('점선 underline decoration-dotted 이 없다', () => {
    const { container } = render(<RealtimeCompactCard {...CARD_PROPS} />)
    expect(container.innerHTML).not.toMatch(/decoration-dotted/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('RealtimeCompactCard — demoted 모드 "참고" 라벨', () => {
  it('demoted=true 일 때 "참고" 텍스트가 없다 (별도 라벨 제거)', () => {
    const { container } = render(<RealtimeCompactCard {...CARD_PROPS} demoted />)
    // "참고 · 실시간 (베타)" 같은 합성 문자열이 없어야 함
    expect(container.textContent).not.toMatch(/참고\s*·/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('RealtimeSlot — formatEta 기반 ETA 텍스트', () => {
  it('arrive_seconds=90 → "곧 도착" 렌더 (imminent)', () => {
    render(<RealtimeSlot train={DOWN_TRAIN} dir="하행" align="left" />)
    expect(screen.getByText('곧 도착')).toBeTruthy()
  })

  it('arrive_seconds=240 → "4분" 렌더', () => {
    render(<RealtimeSlot train={UP_TRAIN} dir="상행" align="left" />)
    expect(screen.getByText('4분')).toBeTruthy()
  })

  it('train=null → "정보 없음" 렌더', () => {
    render(<RealtimeSlot train={null} dir="상행" align="left" />)
    expect(screen.getByText('정보 없음')).toBeTruthy()
  })

  it('9~11px 클래스가 RealtimeSlot HTML에 없다', () => {
    const { container } = render(<RealtimeSlot train={UP_TRAIN} dir="상행" align="left" />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:9|10|11)px\]/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('RealtimeCompactCard — StaleHintBadge', () => {
  // staleRef 를 오래된 값으로 설정해 isTimeStale=true 유도
  const staleProps = {
    ...CARD_PROPS,
    stale: true,
    staleSource: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  }

  it('stale 상태에서 StatusChip 기반 배지가 렌더된다 (text-[9px]/[10px]/[11px] 없음)', () => {
    const { container } = render(<RealtimeCompactCard {...staleProps} />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:9|10|11)px\]/)
  })

  it('stale 배지 버튼이 최소 터치 영역 min-h-[44px] 또는 min-w 를 가진다', () => {
    const { container } = render(<RealtimeCompactCard {...staleProps} />)
    // 버튼이 적어도 하나 존재
    const buttons = container.querySelectorAll('button')
    // stale 툴팁 트리거 버튼은 aria-label 포함
    const staleBtn = [...buttons].find(
      (b) => b.getAttribute('aria-label')?.includes('지연')
    )
    expect(staleBtn).toBeTruthy()
    // 최소 터치 44px: inline style 또는 className
    const style = staleBtn.getAttribute('style') || ''
    const cls = staleBtn.getAttribute('class') || ''
    const has44 =
      style.includes('44') ||
      cls.includes('min-h-[44px]') ||
      cls.includes('min-w-[44px]') ||
      cls.includes('p-2.5') ||
      cls.includes('p-3')
    expect(has44).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
describe('SubwayDataModeToggle — ui/SegmentTabs (items prop) 연동', () => {
  it('onChange 가 "realtime" / "timetable" id 로 호출된다', () => {
    const onChange = vi.fn()
    render(<SubwayDataModeToggle value="timetable" onChange={onChange} />)
    const realtimeTab = screen.getByRole('tab', { name: '실시간' })
    fireEvent.click(realtimeTab)
    expect(onChange).toHaveBeenCalledWith('realtime')
  })

  it('value="realtime" 이면 "실시간" 탭이 aria-selected=true', () => {
    render(<SubwayDataModeToggle value="realtime" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '실시간' })).toHaveAttribute('aria-selected', 'true')
  })

  it('value="timetable" 이면 "시간표" 탭이 aria-selected=true', () => {
    render(<SubwayDataModeToggle value="timetable" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '시간표' })).toHaveAttribute('aria-selected', 'true')
  })
})
