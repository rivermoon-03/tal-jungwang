// frontend/src/utils/timeSlot.js
// Slot ids correspond to keys in greetings.js
//   dawn:       04:00–06:59
//   morning:    07:00–08:59   (출근/등교 peak)
//   late_morn:  09:00–11:29
//   lunch:      11:30–13:29
//   afternoon:  13:30–16:59
//   evening:    17:00–19:29   (퇴근/하교 peak)
//   night:      19:30–22:59
//   late_night: 23:00–01:29
//   mid_night:  01:30–03:59

const BOUNDS = [
  [4 * 60,         'dawn'],
  [7 * 60,         'morning'],
  [9 * 60,         'late_morn'],
  [11 * 60 + 30,   'lunch'],
  [13 * 60 + 30,   'afternoon'],
  [17 * 60,        'evening'],
  [19 * 60 + 30,   'night'],
  [23 * 60,        'late_night'],
]

export function slotFromMinutes(min) {
  // Wraps around midnight
  const m = ((min % 1440) + 1440) % 1440
  let last = 'mid_night'
  for (const [boundary, slot] of BOUNDS) {
    if (m < boundary) return last
    last = slot
  }
  return m >= 23 * 60 ? 'late_night' : 'mid_night'
}

export function dayTypeFromDate(d, isHoliday = false) {
  if (isHoliday) return 'holiday'
  const dow = d.getDay() // 0=Sun 6=Sat
  return (dow === 0 || dow === 6) ? 'weekend' : 'weekday'
}

export function currentSlotAndDayType(now = new Date(), isHoliday = false) {
  const slot = slotFromMinutes(now.getHours() * 60 + now.getMinutes())
  return { slot, dayType: dayTypeFromDate(now, isHoliday) }
}
