import { X } from 'lucide-react'
import Sheet from '../ui/Sheet'
import IconButton from '../ui/IconButton'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import StatusChips from '../stats/StatusChips'
import TrafficFlowCard from '../stats/TrafficFlowCard'
import CrowdingCard from '../stats/CrowdingCard'
import WeatherCard from '../stats/WeatherCard'

// Sheet(ui/Sheet)가 백드롭·Escape·포커스 트랩·z 토큰을 전담한다. 예전엔 이 시트가
// bg-black/50 blur 백드롭과 자체 Escape 핸들러를 손으로 들고 있었다 — Sheet.jsx의
// 아홉 벌 독립 구현 중 하나였다(Sheet.jsx 머리말 참고).
export default function StatsSheet({ open, onClose }) {
  const isDesktop = useIsDesktop()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="오늘의 교통 통계"
      placement={isDesktop ? 'center' : 'bottom'}
      className="md:max-w-md"
    >
      <div className="flex items-start justify-between px-5 pt-2 md:pt-4 pb-3 flex-shrink-0">
        <div>
          <h2 className="text-page-ttl text-ink dark:text-ink">
            오늘의 교통
          </h2>
          <p className="mt-1 text-meta font-semibold text-mute dark:text-mute tracking-tight">
            지금 · 이후 흐름
          </p>
        </div>
        <IconButton label="닫기" variant="surface" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <StatusChips />
        <div className="space-y-4">
          <TrafficFlowCard />
          <CrowdingCard />
          <WeatherCard />
        </div>
        <p className="mt-5 text-center text-meta font-semibold text-mute dark:text-mute">
          교통 흐름 · 혼잡도는 과거 데이터 기반 예측입니다
        </p>
      </div>
    </Sheet>
  )
}
