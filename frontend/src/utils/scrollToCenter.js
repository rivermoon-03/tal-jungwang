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

/**
 * scrollToCenterX — scrollToCenter의 가로축 버전. 가로 스크롤 스냅 리스트(좁은 폰
 * 시간표 등)에서 대상 셀을 container 가로 중앙에 맞춘다. 세로 버전과 동일하게
 * container 하나만 스크롤하고(scrollIntoView처럼 조상까지 밀어올리지 않음),
 * getBoundingClientRect 차이로 상대 위치를 계산한다.
 *
 * @param {HTMLElement|null|undefined} container - overflow-x-auto인 스크롤 컨테이너
 * @param {HTMLElement|null|undefined} el - container 안에서 중앙에 위치시킬 대상
 */
export function scrollToCenterX(container, el) {
  if (!container || !el) return

  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const left = elRect.left - containerRect.left + container.scrollLeft

  const target = left - container.clientWidth / 2 + el.clientWidth / 2
  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)

  container.scrollLeft = clamp(target, 0, maxScroll)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
