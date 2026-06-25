/**
 * common/ 컴포넌트 생색·작은글자 제거 토큰 준수 테스트
 *
 * 검증 항목:
 * - text-gray-* 미사용 (AI티 회색 생색 제거)
 * - text-[8px]/[9px]/[10px]/[11px] 미사용 (최소 12px 보장)
 * - ErrorState onRetry 버튼 존재
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const COMMON_DIR = path.resolve(__dirname)

const TARGET_FILES = [
  'RouteRow.jsx',
  'RoutePanel.jsx',
  'NoticesPopover.jsx',
  'Skeleton.jsx',
  'ErrorState.jsx',
  'EmptyState.jsx',
]

function readFile(name) {
  return fs.readFileSync(path.join(COMMON_DIR, name), 'utf8')
}

describe('common/ 토큰 준수 — text-gray-* 금지', () => {
  TARGET_FILES.forEach((file) => {
    it(`${file}: text-gray-* 클래스 없음`, () => {
      const src = readFile(file)
      const matches = src.match(/text-gray-\d+/g)
      expect(matches, `${file}에 text-gray-* 남아있음: ${matches}`).toBeNull()
    })
  })
})

describe('common/ 토큰 준수 — 12px 미만 폰트 금지', () => {
  TARGET_FILES.forEach((file) => {
    it(`${file}: text-[8px]/[9px]/[10px]/[11px] 없음`, () => {
      const src = readFile(file)
      const matches = src.match(/text-\[(8|9|10|11)px\]/g)
      expect(matches, `${file}에 ${matches} 남아있음 (12px 미만)`).toBeNull()
    })
  })
})

describe('common/ 토큰 준수 — bg-gray-* 금지', () => {
  TARGET_FILES.forEach((file) => {
    it(`${file}: bg-gray-* 클래스 없음`, () => {
      const src = readFile(file)
      const matches = src.match(/bg-gray-\d+/g)
      expect(matches, `${file}에 bg-gray-* 남아있음: ${matches}`).toBeNull()
    })
  })
})

describe('ErrorState onRetry 버튼', () => {
  it('ErrorState.jsx: onRetry prop 사용 코드 존재', () => {
    const src = readFile('ErrorState.jsx')
    expect(src).toMatch(/onRetry/)
  })

  it('ErrorState.jsx: onRetry 버튼 렌더링 조건 존재', () => {
    const src = readFile('ErrorState.jsx')
    // onRetry && <button ... 또는 {onRetry && ( 패턴
    expect(src).toMatch(/onRetry\s*&&/)
  })
})
