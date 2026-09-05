/**
 * ClusterListSheet — 확대해도 풀리지 않는 클러스터의 구성원 목록.
 *
 * 정왕역의 4호선, 수인분당, 셔틀 정류장처럼 좌표가 수십 m 안에 겹친 마커는
 * 최대 줌에서도 한 배지로 남는다. 예전엔 배지를 탭할 때마다 2레벨씩 확대만
 * 해서 끝내 아무 마커에도 닿을 수 없었다(실측). 이 시트가 구성원을 나열하고,
 * 한 줄을 탭하면 그 마커의 시트(MarkerSheet)로 넘어간다.
 *
 * Props:
 *   members  — station 객체 배열(ZoomAwareOverlayManager 가 넘긴 그대로)
 *   onSelect — (station) => void
 *   onClose  — () => void
 */
import { ChevronRight, X } from 'lucide-react'
import Sheet from '../ui/Sheet'
import IconButton from '../ui/IconButton'
import { resolveColor } from './MarkerChip'

const TYPE_LABEL = {
  bus: '버스',
  bus_seoul: '서울행 버스',
  shuttle: '셔틀',
  subway: '지하철',
  seohae: '서해선',
}

export default function ClusterListSheet({ members = [], onSelect, onClose }) {
  if (!members.length) return null

  return (
    <Sheet open onClose={onClose} label={`겹친 정류장 ${members.length}개`} placement="bottom">
      <div className="flex items-center justify-between gap-2 px-[18px] pt-1 pb-2">
        <p className="text-head font-extrabold text-ink dark:text-ink">여기 정류장 {members.length}개</p>
        <IconButton label="닫기" variant="ghost" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <ul className="px-[10px] pb-2">
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect?.(m)}
              className="pressable flex w-full items-center gap-3 rounded-button px-2 py-2 min-h-[52px] text-left"
            >
              <span
                aria-hidden="true"
                className="grid h-7 min-w-[28px] flex-none place-items-center rounded-badge px-1.5 text-chip font-extrabold text-white"
                style={{ background: resolveColor(m.routeCode, m.routeColor) }}
              >
                {m.badgeText ?? (m.routeCode ?? '').slice(0, 2) ?? ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-list-nm text-ink dark:text-ink">{m.name}</span>
                <span className="block text-caption text-mute dark:text-mute">{TYPE_LABEL[m.type] ?? ''}</span>
              </span>
              <ChevronRight size={16} className="flex-none text-mute" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
