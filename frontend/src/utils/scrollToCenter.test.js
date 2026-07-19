import { describe, it, expect } from 'vitest'
import { scrollToCenter, scrollToCenterX } from './scrollToCenter'

// jsdom은 실제 레이아웃을 계산하지 않으므로 getBoundingClientRect/scrollHeight/clientHeight를
// 직접 스텁해 container 내부 상대 위치 계산을 검증한다.
function stubRect(el, top) {
  el.getBoundingClientRect = () => ({ top, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
}

function makeContainer({ top = 0, clientHeight = 400, scrollHeight = 1000, scrollTop = 0 } = {}) {
  const el = document.createElement('div')
  stubRect(el, top)
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true })
  el.scrollTop = scrollTop
  return el
}

function makeTarget({ top, clientHeight = 50 } = {}) {
  const el = document.createElement('div')
  stubRect(el, top)
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true })
  return el
}

describe('scrollToCenter', () => {
  it('el을 container 세로 중앙에 맞추도록 scrollTop을 계산한다', () => {
    const container = makeContainer({ top: 0, clientHeight: 400, scrollHeight: 1000 })
    const el = makeTarget({ top: 300, clientHeight: 50 })
    // relTop = 300 - 0 + 0 = 300, target = 300 - 200 + 25 = 125
    scrollToCenter(container, el)
    expect(container.scrollTop).toBe(125)
  })

  it('container 자체가 스크롤된 상태(scrollTop != 0)에서도 상대 위치를 반영한다', () => {
    const container = makeContainer({ top: 0, clientHeight: 400, scrollHeight: 1000, scrollTop: 50 })
    const el = makeTarget({ top: 300, clientHeight: 50 })
    // relTop = 300 - 0 + 50 = 350, target = 350 - 200 + 25 = 175
    scrollToCenter(container, el)
    expect(container.scrollTop).toBe(175)
  })

  it('container가 뷰포트 원점에서 떨어져 있으면(offsetParent 불일치) rect 차이로 보정한다', () => {
    const container = makeContainer({ top: 100, clientHeight: 400, scrollHeight: 1000 })
    const el = makeTarget({ top: 300, clientHeight: 50 })
    // relTop = 300 - 100 + 0 = 200, target = 200 - 200 + 25 = 25
    scrollToCenter(container, el)
    expect(container.scrollTop).toBe(25)
  })

  it('목표 위치가 음수면 0으로 clamp한다', () => {
    const container = makeContainer({ top: 0, clientHeight: 400, scrollHeight: 1000 })
    const el = makeTarget({ top: 10, clientHeight: 50 })
    scrollToCenter(container, el)
    expect(container.scrollTop).toBe(0)
  })

  it('목표 위치가 최대 스크롤을 넘으면 scrollHeight-clientHeight로 clamp한다', () => {
    const container = makeContainer({ top: 0, clientHeight: 400, scrollHeight: 1000 })
    const el = makeTarget({ top: 950, clientHeight: 50 })
    // target = 950 - 200 + 25 = 775, maxScroll = 600
    scrollToCenter(container, el)
    expect(container.scrollTop).toBe(600)
  })

  it('container가 el보다 콘텐츠가 짧아 maxScroll이 음수가 되는 경우 0으로 clamp한다', () => {
    const container = makeContainer({ top: 0, clientHeight: 400, scrollHeight: 300 })
    const el = makeTarget({ top: 950, clientHeight: 50 })
    scrollToCenter(container, el)
    expect(container.scrollTop).toBe(0)
  })

  it('부모(조상) 요소의 scrollTop은 건드리지 않는다 — container 하나만 스크롤', () => {
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'clientHeight', { value: 800, configurable: true })
    Object.defineProperty(parent, 'scrollHeight', { value: 2000, configurable: true })
    parent.scrollTop = 0

    const container = makeContainer({ top: 0, clientHeight: 400, scrollHeight: 1000 })
    parent.appendChild(container)
    document.body.appendChild(parent)

    const el = makeTarget({ top: 300, clientHeight: 50 })
    container.appendChild(el)

    scrollToCenter(container, el)

    expect(container.scrollTop).toBe(125)
    expect(parent.scrollTop).toBe(0)

    document.body.removeChild(parent)
  })

  it('container가 null/undefined이면 no-op', () => {
    const el = makeTarget({ top: 300 })
    expect(() => scrollToCenter(null, el)).not.toThrow()
    expect(() => scrollToCenter(undefined, el)).not.toThrow()
  })

  it('el이 null/undefined이면 no-op이고 container.scrollTop이 변하지 않는다', () => {
    const container = makeContainer({ top: 0, clientHeight: 400, scrollHeight: 1000, scrollTop: 42 })
    scrollToCenter(container, null)
    expect(container.scrollTop).toBe(42)
    scrollToCenter(container, undefined)
    expect(container.scrollTop).toBe(42)
  })

  it('둘 다 null/undefined이면 no-op', () => {
    expect(() => scrollToCenter(null, null)).not.toThrow()
    expect(() => scrollToCenter(undefined, undefined)).not.toThrow()
  })
})

