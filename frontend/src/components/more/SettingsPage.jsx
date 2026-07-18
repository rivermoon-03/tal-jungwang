/**
 * SettingsPage — 통합 설정 화면 (Phase D, frontend/test/Screens.jsx "설정 · A/B" 시안 대응).
 *
 * 이 화면은 화면/레이아웃 작업만 담당한다. 실제로 동작하는 항목은 테마(다크모드)뿐이고,
 * 나머지(글자 크기·시간표 기본 보기·등하교 자동/수동·알림 전반·데이터 절약 등)는
 * 아직 백엔드/영속 로직이 없어 로컬 state로만 반응하는 데모 UI다.
 * 각 항목이 어떤 로드맵 기능(F1~F7, IMPLEMENTATION-PLAN.md Phase E)으로 연결될지는
 * 항목별 TODO(F#) 주석에 남겨둔다. 이 컴포넌트에서 그 로직을 구현하지 않는다.
 *
 * Props:
 *   onBack               () => void
 *   onOpenAppInfo        () => void  — 기존 AppInfoPage 서브페이지로 이동
 *
 * "노선 알림"(F5) 행은 예외적으로 이 컴포넌트가 직접 동작을 갖는다 — 다른
 * 서브페이지로 이동하지 않고 스위치 하나로 Web Push 구독/해제까지 처리한다.
 * (utils/pushNotifications.js 참조. 실제 백엔드는 별도 PR로 머지될 예정.)
 */
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Palette, Type, LayoutGrid, List, Navigation, Home,
  Bell, Zap, Utensils, Moon, RefreshCw, MapPin, Globe, Trash2, Info,
  ChevronRight,
} from 'lucide-react'
import DarkModeSegment from './DarkModeSegment'
import useAppStore from '../../stores/useAppStore'
import {
  isPushSupported,
  hasActivePushSubscription,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  syncPushFavorites,
} from '../../utils/pushNotifications'

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

function ValueChevron({ value, accent = false }) {
  return (
    <span className={`flex items-center gap-0.5 flex-shrink-0 text-[14px] font-semibold ${accent ? 'text-accent-ink dark:text-accent' : 'text-mute dark:text-mute'}`}>
      {value}
      <ChevronRight size={15} aria-hidden="true" />
    </span>
  )
}

// 대부분은 로컬 state만 반영하는 데모 스위치지만(TODO 항목), "노선 알림"(F5)처럼
// 실제 구독 로직과 연결되는 곳도 있다. onToggle이 없으면(disabled) 탭해도 반응하지 않는다.
function MiniSwitch({ on, onToggle }) {
  const disabled = !onToggle
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onToggle}
      className={`relative flex-shrink-0 w-[42px] h-[25px] rounded-pill transition-colors duration-base ease-out ${on ? 'bg-accent' : 'bg-line dark:bg-line-strong'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute top-[3px] w-[19px] h-[19px] rounded-full bg-white shadow-sh-card transition-transform duration-base ease-spring ${on ? 'translate-x-[20px]' : 'translate-x-[3px]'}`}
      />
    </button>
  )
}

