/**
 * MapLegendOnboarding — 지도 우상단 ⓘ 버튼 + 접이식 범례.
 *
 * 이전: 최초 진입 시 우하단에 다크 토스트가 자동으로 뜨고, 한 번 닫으면
 * localStorage에 영구 기록돼 다시는 볼 방법이 없었다. 지도 위에 늘 떠 있는
 * 상시 노출 UI라 다른 조작(FAB·핀 탭)을 가리기도 했다.
 * 이후: 평소엔 작은 ⓘ 버튼만 떠 있고, 탭할 때만 범례 패널이 펼쳐진다 — 필요할
 * 때 언제든 다시 열어볼 수 있다.
 *
 * Props:
 *   embedded — true면 자체 absolute 컨테이너 없이 버튼+패널만 반환한다
 *     (MapView가 mapExpanded 상태의 우측 상단 세로 컨트롤 스택에 끼워 넣을 때 사용).
 *     false(기본)면 PCMainShell처럼 독립적으로 배치되는 호출부를 위해
 *     자체 absolute 컨테이너(top-3 right-3)를 두른다.
 */
import { useState } from 'react'
import { Info, X, Bus, TrainFront } from 'lucide-react'
import { tjLineColor } from '../common/lineColor'
import IconButton from '../ui/IconButton'

// 범례 항목 — 마커 칩/배지에서 실제로 쓰는 색을 그대로 토큰으로 참조한다
// (인라인 hex 대신 --tj-* 변수 — 다크 모드에서도 칩과 색이 어긋나지 않는다).
const LEGEND_ITEMS = [
  { color: 'var(--tj-delayed)', label: '하교 · 제2등교', desc: '학교 출발 다음 버스까지 남은 시간' },
  { color: 'var(--tj-ease)', label: 'G', desc: '현재 정류장 근처 실시간 운행 중인 버스' },
  { color: 'var(--tj-imminent)', label: '한국공대 · 정왕역', desc: '도보 예상 시간' },
]

// 마커 색 범례 — "마커 색이 무엇을 뜻하는지" 앱 어디에도 답이 없던 것을 채운다.
// 색은 절대 여기서 직접 정하지 않고 lineColor.js의 tjLineColor()만 거쳐 읽는다
// (대표 노선코드를 넘겨 실제 지도 마커와 같은 CSS 변수를 그대로 받는다).
const MARKER_LEGEND_ITEMS = [
  { key: 'bus',       glyph: Bus,       label: '버스',       color: tjLineColor('20-1') },
  { key: 'bus_seoul', glyph: Bus,       label: '서울행 버스', color: tjLineColor('3400') },
  { key: 'shuttle',   glyph: Bus,       label: '셔틀',       color: tjLineColor('셔틀') },
  { key: 'line4',     glyph: TrainFront, label: '4호선',      color: tjLineColor('4호선') },
  { key: 'suin',      glyph: TrainFront, label: '수인분당',   color: tjLineColor('수인분당') },
  { key: 'seohae',    glyph: TrainFront, label: '서해선',     color: tjLineColor('서해선') },
]

function LegendButton({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="지도 표시 안내"
      aria-expanded={open}
      title="지도 표시 안내"
      className="w-9 h-9 rounded-full bg-surface dark:bg-surface shadow-pill flex items-center justify-center active:scale-[0.94] transition-transform duration-press ease-spring"
    >
      <Info size={17} className="text-accent dark:text-accent" aria-hidden="true" />
    </button>
  )
}

function LegendPanel({ onClose }) {
  return (
    <div
      role="dialog"
      aria-label="지도 표시 안내"
      className="absolute right-0 top-[calc(100%+8px)] z-popover w-64 rounded-card border border-line dark:border-line bg-surface dark:bg-surface p-3 shadow-sh-pop"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-caption font-extrabold text-ink dark:text-ink">지도 표시 안내</p>
        <IconButton label="닫기" variant="ghost" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </IconButton>
      </div>
      <ul className="space-y-1.5">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.label} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              style={{ background: item.color }}
              className="mt-[3px] h-2.5 w-2.5 flex-shrink-0 rounded-pill"
            />
            <span className="text-caption text-ink-2 dark:text-ink-2 leading-snug">
              <strong className="font-bold text-ink dark:text-ink">{item.label}</strong> · {item.desc}
            </span>
          </li>
        ))}
        {/* 클러스터 배지("+N")는 설명 없이 숫자만 보이면 뜻을 알기 어렵다 */}
        <li className="flex items-start gap-2">
          <span
            aria-hidden="true"
            style={{ background: 'var(--tj-ink)' }}
            className="mt-[3px] h-2.5 w-2.5 flex-shrink-0 rounded-pill"
          />
          <span className="text-caption text-ink-2 dark:text-ink-2 leading-snug">
            <strong className="font-bold text-ink dark:text-ink">숫자 배지</strong> · 겹친 정류장 여러 개, 탭하면 확대돼요
          </span>
        </li>
      </ul>

      {/* 마커 색 범례 — 색 스와치 + 글리프 + 이름 표. 마커 칩 dot과 같은 색(위 LEGEND_ITEMS와
          달리 이 항목은 "마커 자체가 무슨 노선군인지"를 설명한다 — 별도 표로 분리). */}
      <p className="mt-3 mb-1.5 text-caption font-extrabold text-mute dark:text-mute">마커 색</p>
      <ul className="space-y-1.5">
        {MARKER_LEGEND_ITEMS.map((item) => {
          const Glyph = item.glyph
          return (
            <li key={item.key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                style={{ background: item.color }}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-pill text-white"
              >
                <Glyph size={12} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="text-caption font-bold text-ink dark:text-ink">{item.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function MapLegendOnboarding({ embedded = false }) {
  const [open, setOpen] = useState(false)

  if (embedded) {
    return (
      <div className="relative">
        <LegendButton open={open} onToggle={() => setOpen((v) => !v)} />
        {open && <LegendPanel onClose={() => setOpen(false)} />}
      </div>
    )
  }

  return (
    <div className="absolute top-3 right-3 z-[50]">
      <LegendButton open={open} onToggle={() => setOpen((v) => !v)} />
      {open && <LegendPanel onClose={() => setOpen(false)} />}
    </div>
  )
}
