/**
 * stats/ 컴포넌트 고유 회귀 테스트
 *
 * text-[10px]/[11px] 등 12px 미만 폰트 금지와 text/bg-slate-*·gray-* 생색
 * 금지는 src/tokenRules.test.js가 src/ 전체를 순회하며 이미 검사한다(이
 * 파일이 예전에 따로 두던 중복 검사는 제거했다). 여기엔 그 전역 규칙으로
 * 커버되지 않는 stats/ 고유 검증만 남긴다.
 *
 * 검증 항목:
 * - 인라인 다크 그라데이션 (#0f172a, #111827, #1e293b) 미사용
 * - 핵심 텍스트 식별자 존재 여부
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ESM에는 __dirname이 없다. 파일 기준 경로는 import.meta.url에서 얻는다.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const STATS_DIR = path.resolve(__dirname)

const TARGET_FILES = [
  'CrowdingCard.jsx',
  'WeatherCard.jsx',
  'TrafficFlowCard.jsx',
  'StatusChips.jsx',
  'ChartSkeleton.jsx',
]

function readFile(name) {
  return fs.readFileSync(path.join(STATS_DIR, name), 'utf8')
}

// ── 1. 다크 그라데이션 16진수 색상 금지 ────────────────────────────────
describe('stats/ 토큰 준수 — 인라인 다크 그라데이션 색상 금지', () => {
  const DARK_HEX = [
    '#0f172a',
    '#111827',
    '#1e293b',
    '#0c1220',
    '#0a1628',
    '#10223c',
    '#172238',
    '#1b2b3f',
    '#1a2035',
    '#1e2535',
    '#0d1520',
    '#131c2e',
    '#0a0f1c',
    '#162040',
    '#1c2a44',
    '#0c3050',
    '#10223c',
  ]

  TARGET_FILES.forEach((file) => {
    it(`${file}: 다크 그라데이션 hex 없음`, () => {
      const src = readFile(file)
      const found = DARK_HEX.filter((hex) => src.includes(hex))
      expect(found, `${file}에 다크 그라데이션 hex 남아있음: ${found.join(', ')}`).toHaveLength(0)
    })
  })
})

// ── 2. 인라인 그라데이션 style 금지 (카드 배경용) ─────────────────────
describe('stats/ 토큰 준수 — 카드 배경 인라인 그라데이션 금지', () => {
  // 차트 내부 SVG fill gradient (wc-fill, flowArea 등)는 data 시각화이므로 허용
  // 카드 article/div 레벨 배경 그라데이션만 금지
  const CARD_FILES = [
    'CrowdingCard.jsx',
    'WeatherCard.jsx',
    'TrafficFlowCard.jsx',
    'StatusChips.jsx',
  ]

  CARD_FILES.forEach((file) => {
    it(`${file}: article/div background linear-gradient 인라인 없음`, () => {
      const src = readFile(file)
      // style={{ background: 'linear-gradient(... 패턴 검출
      // SVG <defs> 내부 linearGradient 제외: id="wc-fill"|"flowArea" 등은 다른 형태
      const matches = src.match(/style=\{[^}]*background:\s*['"`]linear-gradient/g)
      expect(matches, `${file}에 인라인 background gradient 남아있음: ${matches}`).toBeNull()
    })
  })
})

// ── 3. 핵심 텍스트 식별자 존재 ─────────────────────────────────────────
describe('stats/ 핵심 텍스트 식별자 존재', () => {
  it('CrowdingCard.jsx: 노선별 혼잡도 텍스트 존재', () => {
    const src = readFile('CrowdingCard.jsx')
    expect(src).toMatch(/노선별 혼잡도/)
  })

  it('날씨 아이콘 매핑이 하늘 상태별로 정의되어 있다', () => {
    // 아이콘 매핑은 skyDisplay.js로 분리했다(컴포넌트 파일과 함께 두면 fast
    // refresh가 깨진다). WeatherCard는 그 매핑을 가져다 쓴다.
    expect(readFile('skyDisplay.js')).toMatch(/Sun|CloudSun|CloudRain|CloudSnow/)
    expect(readFile('WeatherCard.jsx')).toMatch(/SKY_ICON/)
  })

  it('TrafficFlowCard.jsx: 교통 흐름 텍스트 존재', () => {
    const src = readFile('TrafficFlowCard.jsx')
    expect(src).toMatch(/교통 흐름/)
  })

  it('StatusChips.jsx: 날씨/도로/버스 칩 구조 존재', () => {
    const src = readFile('StatusChips.jsx')
    expect(src).toMatch(/마유로/)
    expect(src).toMatch(/시흥33/)
  })
})
