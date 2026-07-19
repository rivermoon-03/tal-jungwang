/**
 * shuttleAlarmMessage — 셔틀 알림 예약(F3-3)의 알림 제목/본문 생성 헬퍼.
 * 카드·시트·Notification 발송이 각자 문자열을 조립하면 문구가 어긋나므로
 * (mistakes.md §2 "표시 로직은 한 곳의 헬퍼로") 이 파일 하나로 일원화한다.
 */

export const SHUTTLE_ALARM_TITLE = '셔틀 알림'

// 알림 예약 리드타임(분) 선택지. ShuttleNotifySheet의 칩 목록과 useShuttleAlarms 검증이 공유.
export const SHUTTLE_ALARM_LEAD_OPTIONS = [
  { id: 10, label: '10분 전' },
  { id: 5, label: '5분 전' },
  { id: 0, label: '출발 시' },
]

/**
 * "17:50 셔틀이 10분 뒤 출발해요" 형태의 본문 문구.
 * lead가 0이면 "지금 출발해요"로 표현한다.
 *
 * @param {string} time - "HH:MM" 출발 시각
 * @param {number} lead - 리드타임(분), 0 이상
 */
export function formatShuttleAlarmMessage(time, lead) {
  if (!lead || lead <= 0) return `${time} 셔틀이 지금 출발해요`
  return `${time} 셔틀이 ${lead}분 뒤 출발해요`
}

// ShuttleNotifySheet 제목 "HH:MM 셔틀 알림"
export function formatShuttleAlarmSheetTitle(time) {
  return `${time} 셔틀 알림`
}
