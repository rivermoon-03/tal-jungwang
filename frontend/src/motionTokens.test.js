import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.dirname(fileURLToPath(import.meta.url))
const css = fs.readFileSync(path.join(root, 'index.css'), 'utf8')
const tailwind = fs.readFileSync(path.join(root, '..', 'tailwind.config.js'), 'utf8')

describe('빠른 전환 모션 토큰', () => {
  it('탭과 콘텐츠 전환을 100ms 안팎으로 통일한다', () => {
    expect(css).toMatch(/--dur-motion-press:\s*90ms/)
    expect(css).toMatch(/--dur-motion-base:\s*110ms/)
    expect(css).toMatch(/--dur-motion-enter:\s*120ms/)
    expect(css).toMatch(/\.animate-fade-in\s*\{\s*animation:\s*fadeIn var\(--dur-motion-base\)/)
    expect(tailwind).toMatch(/panelSwap var\(--dur-motion-enter\)/)
  })

  it('모션 최소화 환경에서는 전환 시간을 0ms로 낮춘다', () => {
    expect(css).toMatch(/prefers-reduced-motion:[^)]+\)[\s\S]+--dur-motion-base:\s*0ms/)
  })
})

// 결함 재발 방지: 하단 독이 열려 있는 바텀시트/모달 위에서 눌리던 버그(실측).
// 원인은 .tj-tab-fade의 animation-fill-mode: both였다. 애니메이션이 끝나
// opacity 계산값이 1로 돌아온 뒤에도(겉보기엔 정상) 이 요소가 여전히
// stacking context를 만들어, 그 안에 있는 시트(z-sheet:100)가 전혀 다른
// 조상 트리의 독(z-nav:50, fixed)보다 낮게 그려졌다. HomeWeatherHero.css의
// .whero-panel과 같은 부류의 결함이다. jsdom은 실제 페인트 순서를 계산하지
// 못해 elementsFromPoint로는 이 결함을 재현하거나 고정할 수 없으므로, 대신 CSS
// 소스에서 fill-mode 값 자체를 고정한다.
// .tj-card-enter 와 .tj-number-pulse 는 transform 까지 애니메이션한다. both 로
// 두면 끝난 뒤에도 transform 계산값이 행렬로 남아 같은 결함을 더 쉽게 만든다.
// 아직 이 둘이 원인인 버그가 관측된 적은 없지만, .tj-tab-fade 와 같은 함정이라
// 미리 막는다.
describe('transform 을 애니메이션하는 모션 클래스도 fill-mode 가 backwards 다', () => {
  it.each(['tj-card-enter', 'tj-number-pulse'])('.%s', (name) => {
    const rule = css.match(new RegExp(`\\.${name}\\s*\\{[^}]*\\}`))?.[0]
    expect(rule, `${name} 규칙을 찾지 못했다`).toBeTruthy()
    expect(rule).toMatch(/\bbackwards\b/)
    expect(rule).not.toMatch(/\bboth\b/)
    expect(rule).not.toMatch(/\bforwards\b/)
  })
})

describe('.tj-tab-fade, 애니메이션이 stacking context를 영구히 남기지 않는다', () => {
  it('fill-mode가 backwards다(both/forwards면 회귀)', () => {
    const rule = css.match(/\.tj-tab-fade\s*\{[^}]*\}/)?.[0]
    expect(rule).toBeTruthy()
    expect(rule).toMatch(/animation:\s*tj-tab-fade[^;]*\bbackwards\b/)
    expect(rule).not.toMatch(/\bboth\b/)
    expect(rule).not.toMatch(/\bforwards\b/)
  })
})
