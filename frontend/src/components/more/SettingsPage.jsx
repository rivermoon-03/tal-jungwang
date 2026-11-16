/**
 * SettingsPage — 통합 설정 화면 (Phase D, frontend/test/Screens.jsx "설정 · A/B" 시안 대응).
 *
 * 실제로 동작하는 항목은 테마와 글자 크기다. 나머지는 준비 중 배지로 구분한다.
 */
import { ArrowLeft, Palette, Type, Zap, RefreshCw, MapPin, Info, ChevronRight } from 'lucide-react'
import DarkModeSegment from './DarkModeSegment'
import IconButton from '../ui/IconButton'
import useAppStore from '../../stores/useAppStore'

// ── 공용 행/섹션 프리미티브 (DESIGN.md sc-set 대응) ──────────────────────
function SectionLabel({ children }) {
  return (
    <div className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest px-1 mb-2">
      {children}
    </div>
  )
}

function SettingsGroup({ children }) {
  return (
    <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card overflow-hidden divide-y divide-line dark:divide-line">
      {children}
    </div>
  )
}

// 라벨+그룹을 한 단위로 묶어, PC 브레이크포인트에서 2열 그리드의 grid item으로
// 쓸 수 있게 한다(PC·설정 시안 — 더 넓은 카드 그리드). 모바일은 기존과 동일하게
// 세로로 쌓인다 — CSS는 열 개수만 바꿀 뿐 컴포넌트 자체를 숨기지 않는다.
function Section({ label, children }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  )
}

function Row({ icon: Icon, title, desc, right, onClick }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left ${onClick ? 'pressable' : ''}`}
    >
      <Icon size={18} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-label font-semibold text-ink dark:text-ink">{title}</p>
        {desc && <p className="text-caption text-mute dark:text-mute mt-0.5 leading-snug">{desc}</p>}
      </div>
      {right}
    </Comp>
  )
}

// "준비 중" 배지 — 로컬 state뿐인 데모 스위치를, 서버에 실제로 저장되는 노선
// 알림/막차 알림 스위치와 시각적으로 구분한다. NotificationsPage의
// StatusBadge(준비 중/사용 가능)와 같은 어휘를 쓴다.
function PreparingBadge() {
  return (
    <span className="flex-shrink-0 px-2 py-0.5 rounded-pill text-caption font-semibold bg-surface-2 dark:bg-bg text-mute dark:text-mute">
      준비 중
    </span>
  )
}

// 대부분은 로컬 state만 반영하는 데모 스위치지만(TODO 항목), "노선 알림"(F5)처럼
// 실제 구독 로직과 연결되는 곳도 있다. onToggle이 없으면(disabled) 탭해도 반응하지 않는다.
function MiniSwitch({ on, onToggle, label }) {
  const disabled = !onToggle
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={disabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative flex-shrink-0 w-[42px] h-[25px] rounded-pill transition-colors duration-base ease-out ${on ? 'bg-accent' : 'bg-line dark:bg-line-strong'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute left-0 top-[3px] w-[19px] h-[19px] rounded-full bg-white shadow-sh-card transition-transform duration-base ease-spring ${on ? 'translate-x-[20px]' : 'translate-x-[3px]'}`}
      />
    </button>
  )
}

