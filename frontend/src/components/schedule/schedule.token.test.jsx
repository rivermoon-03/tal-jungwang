/**
 * 시간표 상세 표면 규율 회귀 테스트.
 *
 * 2026-08-02 감사에서 상세 시트가 정보 한 덩어리에 테두리를 최대 세 겹 겹치고,
 * DESIGN.md가 명시적으로 금지한 두 항목을 어기고 있었다. 겹 수는 눈으로만 세면
 * 다시 늘어나므로 규칙을 여기에 박는다.
 *
 * 검증 항목
 * - radius 5토큰(badge 8 / button·input 10 / card 14 / sheet 20 / pill 999) 밖 금지.
 *   `rounded-xl`은 tailwind 기본 12px이라 토큰이 아니다 (DESIGN.md §4).
 * - 보더 + 그림자 동시 사용 금지 (DESIGN.md §4·§5).
 * - source 콘텐츠를 테두리 컨테이너로 감싸지 않는다. 구분선과 여백으로 나눈다.
 *
 * 금지 대상은 사방을 두르는 `border`(박스)다. `border-t` 같은 방향 보더는 구분선이라
 * B안이 오히려 쓰라고 정한 것이므로 허용한다 — 정규식이 이 둘을 구분한다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '../..')

// 상세 시트가 실제로 그리는 표면들. 새 표면 컴포넌트를 붙이면 여기에 추가한다.
const TARGET_FILES = [
  'components/schedule/ScheduleDetailModal.jsx',
  'components/bus/BusEtaCard.jsx',
  'components/bus/BusStatsHeader.jsx',
]

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8')
}

// ── 1. radius 토큰 ────────────────────────────────────────────────────
// tailwind 기본 스케일 중 5토큰에 매핑되지 않는 것들. rounded-full 은 pill 별칭이라 허용.
const NON_TOKEN_RADIUS = [
  'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl',
  'rounded-2xl', 'rounded-3xl',
]

describe('시간표 상세 — radius는 DESIGN.md 5토큰만 쓴다', () => {
  for (const file of TARGET_FILES) {
    it(`${file}에 토큰 밖 radius 유틸이 없다`, () => {
      const src = read(file)
      const found = NON_TOKEN_RADIUS.filter((cls) =>
        new RegExp(`\\b${cls}\\b`).test(src)
      )
      expect(found).toEqual([])
    })

    it(`${file}에 rounded-[Npx] 임의값이 없다`, () => {
      expect(read(file)).not.toMatch(/rounded-\[\d/)
    })
  }
})

// ── 2. 보더 + 그림자 동시 사용 ─────────────────────────────────────────
describe('시간표 상세 — 보더와 그림자를 함께 쓰지 않는다', () => {
  for (const file of TARGET_FILES) {
    it(`${file}의 className에 border와 shadow가 함께 오지 않는다`, () => {
      const src = read(file)
      // className="..." / className={`...`} 안의 유틸 나열만 본다.
      const classLists = [
        ...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g),
      ].map((m) => m[1] ?? m[2] ?? '')

      const offenders = classLists.filter(
        (list) => /\bborder(?![\w-])/.test(list) && /\bshadow-(card|pop|sh-)/.test(list)
      )
      expect(offenders).toEqual([])
    })
  }
})

// ── 3. source 콘텐츠를 테두리로 감싸지 않는다 ──────────────────────────
describe('ScheduleDetailModal — source 블록에 중첩 프레임을 두지 않는다', () => {
  const src = read('components/schedule/ScheduleDetailModal.jsx')

  it('source 를 map 으로 그리는 구간에 테두리 래퍼가 없다', () => {
    // context.sources.map(...) 부터 </section> 까지가 source 한 블록의 마크업이다.
    const block = src.slice(
      src.indexOf('context.sources.map'),
      src.indexOf('</section>', src.indexOf('context.sources.map'))
    )
    expect(block.length).toBeGreaterThan(0)
    expect(block).not.toMatch(/className="[^"]*\bborder(?![\w-])[^"]*"/)
  })

  it('여정 요약이 테두리 카드가 아니다', () => {
    const block = src.slice(
      src.indexOf('function BusContextDetail'),
      src.indexOf('context.sources.map')
    )
    expect(block).not.toMatch(/className="[^"]*\bborder(?![\w-])[^"]*"/)
  })
})
