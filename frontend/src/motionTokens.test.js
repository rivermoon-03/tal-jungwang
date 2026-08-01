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