// ── scrollToCenterX (가로축) ────────────────────────────────────────────
function stubRectX(el, left) {
  el.getBoundingClientRect = () => ({ top: 0, left, right: 0, bottom: 0, width: 0, height: 0 })
}

function makeContainerX({ left = 0, clientWidth = 400, scrollWidth = 1000, scrollLeft = 0 } = {}) {
  const el = document.createElement('div')
  stubRectX(el, left)
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true })
  el.scrollLeft = scrollLeft
  return el
}

function makeTargetX({ left, clientWidth = 50 } = {}) {
  const el = document.createElement('div')
  stubRectX(el, left)
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true })
  return el
}

describe('scrollToCenterX', () => {
  it('el을 container 가로 중앙에 맞추도록 scrollLeft를 계산한다', () => {
    const container = makeContainerX({ left: 0, clientWidth: 400, scrollWidth: 1000 })
    const el = makeTargetX({ left: 300, clientWidth: 50 })
    // relLeft = 300 - 0 + 0 = 300, target = 300 - 200 + 25 = 125
    scrollToCenterX(container, el)
    expect(container.scrollLeft).toBe(125)
  })

  it('목표 위치가 음수면 0으로 clamp한다', () => {
    const container = makeContainerX({ left: 0, clientWidth: 400, scrollWidth: 1000 })
    const el = makeTargetX({ left: 10, clientWidth: 50 })
    scrollToCenterX(container, el)
    expect(container.scrollLeft).toBe(0)
  })

  it('목표 위치가 최대 스크롤을 넘으면 scrollWidth-clientWidth로 clamp한다', () => {
    const container = makeContainerX({ left: 0, clientWidth: 400, scrollWidth: 1000 })
    const el = makeTargetX({ left: 950, clientWidth: 50 })
    scrollToCenterX(container, el)
    expect(container.scrollLeft).toBe(600)
  })

  it('부모(조상) 요소의 scrollLeft는 건드리지 않는다 — container 하나만 스크롤', () => {
    const parent = document.createElement('div')
    Object.defineProperty(parent, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(parent, 'scrollWidth', { value: 2000, configurable: true })
    parent.scrollLeft = 0

    const container = makeContainerX({ left: 0, clientWidth: 400, scrollWidth: 1000 })
    parent.appendChild(container)
    document.body.appendChild(parent)

    const el = makeTargetX({ left: 300, clientWidth: 50 })
    container.appendChild(el)

    scrollToCenterX(container, el)

    expect(container.scrollLeft).toBe(125)
    expect(parent.scrollLeft).toBe(0)

    document.body.removeChild(parent)
  })

  it('container/el이 null/undefined이면 no-op', () => {
    const el = makeTargetX({ left: 300 })
    expect(() => scrollToCenterX(null, el)).not.toThrow()
    expect(() => scrollToCenterX(undefined, el)).not.toThrow()
    expect(() => scrollToCenterX(null, null)).not.toThrow()
  })
})
