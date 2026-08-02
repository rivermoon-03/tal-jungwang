/**
 * HelpPage — 도움말 sub-page.
 *
 * 홈 화면 위젯은 앱 안에서 설명할 자리가 없다. 런처가 위젯을 숨기거나(플레이스토어
 * 설치본이 아닌 경우·홈 화면 잠금) 30분 최소 갱신 주기 때문에 "고장 났다"고 읽히는
 * 상황이 대부분 사용자 환경 문제라, 원인별 확인 순서를 여기에 적어둔다.
 *
 * Props:
 *   onBack    () => void
 *   embedded  boolean — PC 레이아웃에 끼워 넣을 때 자체 헤더를 그리지 않는다
 */
import {
  ChevronLeft, LayoutGrid, Search, RefreshCw, HelpCircle, Bus, UtensilsCrossed, CalendarDays,
} from 'lucide-react'

// 위젯 3종 — 크기와 "이 위젯이 답하는 질문"을 함께 적는다. 크기만 나열하면
// 사용자가 어느 걸 놓을지 못 고른다.
const WIDGETS = [
  {
    icon: Bus,
    name: '교통',
    size: '4 × 2',
    desc: '셔틀과 지하철 중 하나를 골라, 등교·하교(상행·하행)를 좌우로 함께 본다.',
    how: '아래 칩으로 셔틀 ↔ 지하철, 헤더 칩으로 캠퍼스(1캠·2캠) 또는 역(정왕·초지·시흥시청)을 고른다.',
  },
  {
    icon: UtensilsCrossed,
    name: '학식',
    size: '2 × 2',
    desc: '지금 시각에 맞는 끼니의 오늘 식단, 또는 지금 문 연 교내 매장을 본다.',
    how: '아래 칩으로 식단 ↔ 운영정보, 헤더 칩으로 TIP 지하식당 ↔ E동 레스토랑을 고른다.',
  },
  {
    icon: CalendarDays,
    name: '학사일정',
    size: '4 × 2',
    desc: '수강신청·등록처럼 하루만 놓쳐도 복구가 안 되는 일정을 D-day로 본다.',
    how: '선택 칩이 없다. 가장 임박한 일정 3개가 자동으로 올라오고, 3일 이내는 빨갛게 표시된다.',
  },
]

// "안 보인다"의 원인은 대부분 런처·설치 경로 문제다. 확인 비용이 낮은 순서로 둔다.
const NOT_SHOWING = [
  {
    q: '플레이스토어에서 받은 앱인가요?',
    a: '위젯은 안드로이드 앱에만 있습니다. 브라우저에서 "홈 화면에 추가"로 만든 바로가기에는 위젯이 없습니다.',
  },
  {
    q: '설치 후 앱을 한 번 실행했나요?',
    a: '런처가 위젯 목록을 다시 읽기 전까지는 목록에 뜨지 않을 수 있습니다. 앱을 한 번 열었다가 홈으로 나온 뒤 다시 찾아보세요.',
  },
  {
    q: '홈 화면 잠금이 켜져 있지 않나요?',
    a: '삼성 One UI 등 일부 런처는 "홈 화면 레이아웃 잠금"이 켜져 있으면 위젯을 놓을 수 없습니다. 홈 화면 설정에서 잠금을 끄세요.',
  },
  {
    q: '홈 화면에 빈 공간이 있나요?',
    a: '4 × 2 위젯은 가로 한 줄 전체가 비어 있어야 놓입니다. 아이콘을 옮겨 자리를 만들거나 페이지를 새로 만드세요.',
  },
  {
    q: '그래도 없다면',
    a: '기기를 다시 시작하거나 앱을 재설치하면 런처가 위젯 목록을 새로 읽습니다.',
  },
]

