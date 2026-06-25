/**
 * GpsSoftPrompt — 토큰 정리 검증 테스트
 * TDD: 구현 전 FAIL → 토큰화 후 PASS
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GpsSoftPrompt from './GpsSoftPrompt'

// geolocation mock
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
}
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

describe('GpsSoftPrompt — 8~11px 극소 글자 미사용', () => {
  it('text-[9px]/[10px]/[11px] 클래스가 없어야 한다', () => {
    const { container } = render(
      <GpsSoftPrompt permissionState="prompt" onClose={vi.fn()} onGranted={vi.fn()} />
    )
    expect(container.innerHTML).not.toMatch(/text-\[(?:8|9|10|11)px\]/)
  })
})

describe('GpsSoftPrompt — slate/gray 하드코딩 색 미사용', () => {
  it('text-slate- / text-gray- 클래스가 없어야 한다', () => {
    const { container } = render(
      <GpsSoftPrompt permissionState="prompt" onClose={vi.fn()} onGranted={vi.fn()} />
    )
    expect(container.innerHTML).not.toMatch(/text-slate-/)
    expect(container.innerHTML).not.toMatch(/text-gray-/)
  })
})

describe('GpsSoftPrompt — 생색(red-500 등) 직접 클래스 미사용', () => {
  it('에러 메시지에 text-red-500 같은 생색 클래스가 없어야 한다', () => {
    // 에러를 유발하기 위해 geolocation 실패 mock
    mockGeolocation.getCurrentPosition.mockImplementationOnce((_, errCb) => {
      errCb({ code: 2 }) // POSITION_UNAVAILABLE
    })
    const { container } = render(
      <GpsSoftPrompt permissionState="prompt" onClose={vi.fn()} onGranted={vi.fn()} />
    )
    expect(container.innerHTML).not.toMatch(/text-red-\d+/)
  })
})

describe('GpsSoftPrompt — 핵심 렌더', () => {
  it('permissionState=granted 이면 null 렌더 (컴포넌트 숨김)', () => {
    const { container } = render(
      <GpsSoftPrompt permissionState="granted" onClose={vi.fn()} onGranted={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('prompt 상태에서 "위치 권한이 필요해요" 제목이 렌더된다', () => {
    render(
      <GpsSoftPrompt permissionState="prompt" onClose={vi.fn()} onGranted={vi.fn()} />
    )
    expect(screen.getByText('위치 권한이 필요해요')).toBeTruthy()
  })

  it('denied 상태에서 "허용" 버튼이 없다 (설정 안내만)', () => {
    render(
      <GpsSoftPrompt permissionState="denied" onClose={vi.fn()} onGranted={vi.fn()} />
    )
    expect(screen.queryByText('허용하기')).toBeNull()
  })

  it('닫기 버튼이 렌더된다', () => {
    render(
      <GpsSoftPrompt permissionState="prompt" onClose={vi.fn()} onGranted={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy()
  })
})
