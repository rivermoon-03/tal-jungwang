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
 *   d) border-/ring-/divide-(slate|gray)-\d+ AI티 생색 금지 — a)와 같은 팔레트를
 *      같은 접두사 3종에도 적용한다(2026-09). text-와 bg-만 막던 시절 즐겨찾기
 *      두 파일이 border-slate-100을 이 틈으로 썼던 사고 재발 방지.
 *   e) 인라인 style={{ fontSize: N }}(N은 숫자 리터럴) 금지 — tailwind.config.js의
 *      명명된 fontSize 스케일은 전부 calc(Npx * var(--tj-font-scale,1))이라 설정
 *      화면의 글자 크기 슬라이더가 --tj-font-scale만 바꾸면 전수 반영되는데,
 *      인라인 style의 숫자 리터럴 fontSize는 이 스케일 밖이라 슬라이더가 안 먹는다.
 *      style={{ fontSize: 'var(--tj-...)' }}처럼 문자열/변수를 쓰는 것은 스케일
 *      밖이 아니라 검사 대상이 아니다.
 *
 * 알려진 예외는 EMDASH_EXEMPT/INLINE_FONTSIZE_EXEMPT에 파일 단위로만 등록하고,
 * 반드시 사유를 남긴다.
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

// ── e) 인라인 style fontSize 예외 목록 — 파일 단위, 사유 필수 ───────────
// 2026-09 검사 확장(border-/ring-/divide- 팔레트 금지 추가) 시점에 이미 존재하던
// 담당 밖 위반이다. 담당 범위는 src/components/layout · common/(FloatingDock·
// DockQuickAccess·HolidayBanner·SlotNumber·Skeleton·pcNavTabs)로 한정돼 이 파일들은
// 고칠 수 없다 — 다른 작업자가 각자 디렉터리에서 정리 중이라 이 목록은 줄어들
// 예정이다. 새 위반이 이 파일들에 더 생기는 것까지 눈감아주진 않도록 파일 단위로만
// 열어둔다(신규 파일 추가 시 반드시 사유를 남길 것).
// 키는 relPath()가 내는 그대로("src/..." 포함)를 쓴다 — REPO_ROOT가 frontend/라
// relPath는 항상 "src/components/..." 형태를 낸다.
const INLINE_FONTSIZE_EXEMPT = {
  // common/ 물리적 위치지만 이번 작업 담당 파일 목록(FloatingDock·DockQuickAccess·
  // HolidayBanner·SlotNumber·Skeleton·pcNavTabs)에는 없어 손댈 수 없다.
  'src/components/common/RouteBadge.jsx': '담당 밖(common/ 소유 목록 밖) — fontSize 숫자 리터럴 다수',
  'src/components/favorites/FavoritesTimeline.jsx': '담당 밖(favorites/) — fontSize 숫자 리터럴 다수',
  'src/components/map/MarkerSheet.jsx': '담당 밖(map/) — fontSize 숫자 리터럴 다수(마커 시트 전면 개편 중)',
  'src/components/schedule/ScheduleSection.jsx': '담당 밖(schedule/) — fontSize 숫자 리터럴 다수',
  'src/components/schedule/SchedulePage.jsx': '담당 밖(schedule/) — fontSize 숫자 리터럴 다수',
  'src/components/schedule/SubwayStationChips.jsx': '담당 밖(schedule/) — fontSize 숫자 리터럴(chipBase 간접 스프레드 포함)',
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

  // F4 글자 크기 슬라이더는 --tj-font-scale 만 바꾸고, tailwind fontSize 토큰이
  // 전부 calc(Npx * var(--tj-font-scale,1)) 이라 토큰을 쓰는 텍스트만 같이 커진다.
  // text-[Npx] 임의값과 인라인 style={{fontSize:12}} 는 그 스케일 밖이라, 슬라이더를
  // 올려도 화면 일부만 커지고 나머지는 그대로였다(2026-09 전수 토큰화로 해소).
  // 화면 일부만 커지면 오히려 읽기 어려우므로 새로 들어오는 것을 막는다.
  it('c) text-[Npx] 임의값을 아예 쓰지 않는다 — 글자 크기 설정이 안 먹는다', () => {
    const violations = []
    for (const file of SOURCE_FILES) {
      const matches = fs.readFileSync(file, 'utf8').match(/text-\[\d+(?:\.\d+)?px\]/g)
      if (matches) violations.push(`${relPath(file)}: ${matches.join(', ')}`)
    }
    expect(violations, `text-[Npx] 임의값 잔존:\n${violations.join('\n')}`).toEqual([])
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

  it('d) border-slate-*/border-gray-* 생색 클래스를 쓰지 않는다', () => {
    const violations = []
    for (const file of SOURCE_FILES) {
      const src = fs.readFileSync(file, 'utf8')
      const matches = src.match(/border-(slate|gray)-\d+/g)
      if (matches) violations.push(`${relPath(file)}: ${matches.join(', ')}`)
    }
    expect(violations, `border-slate-*/border-gray-* 잔존:\n${violations.join('\n')}`).toEqual([])
  })

  it('d) ring-slate-*/ring-gray-* 생색 클래스를 쓰지 않는다', () => {
    const violations = []
    for (const file of SOURCE_FILES) {
      const src = fs.readFileSync(file, 'utf8')
      const matches = src.match(/ring-(slate|gray)-\d+/g)
      if (matches) violations.push(`${relPath(file)}: ${matches.join(', ')}`)
    }
    expect(violations, `ring-slate-*/ring-gray-* 잔존:\n${violations.join('\n')}`).toEqual([])
  })

  it('d) divide-slate-*/divide-gray-* 생색 클래스를 쓰지 않는다', () => {
    const violations = []
    for (const file of SOURCE_FILES) {
      const src = fs.readFileSync(file, 'utf8')
      const matches = src.match(/divide-(slate|gray)-\d+/g)
      if (matches) violations.push(`${relPath(file)}: ${matches.join(', ')}`)
    }
    expect(violations, `divide-slate-*/divide-gray-* 잔존:\n${violations.join('\n')}`).toEqual([])
  })

  it('e) 인라인 style={{ fontSize: N }} 숫자 리터럴을 쓰지 않는다(접근성 글자 크기 스케일 우회 방지)', () => {
    // 주석 안에 "style={{fontSize:N}}" 같은 예시 문구가 실제로 존재하지만(예:
    // more/SettingsPage.jsx) N이 글자 그대로라 \d 정규식과 충돌하지 않는다 —
    // 실사용 사례를 전수 조사해 확인했다(2026-09). 그래서 em-dash 검사와
    // 달리 stripComments 없이 원본 소스에 바로 매칭해 줄 번호를 정확히 낸다.
    const violations = []
    const re = /style=\{\{([^}]*)\}\}/gs
    for (const file of SOURCE_FILES) {
      const rel = relPath(file).replace(/^frontend\//, '')
      if (INLINE_FONTSIZE_EXEMPT[rel]) continue
      const src = fs.readFileSync(file, 'utf8')
      let m
      re.lastIndex = 0
      while ((m = re.exec(src))) {
        if (/\bfontSize:\s*[0-9]/.test(m[1])) {
          const line = src.slice(0, m.index).split('\n').length
          violations.push(`${rel}:${line}`)
        }
      }
    }
    expect(violations, `인라인 style fontSize 숫자 리터럴 잔존:\n${violations.join('\n')}`).toEqual([])
  })

  it('인라인 fontSize 예외 목록에는 파일마다 사유가 적혀 있다', () => {
    for (const [file, reason] of Object.entries(INLINE_FONTSIZE_EXEMPT)) {
      expect(typeof reason === 'string' && reason.length > 0, file).toBe(true)
    }
  })
})