const NOT_UPDATING = [
  {
    q: '시각이 오래됐어요',
    a: '안드로이드는 위젯 자동 갱신 주기를 최소 30분으로 제한합니다. 잠금 화면을 풀 때와 새로고침을 누를 때는 즉시 갱신됩니다.',
  },
  {
    q: '절전 모드를 쓰고 있나요?',
    a: '설정 → 배터리에서 탈것:정왕을 절전 예외로 두면 백그라운드 갱신이 막히지 않습니다.',
  },
  {
    q: '데이터 세이버가 켜져 있나요?',
    a: '백그라운드 데이터가 차단되면 위젯이 새 정보를 받지 못합니다. 예외 앱으로 허용해 주세요.',
  },
  {
    q: '화면이 그대로예요',
    a: '통신에 실패해도 마지막에 성공한 화면을 지우지 않습니다. 빈 화면으로 깜빡이는 것보다 낫기 때문입니다. 실제 기준 시각은 위젯 오른쪽 아래 "HH:MM 갱신"으로 확인하세요.',
  },
]

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2">
      <Icon size={16} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
      <h2 className="text-label font-bold text-ink dark:text-ink">{children}</h2>
    </div>
  )
}

function QaList({ items }) {
  return (
    <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card overflow-hidden divide-y divide-line dark:divide-line">
      {items.map(({ q, a }) => (
        <div key={q} className="px-4 py-3">
          <p className="text-label font-semibold text-ink dark:text-ink">{q}</p>
          <p className="text-caption text-mute dark:text-mute mt-1 leading-relaxed">{a}</p>
        </div>
      ))}
    </div>
  )
}

export default function HelpPage({ onBack, embedded = false }) {
  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      {!embedded && (
        <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
          <button
            onClick={onBack}
            aria-label="뒤로"
            className="p-2 -ml-2 rounded-full hover:bg-line dark:hover:bg-line transition-colors"
          >
            <ChevronLeft size={22} className="text-ink dark:text-ink" />
          </button>
          <h1 className="text-panel-ttl text-ink dark:text-ink">도움말</h1>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-28 md:pb-6 flex flex-col gap-6">
        <section>
          <SectionTitle icon={LayoutGrid}>홈 화면 위젯</SectionTitle>
          <p className="text-caption text-mute dark:text-mute leading-relaxed px-1 mb-3">
            앱을 열지 않고 홈 화면에서 바로 다음 차와 오늘 식단을 봅니다. 위젯마다 선택한
            캠퍼스·역·식당은 위젯별로 따로 저장돼, 같은 위젯을 두 개 놓고 서로 다르게 둘 수 있습니다.
          </p>
          <div className="flex flex-col gap-2">
            {WIDGETS.map(({ icon: Icon, name, size, desc, how }) => (
              <div
                key={name}
                className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-mini bg-surface-2 dark:bg-bg flex items-center justify-center text-accent flex-shrink-0"
                    aria-hidden="true"
                  >
                    <Icon size={18} />
                  </div>
                  <p className="text-body font-semibold text-ink dark:text-ink flex-1 min-w-0">{name}</p>
                  <span className="text-meta font-bold text-mute dark:text-mute tabular-nums flex-shrink-0">
                    {size}
                  </span>
                </div>
                <p className="text-caption text-ink-2 dark:text-ink-2 mt-2 leading-relaxed">{desc}</p>
                <p className="text-caption text-mute dark:text-mute mt-1 leading-relaxed">{how}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle icon={Search}>위젯 놓는 법</SectionTitle>
          <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-4 py-3.5">
            <ol className="flex flex-col gap-2.5">
              {[
                '홈 화면의 빈 곳을 길게 누릅니다.',
                '아래에 뜨는 메뉴에서 위젯을 고릅니다.',
                '목록에서 탈것:정왕을 찾습니다. 검색창이 있으면 "탈것"으로 찾는 편이 빠릅니다.',
                '원하는 위젯을 길게 눌러 홈 화면으로 끌어다 놓습니다.',
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full bg-accent text-white text-meta font-bold flex items-center justify-center flex-shrink-0 tabular-nums"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="text-caption text-ink dark:text-ink leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section>
          <SectionTitle icon={HelpCircle}>위젯이 목록에 없어요</SectionTitle>
          <QaList items={NOT_SHOWING} />
        </section>

        <section>
          <SectionTitle icon={RefreshCw}>위젯이 갱신되지 않아요</SectionTitle>
          <QaList items={NOT_UPDATING} />
        </section>
      </div>
    </div>
  )
}
