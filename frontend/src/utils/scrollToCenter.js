/**
 * scrollToCenter — 스크롤 가능한 하나의 container만 스크롤해 대상 el을 세로 중앙에 맞춘다.
 *
 * 네이티브 Element.scrollIntoView({ block: 'center' })는 대상이 화면에 보일 때까지
 * "스크롤 가능한 모든 조상"을 함께 스크롤한다. 바텀시트 안에서는 리스트 컨테이너뿐
 * 아니라 시트/문서 레벨까지 밀려 올라가 상단 헤더가 화면 밖으로 잘리는 문제가 있었다
 * (ScheduleDetailModal의 "다음 차" 자동 센터링 → 마커로 진입한 상세 시트 제목 잘림).
 *
 * offsetTop은 offsetParent 기준이라 container와 일치하지 않을 수 있으므로,
 * getBoundingClientRect 차이로 container 내부 상대 위치를 직접 계산한다.
 *
 * @param {HTMLElement|null|undefined} container - overflow-y-auto인 스크롤 컨테이너
 * @param {HTMLElement|null|undefined} el - container 안에서 중앙에 위치시킬 대상
 */
export function scrollToCenter(container, el) {
  if (!container || !el) return

  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const top = elRect.top - containerRect.top + container.scrollTop

  const target = top - container.clientHeight / 2 + el.clientHeight / 2
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)

  container.scrollTop = clamp(target, 0, maxScroll)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
