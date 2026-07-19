/**
 * shuttleAlarmStorage — 셔틀 알림 예약(F3-3)의 localStorage 영속화 + 발화 시각 계산.
 *
 * 스토어(useAppStore) 수정이 금지된 작업 범위라 localStorage를 직접 쓴다.
 * 저장 항목은 오늘 표시되는 시간표 한 편에 대한 1회성 예약이라 절대 날짜를 담지
 * 않고 { time, lead, direction }만 저장한다 — 앱을 다시 켤 때마다 "오늘" 기준으로
 * 재계산하고, 이미 지난 시각이면 정리한다(아래 loadShuttleAlarms).
 *
 * 시각 계산은 문자열 비교(mistakes.md §1 금지 패턴) 대신 항상 Date 객체로 한다.
 */

export const SHUTTLE_ALARM_STORAGE_KEY = 'tj-shuttle-alarms'

function parseHHMM(time) {
  const [h, m] = String(time).split(':').map(Number)
  return { h, m }
}

/**
 * time("HH:MM")에서 lead(분)만큼 앞당긴 발화 시각을 now가 속한 "오늘" 기준으로 계산한다.
 * @param {string} time
 * @param {number} lead
 * @param {Date} [now]
 * @returns {Date}
 */
export function alarmFireDate(time, lead, now = new Date()) {
  const { h, m } = parseHHMM(time)
  const fire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
  fire.setMinutes(fire.getMinutes() - (lead ?? 0))
  return fire
}

function isValidAlarm(a) {
  return (
    a &&
    typeof a.time === 'string' &&
    /^\d{2}:\d{2}$/.test(a.time) &&
    typeof a.lead === 'number' &&
    a.direction != null
  )
}

function readRaw() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(SHUTTLE_ALARM_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidAlarm) : []
  } catch {
    return []
  }
}

export function saveShuttleAlarms(alarms) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SHUTTLE_ALARM_STORAGE_KEY, JSON.stringify(alarms))
  } catch {
    // 저장 실패(사생활 보호 모드 등)는 조용히 무시 — 알림은 이번 세션 메모리에서만 동작.
  }
}

/**
 * 저장된 예약을 불러오되, 발화 시각이 이미 지난 항목은 걸러내고(자가 정리)
 * 변경이 있었으면 즉시 재저장한다.
 * @param {Date} [now]
 */
export function loadShuttleAlarms(now = new Date()) {
  const raw = readRaw()
  const valid = raw.filter((a) => alarmFireDate(a.time, a.lead, now).getTime() > now.getTime())
  if (valid.length !== raw.length) saveShuttleAlarms(valid)
  return valid
}

function sameAlarm(a, b) {
  return a.time === b.time && a.direction === b.direction
}

/** 같은 (time, direction) 예약이 있으면 lead를 교체하고, 없으면 추가한다. */
export function upsertShuttleAlarm(alarms, alarm) {
  const next = alarms.filter((a) => !sameAlarm(a, alarm))
  next.push(alarm)
  return next
}

export function removeShuttleAlarm(alarms, time, direction) {
  return alarms.filter((a) => !sameAlarm(a, { time, direction }))
}

export function findShuttleAlarm(alarms, time, direction) {
  return alarms.find((a) => sameAlarm(a, { time, direction })) ?? null
}
