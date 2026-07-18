/**
 * UpcomingScheduleModal — 더보기 "학사공지" 탭의 D-day 배너를 탭하면 열리는
 * "다가오는 일정" 바텀시트.
 *
 * AcademicNoticesTab이 이미 들고 있는 upcoming 배열(앞쪽 몇 개)을 그대로 받아
 * 제목+날짜만 보여준다 — 추가 네트워크 호출 없음.
 *
 * vaul(Drawer) 기반 스와이프 다운 닫기 — ScheduleDetailModal/GlobalSubwayLineSheet와
 * 동일한 패턴(Drawer.Root/Portal/Overlay/Content, sr-only Drawer.Title, 드래그 핸들).
 * MorePage는 PCMainShell 분할 레이아웃 밖의 단일 페이지라 PC 전용 분기 없이
 * 모든 화면 크기에서 동일한 바텀시트로 충분하다.
 */
import { Drawer } from 'vaul'
import { X, CalendarDays } from 'lucide-react'
import { formatDateOrRange } from '../../utils/academicCalendar'

export default function UpcomingScheduleModal({ open, onClose, items = [] }) {
  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose() }} dismissible>
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
          style={{ transition: `opacity var(--dur-motion-sheet) var(--e-out)` }}
        />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[100] bg-surface dark:bg-surface rounded-t-sheet shadow-2xl flex flex-col overflow-hidden outline-none"
          style={{ maxHeight: '70dvh' }}
        >
          <Drawer.Title className="sr-only">다가오는 일정</Drawer.Title>
          {/* 드래그 핸들 — vaul이 전체 시트 드래그를 처리하므로 시각적 표시만 담당 */}
          <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
            <span className="w-12 h-1.5 rounded-full bg-line dark:bg-line" />
          </div>

          <div className="flex items-center gap-2.5 px-5 pb-3 flex-shrink-0 border-b border-line dark:border-line">
            <CalendarDays size={18} className="text-accent dark:text-accent flex-shrink-0" aria-hidden="true" />
            <p className="flex-1 text-display text-ink dark:text-ink truncate" style={{ letterSpacing: '-0.03em' }}>
              다가오는 일정
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="pressable p-2 rounded-full hover:bg-surface-2 dark:hover:bg-surface transition-colors flex-shrink-0"
            >
              <X size={18} className="text-ink-2 dark:text-mute" />
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto px-5 pt-3"
            style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
          >
            {items.length === 0 ? (
              <p className="text-body text-mute dark:text-mute text-center py-8">다가오는 일정이 없어요</p>
            ) : (
              <div className="flex flex-col gap-3 pb-2">
                {items.map((ev, i) => (
                  <div key={`${ev.title}-${ev.start_date}-${i}`} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-body font-bold text-ink dark:text-ink leading-snug">{ev.title}</p>
                      <p className="text-label font-semibold text-mute dark:text-mute mt-0.5">
                        {formatDateOrRange(ev.start_date, ev.end_date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