// 2택 세그(자동/수동, 등교/하교 등). 이름은 데모 시절 그대로 남겨뒀지만
// F1(등하교 자동/수동)·F3(시간표 보기) 등 실제 상태와도 연결돼 쓰인다.
export default function SettingsPage({ onBack, onOpenAppInfo, embedded = false }) {
  // F4: 글자 크기 — zustand persist(fontScale) + useFontScale이 --tj-font-scale로 반영.
  // tailwind.config.js의 명명된 fontSize 스케일(text-body/caption/label/head 등)에
  // 실시간 반영된다. 컴포넌트 인라인 style={{fontSize:N}}이나 text-[Npx] 임의값은
  // 이 스케일 밖이라 슬라이더가 안 먹었는데, 2026-09에 src/components·src/pages
  // 전역에서 전수 토큰화해 닫았다(tokenRules.test.js가 회귀를 막는다).
  const fontScale = useAppStore((s) => s.fontScale)
  const setFontScale = useAppStore((s) => s.setFontScale)
  const fontLabel = ['작게', '보통', '크게'][fontScale] ?? '보통'

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      {!embedded && (
        <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
          <IconButton label="뒤로" onClick={onBack}>
            <ArrowLeft size={22} className="text-ink dark:text-ink" />
          </IconButton>
          <h1 className="text-panel-ttl text-ink dark:text-ink">설정</h1>
        </div>
      )}

      {/*
        PC·설정 시안: 더 넓은 2열 카드 그리드. 모바일은 기존과 동일하게 세로 스택
        (flex-col gap-5), md 브레이크포인트에서만 grid-cols-2로 reflow — 컴포넌트를
        숨기는 게 아니라 같은 마크업을 재배치하는 것뿐이라 CSS 반응형으로 충분하다.
      */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 md:pb-10 md:px-8">
        <div className="flex flex-col gap-5 md:grid md:grid-cols-2 md:gap-6 md:max-w-[1040px] md:items-start">
        {/* ── 개인화 ── */}
        <Section label="개인화">
        <SettingsGroup>
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <Palette size={18} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
              <p className="text-label font-semibold text-ink dark:text-ink">테마</p>
            </div>
            {/* 실제로 동작하는 유일한 항목 — useAppStore.themeMode를 그대로 읽고 쓴다 */}
            <DarkModeSegment />
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Type size={18} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-label font-semibold text-ink dark:text-ink">글자 크기</p>
                  <p className="text-caption text-mute dark:text-mute mt-0.5">{fontLabel}</p>
                </div>
              </div>
            </div>
            {/* useFontScale이 --tj-font-scale에 실시간 반영 */}
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              aria-label="글자 크기"
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-caption text-mute dark:text-mute mt-1">
              <span className="text-meta font-normal">작게</span>
              <span className="text-head font-normal leading-none">크게</span>
            </div>
          </div>

        </SettingsGroup>
        </Section>

        {/* ── 데이터 · 위치 ── */}
        <Section label="데이터 · 위치">
        <SettingsGroup>
          {/* 셋 다 실제 값을 알지 못한다 — "30초"/"사용 중"처럼 고정 문구를
              보여주면 실제 상태(권한 거부 등)와 어긋날 수 있어 대신 준비 중임을
              밝힌다. */}
          <Row icon={RefreshCw} title="실시간 새로고침" desc="도착 정보 자동 갱신 주기" right={<PreparingBadge />} />
          <Row
            icon={Zap}
            title="데이터 절약 모드"
            desc="지도·이미지를 최소화해요"
            right={
              <div className="flex items-center gap-2">
                <PreparingBadge />
                <MiniSwitch on={false} label="데이터 절약 모드" />
              </div>
            }
          />
          <Row icon={MapPin} title="위치 권한" desc="브라우저/기기 설정에서 변경할 수 있어요" right={<PreparingBadge />} />
        </SettingsGroup>
        </Section>

        {/* ── 기타 ── */}
        <Section label="기타">
        <SettingsGroup>
          {/* 누르면 아무 일도 일어나지 않던 "언어"와 "캐시 비우기(관리 예정)" 행은
              뺐다. 동작하지 않는 항목이 설정에 남아 있으면 나머지 설정도 믿기
              어려워진다. 기능이 실제로 붙을 때 다시 넣는다. */}
          {/* 실제 동작: 기존 AppInfoPage 서브페이지로 이동 */}
          <Row icon={Info} title="앱 정보 · 오픈소스" right={<ChevronRight size={16} className="text-mute dark:text-mute" aria-hidden="true" />} onClick={onOpenAppInfo} />
        </SettingsGroup>
        </Section>
        </div>
      </div>
    </div>
  )
}
