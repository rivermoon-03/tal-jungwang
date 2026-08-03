// 시간대 혼잡 차트 (B4) — GlobalSubwayDetailSheet 요일 탭 아래 · 시간표 리스트 위.
//
// 원칙: 실데이터(stcis 교통카드 통계, 수동 적재)가 없는 동안 UI 가 아예 보이지
// 않아야 한다. API 가 빈 배열을 주면 섹션 자체를 렌더하지 않는다 —
// HomeBriefing.jsx 의 "보여줄 게 없으면 섹션 미렌더" 정책과 동일.
//
// 마크 문법은 ArrivalDistributionBar.jsx 참고 — 단일 색상(accent 계열)만 쓴다.
// 일반 막대 bg-accent/30, 현재 시간대만 bg-accent + 위에 "N시" 라벨.
// 데이터 표 역할은 아래 시간표 리스트가 겸하므로 차트는 role="img" 요약만 제공.
import { useApi } from '../../hooks/useApi'
import {
  CROWDING_HOURS,
  summarizeCrowding,
  toDisplayLevels,
} from './crowdingProfile'

// 실시간 API subwayId 체계 — backend subway_crowding_profile.line_id 와 동일.
const LINE_IDS = { 수인분당선: '1075', '4호선': '1004', 서해선: '1093' }
const DIR_KEYS = { 상행: 'up', 하행: 'down' }

// 축 라벨은 06/10/14/18/22 만 — 18칸 전부 쓰면 12px 라벨이 겹친다.
const AXIS_HOURS = new Set([6, 10, 14, 18, 22])

export default function SubwayCrowdingChart({ station, lineName, direction, enabled = true }) {
  const lineId = LINE_IDS[lineName]
  const dirKey = DIR_KEYS[direction]
  const ready = Boolean(station && lineId && dirKey)

  // 백엔드 HTTP max-age(3600s)와 맞춘 클라이언트 TTL — 시트를 여닫아도 1시간은 재요청 없음.
  const { data } = useApi(
    `/subway/crowding-profile?station=${encodeURIComponent(station ?? '')}&line=${lineId ?? ''}&direction=${dirKey ?? ''}`,
    { enabled: enabled && ready, ttl: 3_600_000 }
  )

  // 빈 배열(테이블 미적재) · 로딩 · 오류 전부 미렌더 — 빈 껍데기가 여백보다 나쁘다.
  if (!ready || !Array.isArray(data) || data.length === 0) return null

  const levels = toDisplayLevels(data)
  const currentHour = new Date().getHours()
  const currentIdx = CROWDING_HOURS.indexOf(currentHour)
  const { peakHour, relaxedHour, maxLevel } = summarizeCrowding(levels, currentHour)

  // 전부 0 인 퇴화 데이터(무승객)면 그릴 것이 없다.
  if (maxLevel <= 0 || peakHour == null) return null

  // em-dash("—")는 UI 렌더 텍스트 금지(tokenRules.test.js c항) — 구분자는 "·" 로 통일.
  const conclusion = `${peakHour}시대 붐빔${
    relaxedHour != null ? ` · ${relaxedHour}시 이후 여유` : ''
  } · 교통카드 통계 기준`
  const ariaLabel = `시간대 혼잡 차트: ${conclusion}`

  return (
    <div data-testid="crowding-section" className="mb-4">
      <p className="text-caption font-bold text-ink dark:text-ink mb-1.5">시간대 혼잡</p>

      {/* 상단 pt 는 현재 시간대 라벨("N시")이 100% 막대와 겹치지 않게 확보하는 띠 */}
      <div role="img" aria-label={ariaLabel} className="relative pt-[18px]">
        {currentIdx >= 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0 -translate-x-1/2 text-meta font-bold text-accent-ink dark:text-accent-ink leading-none whitespace-nowrap"
            style={{ left: `${((currentIdx + 0.5) / CROWDING_HOURS.length) * 100}%` }}
          >
            {currentHour}시
          </span>
        )}

        <div className="flex items-end gap-[2px] h-[54px]">
          {levels.map(({ hour, level }) => (
            <div
              key={hour}
              data-hour={hour}
              className={`flex-1 rounded-t-[3px] ${
                hour === currentHour ? 'bg-accent' : 'bg-accent/30'
              }`}
              // level 0 도 5% 스텁을 남겨 축이 이어져 보이게 한다.
              style={{ height: `${Math.max(5, Math.round(level * 100))}%` }}
            />
          ))}
        </div>

        <div aria-hidden="true" className="flex gap-[2px] mt-1">
          {CROWDING_HOURS.map((hour) => (
            <span
              key={hour}
              className="flex-1 text-center text-meta font-medium text-mute dark:text-mute leading-none"
            >
              {AXIS_HOURS.has(hour) ? String(hour).padStart(2, '0') : ''}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-mute dark:text-mute">
        <span aria-hidden="true" className="w-2 h-2 rounded-full bg-imminent flex-shrink-0" />
        <span>{conclusion}</span>
      </p>
    </div>
  )
}