// 2택 세그(자동/수동, 등교/하교 등). 이름은 데모 시절 그대로 남겨뒀지만
// F1(등하교 자동/수동)·F3(시간표 보기) 등 실제 상태와도 연결돼 쓰인다.
function DemoSeg({ options, value, onChange }) {
  return (
    <div className="flex bg-surface-2 dark:bg-bg rounded-button p-1 gap-1" role="group">
      {options.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-mini text-label font-semibold transition-colors pressable ${
              active ? 'bg-surface dark:bg-surface-2 text-ink dark:text-ink shadow-sh-card' : 'text-mute dark:text-mute'
            }`}
          >
            {opt.Icon && <opt.Icon size={13} aria-hidden="true" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsPage({ onBack, onOpenAppInfo }) {
  // F4: 글자 크기 — zustand persist(fontScale) + useFontScale이 --tj-font-scale로 반영.
  // tailwind.config.js의 명명된 fontSize 스케일(text-body/caption/label/head 등)에는
  // 실시간 반영되지만, 컴포넌트 인라인 style={{fontSize:N}}이나 text-[Npx] 임의값에는
  // 적용되지 않는다(알려진 범위 — 전수 적용은 별도 후속 작업).
  const fontScale = useAppStore((s) => s.fontScale)
  const setFontScale = useAppStore((s) => s.setFontScale)
  // F3: 시간표 기본 보기 — zustand persist(scheduleViewMode). ScheduleDetailModal의
  // 초기 viewMode가 이 값을 읽고, 모달에서 바꾼 값도 이 필드에 다시 기록된다.
  const scheduleViewMode = useAppStore((s) => s.scheduleViewMode)
  const setScheduleViewMode = useAppStore((s) => s.setScheduleViewMode)
  // F1: 등하교 판정 자동/수동 — useEffectiveDirection이 commuteAutoMode(persist)를 읽어
  // false면 commuteManualDirection 고정값을, true면 KST 시간+위치 기반 자동 판정을 쓴다.
  const commuteAutoMode = useAppStore((s) => s.commuteAutoMode)
  const setCommuteAutoMode = useAppStore((s) => s.setCommuteAutoMode)
  const commuteManualDirection = useAppStore((s) => s.commuteManualDirection)
  const setCommuteManualDirection = useAppStore((s) => s.setCommuteManualDirection)
  // ── 데모 전용 로컬 state (persist/백엔드 없음, 이 컴포넌트의 담당 범위 밖) ──────
  // TODO(백로그, F5과 별개): 도착 임박 알림 — 즐겨찾기 노선 N분 전. "노선 알림"(막차/첫차)과는
  // 다른 기능이라 이 PR 스코프 밖이다. 실제 구현은 SW Web Push + 백엔드 구독 저장 필요.
  const [imminentAlert, setImminentAlert] = useState(false)
  // TODO(F2): 학식 오픈 알림 — 북마크 × isOpenNow() 교집합 기능(F2)이 선행돼야 의미가 생김.
  const [cafeteriaAlert, setCafeteriaAlert] = useState(false)
  // TODO(백로그, Phase E 미배정): 데이터 절약 모드 — 지도/이미지 최소화. 별도 기획 필요.
  const [dataSaver, setDataSaver] = useState(false)

  // ── F5: 노선 알림(막차/첫차 시각 푸시) ────────────────────────────────
  const favoriteRoutes = useAppStore((s) => s.favorites.routes)
  const [routeAlertOn, setRouteAlertOn] = useState(false)
  const [routeAlertBusy, setRouteAlertBusy] = useState(false)
  // 'default' | 'granted' | 'denied' | 'unsupported'
  const [routeAlertPermission, setRouteAlertPermission] = useState('default')

  useEffect(() => {
    let cancelled = false
    if (!isPushSupported()) {
      setRouteAlertPermission('unsupported')
      return undefined
    }
    setRouteAlertPermission(getNotificationPermission())
    hasActivePushSubscription().then((subscribed) => {
      if (cancelled) return
      setRouteAlertOn(subscribed)
      // 이미 구독 중이면 화면을 열 때마다 현재 즐겨찾기로 한 번 최신화한다
      // (v1 스코프 — favorites 변경 실시간 워처는 만들지 않음).
      if (subscribed) syncPushFavorites(favoriteRoutes)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount 시 1회 + 스위치 토글 시에만 재확인
  }, [])

  const handleToggleRouteAlert = async () => {
    if (routeAlertBusy) return
    setRouteAlertBusy(true)
    try {
      if (routeAlertOn) {
        await unsubscribeFromPush()
        setRouteAlertOn(false)
      } else {
        const result = await subscribeToPush(favoriteRoutes)
        if (result.ok) {
          setRouteAlertOn(true)
          setRouteAlertPermission('granted')
        } else if (result.reason === 'denied') {
          setRouteAlertPermission('denied')
        }
      }
    } finally {
      setRouteAlertBusy(false)
    }
  }

  const routeAlertPermissionDenied = routeAlertPermission === 'denied'
  const routeAlertUnsupported = routeAlertPermission === 'unsupported'
  const routeAlertDesc = routeAlertUnsupported
    ? '이 브라우저는 알림을 지원하지 않아요'
    : routeAlertPermissionDenied
      ? '브라우저 설정에서 알림을 허용해주세요'
      : '막차·첫차 시각 푸시 (즐겨찾기 노선 기준)'

  const fontLabel = ['작게', '보통', '크게'][fontScale] ?? '보통'

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-line dark:hover:bg-line transition-colors"
        >
          <ArrowLeft size={22} className="text-ink dark:text-ink" />
        </button>
        <h1 className="text-panel-ttl text-ink dark:text-ink">설정</h1>
      </div>

      {/*
        PC·설정 시안: 더 넓은 2열 카드 그리드. 모바일은 기존과 동일하게 세로 스택
        (flex-col gap-5), md 브레이크포인트에서만 grid-cols-2로 reflow — 컴포넌트를
        숨기는 게 아니라 같은 마크업을 재배치하는 것뿐이라 CSS 반응형으로 충분하다.
      */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 md:pb-10 md:px-8">
        <div className="flex flex-col gap-5 md:grid md:grid-cols-2 md:gap-6 md:max-w-[1040px] md:mx-auto md:items-start">
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
              <span className="text-[12px]">작게</span>
              <span className="text-[17px] leading-none">크게</span>
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <LayoutGrid size={18} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
              <p className="text-label font-semibold text-ink dark:text-ink">시간표 기본 보기</p>
            </div>
            {/* useAppStore.scheduleViewMode(persist) — ScheduleDetailModal의 초기 viewMode와 공유 */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'grid', label: '그리드', Icon: LayoutGrid },
                { id: 'list', label: '리스트', Icon: List },
              ].map(({ id, label, Icon }) => {
                const active = scheduleViewMode === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setScheduleViewMode(id)}
                    aria-pressed={active}
                    className={`pressable flex flex-col items-center gap-2 rounded-card border-[1.5px] px-3 py-3 transition-colors ${
                      active ? 'border-accent bg-accent-bg' : 'border-line dark:border-line'
                    }`}
                  >
                    <span className={`w-full h-[46px] rounded-mini flex items-center justify-center ${active ? 'text-accent-ink dark:text-accent' : 'text-mute dark:text-mute bg-surface-2 dark:bg-bg'}`}>
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="text-label font-semibold text-ink dark:text-ink">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <Navigation size={18} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-label font-semibold text-ink dark:text-ink">등하교 판정</p>
                <p className="text-caption text-mute dark:text-mute mt-0.5">자동(위치+시간) 또는 수동 시간대 지정</p>
              </div>
            </div>
            {/* useAppStore.commuteAutoMode(persist) — useEffectiveDirection이 그대로 읽는다 */}
            <DemoSeg
              options={[
                { id: true, label: '자동', Icon: Zap },
                { id: false, label: '수동' },
              ]}
              value={commuteAutoMode}
              onChange={setCommuteAutoMode}
            />
            {!commuteAutoMode && (
              <div className="mt-2.5">
                <DemoSeg
                  options={[
                    { id: '등교', label: '등교' },
                    { id: '하교', label: '하교' },
                  ]}
                  value={commuteManualDirection}
                  onChange={setCommuteManualDirection}
                />
              </div>
            )}
          </div>

          <Row icon={Home} title="시작 화면" desc="앱을 열었을 때 처음 보이는 화면" right={<ValueChevron value="홈" />} />
        </SettingsGroup>
        </Section>

        {/* ── 알림 ── */}
        <Section label="알림">
        <SettingsGroup>
          {/* F5: 막차/첫차 시각 푸시 — Web Push 구독/해제를 이 화면에서 직접 처리 */}
          <Row
            icon={Bell}
            title="노선 알림"
            desc={routeAlertDesc}
            right={
              <MiniSwitch
                on={routeAlertOn}
                onToggle={
                  routeAlertUnsupported || routeAlertPermissionDenied || routeAlertBusy
                    ? undefined
                    : handleToggleRouteAlert
                }
              />
            }
          />
          <Row
            icon={Zap}
            title="도착 임박 알림"
            desc="즐겨찾기 노선 N분 전"
            right={<MiniSwitch on={imminentAlert} onToggle={() => setImminentAlert((v) => !v)} />}
          />
          <Row
            icon={Utensils}
            title="학식 오픈 알림"
            desc="북마크한 식당 영업 시작 시"
            right={<MiniSwitch on={cafeteriaAlert} onToggle={() => setCafeteriaAlert((v) => !v)} />}
          />
          <Row icon={Moon} title="방해 금지" desc="이 시간대엔 알림을 보내지 않아요" right={<ValueChevron value="23–07시" />} />
        </SettingsGroup>
        </Section>

        {/* ── 데이터 · 위치 ── */}
        <Section label="데이터 · 위치">
        <SettingsGroup>
          <Row icon={RefreshCw} title="실시간 새로고침" desc="도착 정보 자동 갱신 주기" right={<ValueChevron value="30초" />} />
          <Row
            icon={Zap}
            title="데이터 절약 모드"
            desc="지도·이미지를 최소화해요"
            right={<MiniSwitch on={dataSaver} onToggle={() => setDataSaver((v) => !v)} />}
          />
          <Row icon={MapPin} title="위치 권한" desc="브라우저/기기 설정에서 변경할 수 있어요" right={<ValueChevron value="사용 중" />} />
        </SettingsGroup>
        </Section>

        {/* ── 기타 ── */}
        <Section label="기타">
        <SettingsGroup>
          <Row icon={Globe} title="언어" right={<ValueChevron value="한국어" />} />
          <Row icon={Trash2} title="캐시 비우기" right={<span className="text-[14px] font-semibold text-mute dark:text-mute">관리 예정</span>} />
          {/* 실제 동작: 기존 AppInfoPage 서브페이지로 이동 */}
          <Row icon={Info} title="앱 정보 · 오픈소스" right={<ChevronRight size={16} className="text-mute dark:text-mute" aria-hidden="true" />} onClick={onOpenAppInfo} />
        </SettingsGroup>
        </Section>
        </div>
      </div>
    </div>
  )
}
