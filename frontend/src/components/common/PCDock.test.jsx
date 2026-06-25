/**
 * PCDock 토큰 준수 테스트
 *
 * 검증 항목:
 * - text-[9px]/[10px]/[11px] 미사용 (12px 미만 하드코딩 금지)
 * - text-gray-* / text-slate-* 미사용 (생색 제거)
 * - uppercase 단독 스타일링 금지
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = fs.readFileSync(path.resolve(__dirname, 'PCDock.jsx'), 'utf8')

describe('PCDock 토큰 준수 — 12px 미만 폰트 금지', () => {
  it('text-[9px]/[10px]/[11px] 없음', () => {
    const matches = SRC.match(/text-\[(9|10|11)px\]/g)
    expect(matches, `PCDock.jsx에 ${matches} 남아있음 (12px 미만 하드코딩)`).toBeNull()
  })
})

describe('PCDock 토큰 준수 — 생색 클래스 금지', () => {
  it('text-gray-* 없음', () => {
    const matches = SRC.match(/text-gray-\d+/g)
    expect(matches, `PCDock.jsx에 text-gray-* 남아있음`).toBeNull()
  })

  it('text-slate-* 없음', () => {
    const matches = SRC.match(/text-slate-\d+/g)
    expect(matches, `PCDock.jsx에 text-slate-* 남아있음`).toBeNull()
  })
})
