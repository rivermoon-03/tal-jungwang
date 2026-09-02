/**
 * CafeteriaPCLayout 테스트
 *
 * PC 전폭 레이아웃: 상단 식당 선택 chips(운영상태 dot) + 요일 칩 + 끼니 그리드.
 * 예전 좌측 rail(CafeteriaVenueRail, 300px 컬럼)은 PCSidebar 컨텍스트
 * 서브내비 도입으로 제거됐다 — 식당 선택은 이제 가로 chip 버튼이다.
 * 시각 의존 로직(운영상태 dot, "지금" 배지, 오늘 요일 자동 선택)은 전부
 * vi.setSystemTime으로 고정한 KST 시각 기준으로 검증한다 — 실행 시각에 따라
 * 결과가 바뀌면 안 된다(mistakes.md §1).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// isKstWeekend만 제어 가능하게 모킹 (CafeteriaPage.test.jsx와 동일 패턴).
// 나머지 함수(buildDayLabelMap, extractDayKeys, hasDayMenu 등)는 실제 구현을
// 그대로 써야 요일 칩/오늘 자동 선택 로직이 실제와 동일하게 검증된다.
vi.mock('../../utils/cafeteriaDays', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    isKstWeekend: vi.fn(() => false), // 기본값: 평일
  }
})

import { isKstWeekend } from '../../utils/cafeteriaDays'
import CafeteriaPCLayout from './CafeteriaPCLayout'

// 백엔드 형식: { week_start, year, fetched_at, cafeterias: [{ name, meals: [{ type, time, by_day }] }] }
// 이름은 utils/cafeteriaMenuVenue.js의 CAFETERIA_NAME_ALIASES와 정확히 일치해야
// 운영상태 pill(getCafeteriaStatus)이 실제 venue 스케줄(data/cafeteriaVenues.js)에
// 매핑된다 — "TIP 학생식당"→student-cafeteria(중식 11:00~14:00),
// "E동 레스토랑"→e-restaurant(중식 11:30~13:50).
const MOCK_DATA = {
  week_start: '5.11',
  year: 2026,
  fetched_at: '2026-05-13T10:30:00+09:00',
  cafeterias: [
    {
      name: 'TIP 학생식당',
      meals: [
        {
          type: '중식',
          time: '11:00~14:00',
          by_day: {
            '11': ['제육볶음면', '계란국'],
            '12': ['돼지불고기', '미역국'],
            '13': ['비빔밥', '된장찌개'],
            '14': ['치킨까스', '콩나물국'],
            '15': [],
          },
        },
      ],
    },
    {
      name: 'E동 레스토랑',
      meals: [
        {
          type: '중식',
          time: '11:30~13:50',
          by_day: {
            '11': ['파스타', '샐러드'],
            '12': ['스테이크', '수프'],
            '13': ['리조또'],
            '14': ['피자'],
            '15': [],
          },
        },
      ],
    },
  ],
}

describe('CafeteriaPCLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isKstWeekend.mockReturnValue(false)
    vi.useFakeTimers()
    // 오늘: 2026-05-13(수) 낮 12:00 KST — TIP(11:00~14:00)·E동(11:30~13:50) 둘 다
    // 중식 운영 중인 시각으로 고정한다.
    vi.setSystemTime(new Date('2026-05-13T12:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 결함: source_file(백엔드가 올린 원본 엑셀 파일명)을 갱신 시각 옆에 그대로
  // 붙여 노출했었다. 파일명은 내부 수집 흔적이라 사용자가 읽을 정보가 아니고,
  // 모바일(FacilitiesPage)은 갱신 시각만 보여준다 — PC도 같은 표기여야 한다.
  it('원본 엑셀 파일명(source_file)을 화면에 노출하지 않는다', () => {
    const dataWithSourceFile = {
      ...MOCK_DATA,
      source_file: '학생식당,E동레스토랑식단표(08.31).xlsx',
    }
    render(<CafeteriaPCLayout data={dataWithSourceFile} loading={false} error={null} refetch={vi.fn()} />)
    expect(screen.queryByText(/\.xlsx/)).not.toBeInTheDocument()
    expect(screen.getByText(/갱신/)).toBeInTheDocument()
  })

  // --- (a) 식당 선택 chips 렌더 ---
  it('상단에 cafeterias 이름으로 식당 선택 chip 2개를 렌더한다', () => {
    render(<CafeteriaPCLayout data={MOCK_DATA} loading={false} error={null} refetch={vi.fn()} />)
    expect(screen.getByText('TIP 학생식당')).toBeInTheDocument()
    expect(screen.getByText('E동 레스토랑')).toBeInTheDocument()
  })

  // 상단 타이틀은 시안 요구대로 식당명이 아니라 날짜다("13일(수) 식단") —
  // 어느 식당인지는 우측 세그먼트 chips가 이미 알려준다.
  it('상단 타이틀은 식당명이 아니라 오늘 날짜로 "13일(수) 식단"을 렌더한다', () => {
    render(<CafeteriaPCLayout data={MOCK_DATA} loading={false} error={null} refetch={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '13일(수) 식단' })).toBeInTheDocument()
  })

  // --- (b) 카드 클릭 시 타이틀 전환 + selectedDay 리셋 ---
  it('오늘(13일)이 기본 선택된다', () => {
    render(<CafeteriaPCLayout data={MOCK_DATA} loading={false} error={null} refetch={vi.fn()} />)
    const todayChip = screen.getByRole('button', { name: /13일/ })
    expect(todayChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('다른 요일 칩 선택 후 다른 식당 카드를 클릭하면 식당이 전환되고 요일 선택이 오늘로 복원된다', () => {
    render(<CafeteriaPCLayout data={MOCK_DATA} loading={false} error={null} refetch={vi.fn()} />)

    // 11일 칩으로 수동 선택 변경
    fireEvent.click(screen.getByRole('button', { name: /11일/ }))
    expect(screen.getByRole('button', { name: /11일/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('제육볶음면')).toBeInTheDocument()

    // E동 레스토랑 chip 클릭 → 선택 전환(상단 타이틀은 날짜 기준이라 그대로다 —
    // 식당 전환은 세그먼트 chip의 aria-pressed와 보이는 메뉴로 확인한다)
    const eDongChip = screen.getByText('E동 레스토랑').closest('button')
    fireEvent.click(eDongChip)
    expect(eDongChip).toHaveAttribute('aria-pressed', 'true')

    // selectedDay가 리셋되어 11일이 아니라 오늘(13일)이 다시 선택되어야 한다.
    // (E동도 동일한 dayKeys[11~15]를 가지므로, 리셋이 안 됐다면 11일이 그대로 활성 상태였을 것)
    expect(screen.getByRole('button', { name: /13일/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /11일/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('리조또')).toBeInTheDocument()
  })

  it('같은 식당 카드를 다시 클릭해도 요일 선택이 오늘로 리셋된다', () => {
    render(<CafeteriaPCLayout data={MOCK_DATA} loading={false} error={null} refetch={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /11일/ }))
    expect(screen.getByRole('button', { name: /11일/ })).toHaveAttribute('aria-pressed', 'true')

    const tipChip = screen.getByText('TIP 학생식당').closest('button')
    fireEvent.click(tipChip)

    expect(screen.getByRole('button', { name: /13일/ })).toHaveAttribute('aria-pressed', 'true')
  })

  // --- (c) 운영상태 pill ---
  it('낮 12시(둘 다 중식 운영 중)에는 두 카드 모두 "운영 중" pill을 렌더한다', () => {
    render(<CafeteriaPCLayout data={MOCK_DATA} loading={false} error={null} refetch={vi.fn()} />)
    expect(screen.getAllByText('운영 중')).toHaveLength(2)
  })

  it('영업 종료 시각(밤 22시)에는 "운영 중" pill이 없다', () => {
    vi.setSystemTime(new Date('2026-05-13T22:00:00+09:00'))
    render(<CafeteriaPCLayout data={MOCK_DATA} loading={false} error={null} refetch={vi.fn()} />)
    expect(screen.queryByText('운영 중')).not.toBeInTheDocument()
  })

  // --- (d) 로딩 / 에러 상태 ---
  it('loading=true, data=null이면 스켈레톤을 렌더한다', () => {
    render(<CafeteriaPCLayout data={null} loading={true} error={null} refetch={vi.fn()} />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('NO_MENU 에러 + 평일이면 "등록된 식단이 없어요" EmptyState를 렌더한다', () => {
    isKstWeekend.mockReturnValue(false)
    const err = new Error('NO_MENU')
    err.code = 'NO_MENU'
    render(<CafeteriaPCLayout data={null} loading={false} error={err} refetch={vi.fn()} />)
    expect(screen.getByText(/지금은 등록된 식단이 없어요/)).toBeInTheDocument()
  })

  it('NO_MENU 에러 + 주말이면 "주말에는 학식을 운영하지 않아요" EmptyState를 렌더한다', () => {
    isKstWeekend.mockReturnValue(true)
    const err = new Error('NO_MENU')
    err.code = 'NO_MENU'
    render(<CafeteriaPCLayout data={null} loading={false} error={err} refetch={vi.fn()} />)
    expect(screen.getByText(/주말에는 학식을 운영하지 않아요/)).toBeInTheDocument()
  })

  it('NO_MENU 이외 에러면 ErrorState를 렌더하고 재시도 시 refetch를 호출한다', () => {
    const refetch = vi.fn()
    render(
      <CafeteriaPCLayout data={null} loading={false} error={new Error('network error')} refetch={refetch} />
    )
    expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
