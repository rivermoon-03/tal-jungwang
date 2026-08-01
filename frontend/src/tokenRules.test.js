/**
 * tokenRules.test.js — src/ 전역 디자인 토큰 준수 스윕.
 *
 * 예전엔 layout/, favorites/, stats/, common/ 등 디렉터리별로 각자
 * *.token.test.jsx 파일을 두고 같은 정규식을 반복해서 관리했다. 디렉터리가
 * 늘어날 때마다 새 토큰 테스트를 또 만들어야 했고, 정작 검사 대상에 없는
 * 디렉터리는 무방비였다(예: subway/, transit/). 이 파일이 src/ 전체를 순회하며
 * 같은 규칙을 한 곳에서만 관리한다. 디렉터리별 토큰 테스트는 이 파일로
 * 흡수했다(layout.token.test.jsx / favorites.token.test.jsx는 삭제, common/
 * stats/ 쪽은 토큰과 무관한 고유 검사만 남기고 중복 부분을 들어냈다).
 *
 * 검사 항목:
 *   a) text-(slate|gray)-\d+ / bg-(slate|gray)-\d+ AI티 생색 금지
 *   b) 12px 미만 폰트 금지
 *      - text-[Npx] 임의값 (N<12)
 *      - tailwind.config.js fontSize에 12px 미만으로 정의된 커스텀 키
 *        (예: text-meta, text-micro 등) — 매 실행 시 config에서 동적으로
 *        구성하므로, 향후 누군가 12px 미만 키를 추가해도 자동으로 걸린다.
 *   c) UI 렌더 텍스트에 em-dash("—") 금지 — 주석을 제거한 나머지 코드에서 검출.
 *      주석 안에서 "—"를 문장부호로 쓰는 것은 정상이라 그대로 둔다.
 *
 * 알려진 예외는 EMDASH_EXEMPT에 파일 단위로만 등록하고, 반드시 사유를 남긴다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.resolve(__dirname)
const REPO_ROOT = path.resolve(__dirname, '..')

// ── 대상 파일 수집 ──────────────────────────────────────────────────────
// .test.jsx/.test.js(테스트 자신 포함)와 mock 데이터, 테스트 전용 셋업은 제외한다.
function collectSourceFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full))
      continue
    }
    if (!/\.(jsx|js)$/.test(entry.name)) continue
    if (/\.test\.(jsx|js)$/.test(entry.name)) continue
    if (full === path.join(SRC_DIR, 'test', 'setup.js')) continue
    out.push(full)
  }
  return out
}

const SOURCE_FILES = collectSourceFiles(SRC_DIR)

function relPath(p) {
  return path.relative(REPO_ROOT, p)
}

// ── tailwind.config.js에서 12px 미만 fontSize 커스텀 키를 동적으로 추출 ────
function loadBannedFontKeys() {
  const configPath = path.join(REPO_ROOT, 'tailwind.config.js')
  const src = fs.readFileSync(configPath, 'utf8')

  const blockStart = src.indexOf('fontSize: {')
  if (blockStart === -1) throw new Error('tailwind.config.js에서 fontSize 블록을 찾지 못함')
  const braceStart = src.indexOf('{', blockStart)
  let depth = 0
  let end = -1
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const block = src.slice(braceStart, end + 1)

  // 'key': ['calc(Npx * ...)', {...}]  또는  key: ['calc(Npx * ...)', {...}] 형태만 인식한다.
  const keyRe = /^\s*(?:'([\w-]+)'|([a-zA-Z][\w-]*))\s*:\s*\[\s*'calc\((\d+(?:\.\d+)?)px/
  const banned = []
  for (const line of block.split('\n')) {
    const m = line.match(keyRe)
    if (!m) continue
    const key = m[1] || m[2]
    const px = parseFloat(m[3])
    if (px < 12) banned.push({ key, px })
  }
  return banned
}

const BANNED_FONT_KEYS = loadBannedFontKeys()

// ── 주석 스트립 (문자열/템플릿 리터럴과 정규식 리터럴은 보존해서 건너뛴다) ──
// 나눗셈 '/'과 정규식 리터럴 '/…/'을 구분해야 정규식 안의 따옴표가 문자열
// 파싱을 흔들지 않는다. 직전 유의미한 문자로 정규식 시작 여부를 추정한다.
const REGEX_PRECEDERS = new Set([
  '(', ',', '=', '[', '!', '&', '|', '?', ':', ';', '{', '}', '\n', '+', '-', '*', '%', '<', '>', '',
])

function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  let lastSignificant = ''
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && c2 === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i++
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] || '')
          i += 2
          continue
        }
        out += src[i]
        i++
      }
      out += src[i] || ''
      i++
      lastSignificant = quote
      continue
    }
    if (c === '/' && REGEX_PRECEDERS.has(lastSignificant)) {
      let j = i + 1
      let inClass = false
      let looksLikeRegex = false
      while (j < n) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === '[') inClass = true
        else if (src[j] === ']') inClass = false
        else if (src[j] === '/' && !inClass) {
          j++
          looksLikeRegex = true
          break
        } else if (src[j] === '\n') break
        j++
      }
      if (looksLikeRegex) {
        i = j
        lastSignificant = '/'
        continue
      }
      // 정규식이 아니었다(줄 끝까지 닫는 '/'가 없었음) — 나눗셈으로 취급.
    }
    out += c
    if (!/\s/.test(c)) lastSignificant = c
    i++
  }
  return out
}

// ── c) em-dash 예외 목록 — 파일 단위, 사유 필수 ────────────────────────
// 남발 금지(5개 이하 목표). 현재는 진짜 예외가 없어 비어 있다.
const EMDASH_EXEMPT = {
  // 'components/example/Example.jsx': '사유 설명',
}

describe('tokenRules — src/ 전역 디자인 토큰 준수', () => {
  it('검사 대상 파일이 존재한다 (수집 로직 자체가 깨지지 않았는지 확인)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(50)
  })

  it('a) text-slate-*/text-gray-* 생색 클래스를 쓰지 않는다', () => {
    const violations = []
    for (const file of SOURCE_FILES) {
      const src = fs.readFileSync(file, 'utf8')
      const matches = src.match(/text-(slate|gray)-\d+/g)
      if (matches) violations.push(`${relPath(file)}: ${matches.join(', ')}`)
    }
    expect(violations, `text-slate-*/text-gray-* 잔존:\n${violations.join('\n')}`).toEqual([])
  })

  it('a) bg-slate-*/bg-gray-* 생색 클래스를 쓰지 않는다', () => {
    const violations = []
    for (const file of SOURCE_FILES) {
      const src = fs.readFileSync(file, 'utf8')
      const matches = src.match(/bg-(slate|gray)-\d+/g)
      if (matches) violations.push(`${relPath(file)}: ${matches.join(', ')}`)
    }
    expect(violations, `bg-slate-*/bg-gray-* 잔존:\n${violations.join('\n')}`).toEqual([])
  })

  it('b) text-[Npx] 임의값으로 12px 미만 글자를 쓰지 않는다', () => {
    const violations = []
    const re = /text-\[(\d+(?:\.\d+)?)px\]/g
    for (const file of SOURCE_FILES) {
      const src = fs.readFileSync(file, 'utf8')
      let m
      while ((m = re.exec(src))) {
        if (parseFloat(m[1]) < 12) violations.push(`${relPath(file)}: ${m[0]}`)
      }
    }
    expect(violations, `12px 미만 임의값 잔존:\n${violations.join('\n')}`).toEqual([])
  })

  it('b) tailwind.config.js fontSize에 12px 미만으로 정의된 커스텀 클래스를 쓰지 않는다', () => {
    // 이 시점엔 아래 목록이 비어 있어야 정상이다(2026-08 전수 상향 완료).
    // 그래도 앞으로 누군가 12px 미만 키를 다시 추가하면 이 목록이 채워지고,
    // 아래 검사가 그 키의 실사용처를 즉시 잡아낸다.
    const violations = []
    for (const { key, px } of BANNED_FONT_KEYS) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const re = new RegExp(`(?<![\\w-])text-${escaped}(?![\\w-])`, 'g')
      for (const file of SOURCE_FILES) {
        const src = fs.readFileSync(file, 'utf8')
        if (re.test(src)) violations.push(`${relPath(file)}: text-${key} (${px}px)`)
        re.lastIndex = 0
      }
    }
    expect(
      violations,
      `12px 미만 커스텀 폰트 클래스 잔존:\n${violations.join('\n')}\n` +
        `(밴 목록: ${BANNED_FONT_KEYS.map((k) => `${k.key}=${k.px}px`).join(', ') || '없음'})`
    ).toEqual([])
  })

  it('c) 주석을 제외한 코드에 UI 렌더 텍스트용 em-dash("—")가 없다', () => {
    const dash = String.fromCharCode(0x2014)
    const violations = []
    for (const file of SOURCE_FILES) {
      const rel = relPath(file).replace(/^frontend\//, '')
      if (EMDASH_EXEMPT[rel]) continue
      const src = fs.readFileSync(file, 'utf8')
      const stripped = stripComments(src)
      if (!stripped.includes(dash)) continue
      const lines = stripped.split('\n')
      lines.forEach((line, idx) => {
        if (line.includes(dash)) violations.push(`${rel}:${idx + 1}: ${line.trim()}`)
      })
    }
    expect(violations, `em-dash 잔존(주석 제외):\n${violations.join('\n')}`).toEqual([])
  })

  it('em-dash 예외 목록은 5개 이하로 관리한다', () => {
    expect(Object.keys(EMDASH_EXEMPT).length).toBeLessThanOrEqual(5)
  })
})
