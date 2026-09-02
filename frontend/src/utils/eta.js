/**
 * eta.js — "초 → 표시 문자열" 변환의 표준 구현.
 *
 * 감사(2026-09) 전에는 ArrivalEtaCard.jsx(90초 임계)·BusEtaCard.jsx(60초 임계로
 * 텍스트를 바꾸지만 강조는 180초까지 유지)·arrivalTime.js(60초 임계)·
 * busArrivalDisplay.js가 각자 "곧 도착" 임계값과 라운딩을 따로 들고 있었다.
 * 특히 BusEtaCard는 텍스트 전환(60초)과 빨간 강조(180초) 임계가 서로 달라
 * "2분 후"가 빨갛게 뜨는 버그가 있었다. 이 파일이 임박 임계값·라운딩·60분
 * 초과 절대시각 전환 규칙을 정하고, arrivalTime.js·busArrivalDisplay.js와
 * 카드 컴포넌트들은 여기에 위임한다.
 *
 * 문구는 "N분" 하나로 통일한다 — "후"/"뒤" 같은 접미사는 붙이지 않는다.
 * 접미사가 필요한 화면(BusEtaCard의 "N분 후" 등)은 호출부에서 직접 붙인다.
 */

const KST_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatHHMM(ms) {
  return KST_FORMATTER.format(new Date(ms))
}

// "곧 도착" 텍스트 전환 + 빨간 강조(imminent) 공용 임계값(초) — 반드시 하나만 둔다.
//
// 90초를 고른 근거: 리팩터 전에도 ArrivalEtaCard.jsx가 90초를 썼고,
// BusArrivalCard.jsx·SchedulePage.jsx는 각각 "eta.js와 동일하게 90초"라는
// 주석을 남긴 채 로컬 상수로 90초를 복제해 쓰고 있었다 — 즉 90초가 이미
// 사실상의 다수 관행이었다. 60초를 쓰던 쪽은 arrivalTime.js와 BusEtaCard.jsx
// 뿐이었고, 그중 BusEtaCard는 강조 임계(180초)와도 어긋나 있어 버그의
// 원인이었던 쪽이다. 그래서 60초가 아니라 90초로 통일한다.
export const IMMINENT_THRESHOLD_SEC = 90

export function isImminent(seconds) {
  return seconds != null && seconds <= IMMINENT_THRESHOLD_SEC
}

/**
 * 도착까지 남은 초를 사람이 읽을 수 있는 텍스트와 tone으로 변환한다.
 *
 * @param {number|null} seconds - 도착까지 남은 초
 * @param {{ now?: number, departAt?: number }} [opts] - now: 절대시각 계산 기준(ms, 테스트용).
 *   departAt: 절대 ms 타임스탬프가 이미 있을 때(예: 시간표 출발 시각) "N분 뒤 · HH:MM" 형식으로 표시.
 * @returns {{ text: string, tone: 'imminent'|'normal'|'none' }}
 */
export function formatEta(seconds, opts = {}) {
  if (seconds == null) {
    return { text: '운행 정보 없음', tone: 'none' }
  }

  if (isImminent(seconds)) {
    return { text: '곧 도착', tone: 'imminent' }
  }

  const min = Math.floor(seconds / 60)

  if (opts.departAt != null) {
    // departAt은 절대 ms 타임스탬프 — KST HH:MM 로 변환
    const arrivalHHMM = formatHHMM(opts.departAt)
    return { text: `${min}분 뒤 · ${arrivalHHMM}`, tone: 'normal' }
  }

  // 60분 초과 → 상대 분 대신 절대 시각(HH:MM, KST)으로 전환한다.
  if (min > 60) {
    const now = opts.now ?? Date.now()
    return { text: formatHHMM(now + seconds * 1000), tone: 'normal' }
  }

  return { text: `${min}분`, tone: 'normal' }
}
