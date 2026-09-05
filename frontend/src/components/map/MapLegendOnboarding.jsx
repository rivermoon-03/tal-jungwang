/**
 * MapLegendOnboarding — 지도 우상단 ⓘ 버튼 + 범례 시트.
 *
 * 이전: 최초 진입 시 우하단에 다크 토스트가 자동으로 뜨고, 한 번 닫으면
 * localStorage에 영구 기록돼 다시는 볼 방법이 없었다. 그 다음엔 ⓘ 아래에
 * 256px 팝오버로 펼쳤는데, 팝오버 높이(406px)가 하단 최근접 정류장 카드와
 * 내 위치 FAB 아래로 들어가 절반이 가려졌다(뷰포트 698px 기기에서 실측).
 * 이후: 공용 ui/Sheet(바텀시트)로 연다. 다른 오버레이와 겹칠 수 없고 어느
 * 화면 높이에서도 전부 보인다.
 *
 * 항목도 줄였다. 예전 "G", "하교 · 제2등교", "한국공대 · 정왕역" 같은 칩 안 요소
 * 설명은 기본 도트 모드에서는 보이지도 않는 것을 설명하고 있었다. 마커 색 표,
 * 숫자 배지, 도로 색 세 가지만 남긴다.
 *
 * Props:
 *   embedded — true면 자체 absolute 컨테이너 없이 버튼만 반환한다
 *     (MapView가 mapExpanded 상태의 우측 상단 세로 컨트롤 스택에 끼워 넣을 때 사용).
 *     false(기본)면 PCMainShell처럼 독립적으로 배치되는 호출부를 위해
 *     자체 absolute 컨테이너(top-3 right-3)를 두른다.
 */
import { useState } from 'react'
import { Info, X, Bus, TrainFront } from 'lucide-react'
import { tjLineColor } from '../common/lineColor'
import IconButton from '../ui/IconButton'
import Sheet from '../ui/Sheet'
import { CONGESTION_COLOR, CONGESTION_LABEL } from './trafficLevels'

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

// 교통 링 색 — TrafficRoadOverlay 가 쓰는 네 단계를 그대로 읽는다.
const ROAD_LEGEND_ITEMS = [1, 2, 3, 4].map((level) => ({
  key: String(level),
  label: CONGESTION_LABEL[level],
  color: CONGESTION_COLOR[level],
}))

function LegendButton({ open, onToggle }) {
  return (
    <IconButton
      label="지도 표시 안내"
      title="지도 표시 안내"
      variant="floating"
      aria-expanded={open}
      onClick={onToggle}
      className="rounded-full border border-line dark:border-line active:scale-[0.94] transition-transform duration-press ease-spring"
    >
      <Info size={18} className="text-accent dark:text-accent" aria-hidden="true" />
    </IconButton>
  )
}

function LegendSheet({ open, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} label="지도 표시 안내" placement="bottom">
      <div className="flex items-center justify-between gap-2 px-[18px] pt-1 pb-2">
        <p className="text-head font-extrabold text-ink dark:text-ink">지도 표시 안내</p>
        <IconButton label="닫기" variant="ghost" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="px-[18px] pb-4">
        <p className="mb-2 text-caption font-extrabold text-mute dark:text-mute">마커 색</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          {MARKER_LEGEND_ITEMS.map((item) => {
            const Glyph = item.glyph
            return (
              <li key={item.key} className="flex items-center gap-2 min-h-[28px]">
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

        <ul className="mt-4 space-y-2 text-caption text-ink-2 dark:text-ink-2 leading-snug">
          <li className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-[2px] grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-pill text-chip font-extrabold"
              style={{ background: 'var(--tj-ink)', color: 'var(--tj-bg)' }}
            >
              3
            </span>
            <span>
              <strong className="font-bold text-ink dark:text-ink">숫자 배지</strong>는 겹친 정류장 수다. 탭하면 펼쳐진다.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-[7px] flex flex-shrink-0 gap-[3px]">
              {ROAD_LEGEND_ITEMS.map((r) => (
                <span key={r.key} className="h-[5px] w-[6px] rounded-pill" style={{ background: r.color }} />
              ))}
            </span>
            <span>
              <strong className="font-bold text-ink dark:text-ink">자동차 링</strong>은 마유로 교통 흐름이다. 색은 {ROAD_LEGEND_ITEMS.map((r) => r.label).join(', ')} 순이다. 탭하면 방향별 속도가 보인다.
            </span>
          </li>
        </ul>
      </div>
    </Sheet>
  )
}

export default function MapLegendOnboarding({ embedded = false }) {
  const [open, setOpen] = useState(false)

  const button = <LegendButton open={open} onToggle={() => setOpen((v) => !v)} />
  const sheet = <LegendSheet open={open} onClose={() => setOpen(false)} />

  if (embedded) {
    return (
      <>
        {button}
        {sheet}
      </>
    )
  }

  return (
    <div className="absolute top-3 right-3 z-[50]">
      {button}
      {sheet}
    </div>
  )
}
