/**
 * NotificationsPage — 알림 설정 안내 sub-page.
 *
 * 실제 스위치/칩 조작은 설정 화면(SettingsPage 알림 섹션)에 있고, 이 페이지는
 * 어떤 알림이 실제로 동작하고 무엇이 준비 중인지 구분해 안내한다.
 * 도착 임박·학식 오픈은 아직 데모(SettingsPage 로컬 state) — "준비 중" 캡션으로 표시.
 *
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft, BellRing, Bell, Zap, Utensils } from 'lucide-react'

function GuideCard({ icon: Icon, title, badge, children }) {
  return (
    <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-4 py-3.5">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Icon size={17} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
        <p className="text-label font-semibold text-ink dark:text-ink flex-1 min-w-0">{title}</p>
        {badge}
      </div>
      <div className="text-caption text-mute dark:text-mute leading-relaxed pl-[27px]">
        {children}
      </div>
    </div>
  )
}

function StatusBadge({ ready }) {
  return (
    <span
      className={`flex-shrink-0 px-2 py-0.5 rounded-pill text-caption font-semibold ${
        ready
          ? 'bg-accent-bg text-accent-ink dark:text-accent-ink'
          : 'bg-surface-2 dark:bg-bg text-mute dark:text-mute'
      }`}
    >
      {ready ? '사용 가능' : '준비 중'}
    </span>
  )
}

export default function NotificationsPage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-line dark:hover:bg-line transition-colors"
        >
          <ChevronLeft size={22} className="text-ink dark:text-ink" />
        </button>
        <h1 className="text-panel-ttl text-ink dark:text-ink">알림 설정</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
        <div className="flex flex-col gap-3 max-w-md">
          <p className="text-caption text-mute dark:text-mute leading-relaxed px-1">
            알림은 더보기 &gt; 설정 &gt; 알림에서 켜고 끌 수 있어요. 처음 켤 때
            브라우저 알림 권한을 허용해 주세요.
          </p>

          <GuideCard icon={BellRing} title="막차 알림" badge={<StatusBadge ready />}>
            정왕역 지하철 막차가 떠나기 전에 미리 알려줘요. 상행·하행 막차 시각을
            한 번에 보여주고, 1시간 전 · 30분 전 · 15분 전 중에서 고를 수 있어요.
            매일 자동으로 그날 시간표(평일/휴일) 기준으로 계산해요.
          </GuideCard>

          <GuideCard icon={Bell} title="노선 알림" badge={<StatusBadge ready />}>
            즐겨찾기한 버스·셔틀·지하철 노선의 막차와 첫차가 30분 뒤에 출발할 때
            알려줘요. 즐겨찾기를 바꾸면 설정 화면을 다시 열 때 반영돼요.
          </GuideCard>

          <GuideCard icon={Zap} title="도착 임박 알림" badge={<StatusBadge ready={false} />}>
            즐겨찾기 노선이 몇 분 뒤 도착하는지 실시간으로 알려주는 기능을 준비하고
            있어요. 지금 설정 화면의 스위치는 미리보기예요.
          </GuideCard>

          <GuideCard icon={Utensils} title="학식 오픈 알림" badge={<StatusBadge ready={false} />}>
            북마크한 식당이 영업을 시작할 때 알려주는 기능을 준비하고 있어요. 지금
            설정 화면의 스위치는 미리보기예요.
          </GuideCard>
        </div>
      </div>
    </div>
  )
}
