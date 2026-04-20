// frontend/src/hooks/useGreeting.js
import { useEffect, useState } from 'react'
import { currentSlotAndDayType } from '../utils/timeSlot'
import { pickGreeting } from '../utils/greetings'

const HOLD_MS    = 2400
const FADE_MS    =  600
const RERESH_MS  = 60_000  // Re-pick if user stays on screen past a slot boundary

export function useGreeting({ isHoliday = false } = {}) {
  const [phase, setPhase] = useState('greeting')  // 'greeting' | 'fading' | 'clock'
  const [greeting, setGreeting] = useState(() => {
    const { slot, dayType } = currentSlotAndDayType(new Date(), isHoliday)
    return pickGreeting({ slot, dayType, seed: Math.floor(Date.now() / 60000) })
  })

  useEffect(() => {
    const hold = setTimeout(() => setPhase('fading'), HOLD_MS)
    const done = setTimeout(() => setPhase('clock'), HOLD_MS + FADE_MS)
    return () => { clearTimeout(hold); clearTimeout(done) }
  }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      const { slot, dayType } = currentSlotAndDayType(new Date(), isHoliday)
      setGreeting((prev) => {
        const next = pickGreeting({ slot, dayType, seed: Math.floor(Date.now() / 60000) })
        return next === prev ? prev : next
      })
    }, RERESH_MS)
    return () => clearInterval(iv)
  }, [isHoliday])

  return { phase, greeting, holdMs: HOLD_MS, fadeMs: FADE_MS }
}
