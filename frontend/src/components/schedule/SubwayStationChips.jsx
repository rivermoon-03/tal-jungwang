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

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 8 }}>
      <span style={{ ...chipBase, background: 'var(--tj-accent-bg)', color: 'var(--tj-accent-ink)' }}>
        {viewStation}
      </span>
      {nextStation && (
        <>
          <span style={{ color: 'var(--tj-mute)', fontSize: 10 }}>→</span>
          <span style={{ ...chipBase, background: 'var(--tj-surface-2)', color: 'var(--tj-ink-2)' }}>
            {nextStation}
          </span>
        </>
      )}
      {terminal && terminal !== nextStation && (
        <>
          <span style={{ color: 'var(--tj-mute)', fontSize: 10 }}>→</span>
          <span style={{ ...chipBase, background: 'var(--tj-ink)', color: 'var(--tj-bg)' }}>
            {terminal}
          </span>
        </>
      )}
    </div>
  )
}
