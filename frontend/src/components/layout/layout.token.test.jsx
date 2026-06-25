/**
 * layout/ 컴포넌트 AI티 제거 토큰 준수 테스트
 *
 * 검증 항목:
 * - text-slate-* / text-gray-* 생색 미사용
 * - bg-slate-* / bg-gray-* 생색 미사용
 * - text-[8px] ~ text-[11px] 12px 미만 폰트 금지
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const LAYOUT_DIR = path.resolve(__dirname)

const TARGET_FILES = [
  'PWAInstallBanner.jsx',
  'MainShell.jsx',
  'PageHeader.jsx',
  'SnapHandle.jsx',
]

function readFile(name) {
  return fs.readFileSync(path.join(LAYOUT_DIR, name), 'utf8')
}

// ── 1. text-slate-* / text-gray-* 생색 금지 ───────────────────────────
describe('layout/ 토큰 준수 — text-slate-*/text-gray-* 생색 금지', () => {
  TARGET_FILES.forEach((file) => {
    it(`${file}: text-slate-* / text-gray-* 없음`, () => {
      const src = readFile(file)
      const matches = src.match(/text-(slate|gray)-\d+/g)
      expect(matches, `${file}에 생색 ${matches} 남아있음`).toBeNull()
    })
  })
})

// ── 2. bg-slate-* / bg-gray-* 생색 금지 ──────────────────────────────
describe('layout/ 토큰 준수 — bg-slate-*/bg-gray-* 생색 금지', () => {
  TARGET_FILES.forEach((file) => {
    it(`${file}: bg-slate-* / bg-gray-* 없음`, () => {
      const src = readFile(file)
      const matches = src.match(/bg-(slate|gray)-\d+/g)
      expect(matches, `${file}에 생색 bg-* ${matches} 남아있음`).toBeNull()
    })
  })
})

// ── 3. 12px 미만 인라인 폰트 금지 ─────────────────────────────────────
describe('layout/ 토큰 준수 — 12px 미만 폰트 금지', () => {
  TARGET_FILES.forEach((file) => {
    it(`${file}: text-[8px] ~ text-[11px] 없음`, () => {
      const src = readFile(file)
      const matches = src.match(/text-\[(8|9|10|11)px\]/g)
      expect(matches, `${file}에 ${matches} 남아있음 (12px 미만)`).toBeNull()
    })
  })
})
