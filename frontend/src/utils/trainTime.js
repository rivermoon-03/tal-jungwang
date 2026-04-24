/**
 * 시간표 배열에서 막차(마지막 열차)와 첫차(첫 번째 열차)의 인덱스를 반환.
 * 연속 열차 간격이 감소하거나 3시간(180분) 이상 벌어지는 지점을 야간 공백으로 판단.
 *
 * @param {Array<{depart_at: string}>} trains
 * @returns {{ lastIdx: number|null, firstIdx: number|null }}
 */
export function getSpecialTrainIndices(trains) {
  if (!trains?.length) return { lastIdx: null, firstIdx: null }

  const mins = trains.map(({ depart_at }) => {
    const [hh, mm] = depart_at.split(':').map(Number)
    return hh * 60 + mm
  })

  for (let i = 1; i < mins.length; i++) {
    const gap = mins[i] - mins[i - 1]
    if (gap < 0 || gap >= 180) {
      return { lastIdx: i - 1, firstIdx: i }
    }
  }

  // 배열 내 명시적 갭 없음 → 마지막 열차가 막차, 첫 번째 열차가 첫차
  return { lastIdx: trains.length - 1, firstIdx: 0 }
}

/**
 * 막차 판단 유틸
 *
 * 규칙:
 * - 밤 11시(23:00) ~ 새벽 2시(02:00) 사이의 열차이고
 * - 그 열차 이후 2시간 내에 다음 열차가 없으면 → 막차
 *
 * 자정을 넘는 열차(00:xx, 01:xx)는 내부적으로 +1440 정규화해서 계산하되,
 * 반환값은 원본 train 객체 그대로 사용.
 *
 * @param {Array<{depart_at: string}>} trains  시간표 배열
 * @param {number} nowMin  현재 시각(분), e.g. 23*60+50 = 1430
 * @returns {{nextTrain: object, isLast: boolean} | null}
 *   - null: 현재 시각이 야간 범위 밖이거나 upcoming 없음
 *   - isLast: true이면 nextTrain이 막차
 */
export function getLastTrainStatus(trains, nowMin) {
  if (!trains?.length) return null

  // 야간 범위(22:00~ 또는 ~02:00)가 아니면 막차 판단 불필요
  if (nowMin < 22 * 60 && nowMin >= 2 * 60) return null

  // 현재 시각을 연속 스케일로: 00:00~02:00 → 1440~1560
  const effectiveNow = nowMin < 3 * 60 ? nowMin + 1440 : nowMin

  // 각 열차의 effective 분 계산
  const items = trains.map((t) => {
    const [hh, mm] = t.depart_at.split(':').map(Number)
    const raw = hh * 60 + mm
    // 자정 넘어가는 열차(00:xx~02:xx)는 +1440
    const m = raw < 3 * 60 ? raw + 1440 : raw
    return { t, m }
  })

  // upcoming (현재 이후 출발)
  const upcoming = items.filter(({ m }) => m > effectiveNow)
  if (upcoming.length === 0) return null

  const { t: nextTrain, m: nextMin } = upcoming[0]

  // 다음 열차가 23:00(1380)~26:00(02:00+1440) 범위인지
  if (nextMin < 23 * 60 || nextMin > 26 * 60) return null

  // 그 다음 열차까지의 간격이 120분 이상이면 막차
  const afterMin = upcoming[1]?.m ?? null
  const isLast = afterMin === null || afterMin - nextMin >= 120

  return { nextTrain, isLast }
}

/**
 * 상대(분) + 절대(HH:MM) 시간 포맷을 통일하여 표시.
 *
 * - 둘 다 있으면: "5분 뒤 · 10:25"
 * - 상대만 있으면: "5분 뒤"
 * - 절대만 있으면: "10:25"
 * - 아무것도 없으면: "—"
 *
 * @param {number|null|undefined} minutes  남은 분
 * @param {string|null|undefined} hhmm     "HH:MM" 포맷 출발 시각
 * @returns {string}
 */
export function formatRelAbs(minutes, hhmm) {
  const hasMin = minutes != null && !Number.isNaN(minutes)
  const hasAbs = typeof hhmm === 'string' && hhmm.length > 0
  if (!hasMin && !hasAbs) return '—'
  if (hasMin && hasAbs) return `${minutes}분 뒤 · ${hhmm}`
  return hasMin ? `${minutes}분 뒤` : hhmm
}
