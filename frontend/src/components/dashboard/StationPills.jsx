import useAppStore from '../../stores/useAppStore'

/**
 * StationPills — 모드 탭 아래 정류장/역 선택 pill 행.
 *
 * Props:
 *   mode:     'bus' | 'subway' | 'shuttle'
 *   value:    현재 선택된 옵션 (문자열)
 *   onChange: (value) => void — 상위에서 커스텀 제어시 사용
 *   options:  string[] — 제공 시 기본값 무시
 *
 * mode === 'shuttle' 이면 렌더하지 않는다.
 *
 * 내부 기본 옵션:
 *   bus:    ['한국공학대', '이마트']
 *   subway: ['정왕', '초지', '시흥시청']
 *
 * 내부 결정 (출발 정류장 기준):
 *   - 버스: 한국공학대 출발 → '하교'
 *            이마트 출발    → 7~14시 '등교', 그 외 '기타' (setBusGroup)
 *   - 지하철: setSubwayStation(value) 직접 호출
 */
const DEFAULT_OPTIONS = {
  bus:    ['한국공학대', '이마트'],
  subway: ['정왕', '초지', '시흥시청'],
}

function resolveBusGroup(stationLabel) {
  // 한국공학대 출발 버스 = '하교' (학교에서 나가는 노선)
  if (stationLabel === '한국공학대') return '하교'
  // 이마트 출발: 등교 시간대(7~14)면 등교, 그 외 기타
  const hour = new Date().getHours()
  return hour >= 7 && hour < 14 ? '등교' : '기타'
}

export default function StationPills({ mode, value, onChange, options }) {
  const setBusGroup       = useAppStore((s) => s.setBusGroup)
  const setSubwayStation  = useAppStore((s) => s.setSubwayStation)

  if (mode === 'shuttle') return null

  const items = options ?? DEFAULT_OPTIONS[mode] ?? []
  if (items.length === 0) return null

  const handleSelect = (label) => {
    if (mode === 'bus') {
      setBusGroup(resolveBusGroup(label))
    } else if (mode === 'subway') {
      setSubwayStation(label)
    }
    if (typeof onChange === 'function') onChange(label)
  }

  return (
    <div
      role="group"
      aria-label="정류장 선택"
      className="flex gap-2 px-4 pb-1.5 overflow-x-auto scrollbar-hide"
    >
      {items.map((label) => {
        const isActive = value === label
        return (
          <button
            key={label}
            type="button"
            onClick={() => handleSelect(label)}
            aria-pressed={isActive}
            className={[
              'px-3 py-1.5 rounded-full text-caption whitespace-nowrap transition-colors duration-press pressable',
              'border-[1.5px]',
              isActive
                ? 'border-ink text-ink dark:border-accent-dark dark:text-accent-dark'
                : 'border-mute/30 text-mute dark:border-border-dark',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
