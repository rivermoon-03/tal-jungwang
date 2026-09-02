/**
 * NowAnchorLine — 시간표 상세의 "지금" 앵커 라인.
 *
 * 좌우로 뻗는 2px accent 라인 가운데에 "지금 HH:MM · 다음 N분" 알약을 얹는다.
 * "다음" 항목 바로 앞에 끼워 넣어, 리스트를 끝까지 훑지 않아도 "지금 여기"를
 * 한눈에 알 수 있게 한다(시안 "시간표 화면" 규격). 그룹과 그룹 사이(블록
 * 레벨 컨텍스트)뿐 아니라 HourGroupBlock의 시각 칩 flex-wrap 행 중간에도
 * 끼워 넣을 수 있어야 해서(결함 4 — 다음 항목이 그룹 중간에 있는 경우),
 * 그 경우 호출부가 className="w-full"을 넘겨 flex-wrap 행 안에서 줄바꿈을
 * 강제한다.
 */
export default function NowAnchorLine({ label, className = '' }) {
  if (!label) return null
  return (
    <div
      className={['flex items-center gap-2 py-1', className].filter(Boolean).join(' ')}
      data-testid="now-anchor-line"
    >
      <span aria-hidden className="flex-1 h-[2px] bg-accent dark:bg-accent rounded-pill" />
      <span className="shrink-0 px-3 py-1 rounded-pill bg-accent dark:bg-accent text-white dark:text-ink text-chip font-bold tabular-nums whitespace-nowrap">
        {label}
      </span>
      <span aria-hidden className="flex-1 h-[2px] bg-accent dark:bg-accent rounded-pill" />
    </div>
  )
}
