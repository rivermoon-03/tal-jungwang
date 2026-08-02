/**
 * tailwindTokens.test.js — semantic 토큰이 투명도 수식어를 받는지 검증.
 *
 * 왜 이 테스트가 있나
 * ───────────────────
 * 토큰 값을 문자열 'var(--tj-surface-3)' 로 두면 Tailwind v3는 알파를 넣을
 * 채널을 몰라서 `bg-surface-3/95` 같은 클래스의 CSS 규칙을 **아예 만들지
 * 않는다**. 클래스는 조용히 죽고 앞에 적힌 `bg-white/95` 가 살아남는다.
 * 다크모드 홈 히어로에서 흰 알약 위에 흰 글자가 얹혔던(대비 1.01:1) 사고가
 * 정확히 이 경로였고, 전수 조사 결과 src/ 전체 40곳이 같은 방식으로 죽어
 * 있었다. 조용히 실패하는 종류라 눈으로는 못 잡는다.
 *
 * tailwind.config.js가 tok() 헬퍼를 쓰는 한 이 테스트는 통과한다. 누군가
 * 토큰 하나를 다시 문자열로 되돌리면 여기서 걸린다.
 */
import { describe, it, expect } from 'vitest'
import config from '../tailwind.config.js'

const colors = config.theme.extend.colors

/** 값이 var(--tj-*)를 참조하는 토큰만 골라낸다(노선색 같은 리터럴 hex는 제외). */
function semanticTokenEntries() {
  const out = []
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value === 'function') {
      out.push([key, value])
      continue
    }
    // navy 처럼 { DEFAULT: fn } 중첩 형태.
    if (value && typeof value === 'object' && typeof value.DEFAULT === 'function') {
      out.push([`${key}.DEFAULT`, value.DEFAULT])
    }
  }
  return out
}

const SEMANTIC = semanticTokenEntries()

describe('tailwind semantic 토큰 — 투명도 수식어 지원', () => {
  it('var(--tj-*) 토큰이 충분히 많이 등록돼 있다(수집 로직 자체 확인)', () => {
    expect(SEMANTIC.length).toBeGreaterThan(30)
  })

  it('opacityValue 없이 부르면 var() 참조 그대로다', () => {
    for (const [key, fn] of SEMANTIC) {
      const value = fn({ opacityValue: undefined })
      expect(value, key).toMatch(/^var\(--tj-[a-z0-9-]+\)$/)
    }
  })

  it('opacityValue를 주면 상대색 문법으로 알파가 들어간다', () => {
    for (const [key, fn] of SEMANTIC) {
      const value = fn({ opacityValue: 0.45 })
      expect(value, key).toMatch(/^rgb\(from var\(--tj-[a-z0-9-]+\) r g b \/ 0\.45\)$/)
    }
  })

  it('색 값이 문자열 var(...)로 남아 있는 토큰은 없다', () => {
    // 문자열로 두면 알파 수식어가 조용히 죽는다. 리터럴 hex/rgba는 허용된다.
    const stringVarTokens = Object.entries(colors)
      .filter(([, v]) => typeof v === 'string' && v.trim().startsWith('var('))
      .map(([k]) => k)
    expect(
      stringVarTokens,
      `아래 토큰은 tok()으로 감싸야 한다(안 그러면 bg-<토큰>/50 이 CSS를 만들지 않는다): ${stringVarTokens.join(', ')}`,
    ).toEqual([])
  })

  it('히어로 사고 재현 방지 — surface-3에 투명도를 붙일 수 있다', () => {
    expect(colors['surface-3']({ opacityValue: 0.95 }))
      .toBe('rgb(from var(--tj-surface-3) r g b / 0.95)')
  })
})
