/**
 * PCStationPicker 토큰 준수 테스트
 *
 * text-[9px], [10px], [11px] 등 12px 미만 폰트 금지와 text-gray-*, text-slate-*
 * 생색 금지는 src/tokenRules.test.js가 src/ 전체를 순회하며 이미 검사한다
 * (이 파일이 예전에 따로 두던 중복 검사는 제거했다). 여기엔 그 전역 규칙
 * 으로 커버되지 않는 PCStationPicker 고유 검증만 남긴다.
 *
 * 검증 항목:
 * - uppercase 클래스 미사용 (AI티 제거)
 * - tracking-[0.15em] 등 과도한 자간 미사용
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM에는 __dirname이 없다. 파일 기준 경로는 import.meta.url에서 얻는다.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'PCStationPicker.jsx'),
  'utf8',
)

describe('PCStationPicker 토큰 준수 — uppercase AI티 금지', () => {
  it('uppercase 클래스 없음', () => {
    const matches = SRC.match(/\buppercase\b/g)
    expect(matches, `PCStationPicker.jsx에 uppercase 남아있음`).toBeNull()
  })

  it('tracking-[0.15em] 과도한 자간 없음', () => {
    const matches = SRC.match(/tracking-\[0\.15em\]/g)
    expect(matches, `PCStationPicker.jsx에 tracking-[0.15em] 남아있음`).toBeNull()
  })
})
