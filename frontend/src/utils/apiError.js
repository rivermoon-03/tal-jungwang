/**
 * apiError — 백엔드 실패 응답의 code 를 안전하게 꺼낸다.
 *
 * hooks/useApi.js 의 apiFetch 는 `ApiResponse.fail` 을 예외로 바꿔 보내면서
 * `error.code` 에 코드를 보존한다. 그래서 통신 실패와 업무 상태(예: 셔틀
 * NO_SCHEDULE) 가 화면에서 같은 자리로 들어온다. 둘은 사용자가 할 일이 다르다.
 * 통신 실패는 다시 시도하면 되고, 업무 상태는 다시 시도해도 달라지지 않는다.
 *
 * 여러 쿼리를 묶은 error 값이 `a && b` 로 조립돼 boolean 이 되는 경우가 있어
 * 객체일 때만 코드를 읽는다.
 */
export function apiErrorCode(error) {
  if (!error || typeof error !== 'object') return null
  return typeof error.code === 'string' ? error.code : null
}

/** 셔틀 운행 기간이 없는 날 — 통신 실패가 아니라 상태다. */
export function isNoScheduleError(error) {
  return apiErrorCode(error) === 'NO_SCHEDULE'
}
