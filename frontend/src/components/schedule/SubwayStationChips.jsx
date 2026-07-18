import { getNextStation, getTerminalStation } from '../../utils/subwayStations'

const chipBase = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
}

/**
 * 지하철 시간표 행의 "이번역 · 다음역 · 종점" 칩 3개.
 * 다음역/종점은 STATION_SEQUENCES(실제 역 순서 데이터)에서 계산 — 가짜 값 없음.
 * 데이터가 없는 노선/역이면(findStationIndex 실패) 조용히 렌더링 생략.
 */
export default function SubwayStationChips({ line, direction, viewStation }) {
  const nextStation = getNextStation(line, direction, viewStation)
  const terminal = getTerminalStation(line, direction)
  if (!nextStation && !terminal) return null

  // 다음역이 곧 종점이면(예: 정왕 하행 4호선 = 정왕 → 오이도가 끝) 연한 "다음역"이
  // 아니라 종점(다크) 칩으로 한 번만 표시한다. 그렇지 않으면 종점 표기가 빠졌다.
  const nextIsTerminal = !!nextStation && !!terminal && nextStation === terminal
  const arrow = <span style={{ color: 'var(--tj-mute)', fontSize: 10 }}>→</span>

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 8 }}>
      <span style={{ ...chipBase, background: 'var(--tj-accent-bg)', color: 'var(--tj-accent-ink)' }}>
        {viewStation}
      </span>
      {nextStation && !nextIsTerminal && (
        <>
          {arrow}
          <span style={{ ...chipBase, background: 'var(--tj-surface-2)', color: 'var(--tj-ink-2)' }}>
            {nextStation}
          </span>
        </>
      )}
      {terminal && terminal !== viewStation && (
        <>
          {arrow}
          <span style={{ ...chipBase, background: 'var(--tj-ink)', color: 'var(--tj-bg)' }}>
            {terminal}
          </span>
        </>
      )}
    </div>
  )
}
