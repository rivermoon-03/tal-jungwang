const KST_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatHHMM(ms) {
  return KST_FORMATTER.format(new Date(ms))
}

/**
 * 도착까지 남은 초를 사람이 읽을 수 있는 텍스트와 tone으로 변환한다.
 *
 * @param {number|null} seconds - 도착까지 남은 초
 * @param {{ now?: number, departAt?: number }} [opts]
 * @returns {{ text: string, tone: 'imminent'|'normal'|'none' }}
 */
export function formatEta(seconds, opts = {}) {
  if (seconds == null) {
    return { text: '운행 정보 없음', tone: 'none' }
  }

  if (seconds <= 90) {
    return { text: '곧 도착', tone: 'imminent' }
  }

  const min = Math.floor(seconds / 60)

  if (opts.departAt != null) {
    // departAt은 절대 ms 타임스탬프 — KST HH:MM 로 변환
    const arrivalHHMM = formatHHMM(opts.departAt)
    return { text: `${min}분 뒤 · ${arrivalHHMM}`, tone: 'normal' }
  }

  return { text: `${min}분`, tone: 'normal' }
}
