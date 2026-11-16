import { useSyncExternalStore } from 'react'

// 간격별로 타이머 하나만 돌리고 구독자 전부가 같은 시각을 받는다.
// 카드마다 setInterval 을 두던 방식보다 타이머 수와 렌더 위상이 줄어든다. 탭이 숨으면 멈춘다.
const clocks = new Map() // intervalMs -> { now, subs, timer }
let listening = false

function startTimer(clock, ms) {
  clock.timer = setInterval(() => {
    clock.now = Date.now()
    clock.subs.forEach((cb) => cb())
  }, ms)
}

function onVisibility() {
  for (const [ms, clock] of clocks) {
    if (!clock.subs.size) continue
    clearInterval(clock.timer)
    clock.timer = null
    if (!document.hidden) {
      clock.now = Date.now()
      clock.subs.forEach((cb) => cb())
      startTimer(clock, ms)
    }
  }
}

function clockFor(ms) {
  let clock = clocks.get(ms)
  if (!clock) {
    clock = { now: Date.now(), subs: new Set(), timer: null }
    clocks.set(ms, clock)
  }
  return clock
}

function subscribe(ms, cb) {
  const clock = clockFor(ms)
  if (!listening) {
    document.addEventListener('visibilitychange', onVisibility)
    listening = true
  }
  clock.subs.add(cb)
  if (!clock.timer && !document.hidden) {
    clock.now = Date.now()
    startTimer(clock, ms)
  }
  return () => {
    clock.subs.delete(cb)
    if (clock.subs.size) return
    clearInterval(clock.timer)
    clocks.delete(ms)
    if ([...clocks.values()].every((c) => !c.subs.size)) {
      document.removeEventListener('visibilitychange', onVisibility)
      listening = false
    }
  }
}

// 구독 함수의 identity 가 렌더마다 바뀌면 매번 재구독되므로 간격별로 고정한다.
const subscribers = new Map()
function subscriberFor(ms) {
  if (!subscribers.has(ms)) subscribers.set(ms, (cb) => subscribe(ms, cb))
  return subscribers.get(ms)
}

/** intervalMs 마다 갱신되는 현재 시각(ms) */
export function useNow(intervalMs = 1000) {
  return useSyncExternalStore(
    subscriberFor(intervalMs),
    () => clockFor(intervalMs).now,
    () => Date.now(),
  )
}
