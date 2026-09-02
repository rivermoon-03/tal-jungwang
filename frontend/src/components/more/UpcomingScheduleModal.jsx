/**
 * UpcomingScheduleModal — 더보기 "학사공지" 탭의 "다가오는 학사일정" 리스트에서
 * "전체 일정 보기"를 탭하면 열리는 바텀시트(상위 4개 밖의 나머지 일정도 여기서 본다).
 *
 * AcademicNoticesTab이 이미 들고 있는 전체 이벤트 배열을 그대로 받아
 * 제목+날짜만 보여준다 — 추가 네트워크 호출 없음. onSelect가 있으면 항목을
 * 탭했을 때 그 날짜로 캘린더 포커스를 옮기고(모달은 닫힘), 없으면 단순 목록이다.
 *
 * ui/Sheet 기반(백드롭·Escape·포커스 트랩·z 토큰을 위임). 예전엔 vaul을 직접 써
 * 스와이프 다운 닫기를 구현했지만, 다른 시트들과 같은 이유로 제거했다 — 아홉 벌
 * 독립 구현을 하나로 맞추는 리팩터라 배경 탭/Escape로 닫는 것만 남긴다
 * (ScheduleDetailModal/GlobalSubwayLineSheet와 동일한 트레이드오프).
 */
import { X, CalendarDays } from 'lucide-react'
import Sheet from '../ui/Sheet'
import IconButton from '../ui/IconButton'
import { formatDateOrRange } from '../../utils/academicCalendar'

export default function UpcomingScheduleModal({ open, onClose, items = [], onSelect }) {
  return (
    <Sheet open={open} onClose={onClose} label="다가오는 학사일정" placement="bottom" className="h-[70dvh]">
      <div className="flex items-center gap-2.5 px-5 pb-3 flex-shrink-0 border-b border-line dark:border-line">
        <CalendarDays size={18} className="text-accent dark:text-accent flex-shrink-0" aria-hidden="true" />
        <p className="flex-1 text-display text-ink dark:text-ink truncate" style={{ letterSpacing: '-0.03em' }}>
          다가오는 학사일정
        </p>
        <IconButton label="닫기" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 pt-3"
        style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
      >
        {items.length === 0 ? (
          <p className="text-body text-mute dark:text-mute text-center py-8">다가오는 일정이 없어요</p>
        ) : (
          <div className="flex flex-col gap-1 pb-2">
            {items.map((ev, i) => {
              const content = (
                <>
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
                </>
              )
              const key = `${ev.title}-${ev.start_date}-${i}`
              return onSelect ? (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(ev)}
                  className="pressable flex items-start gap-3 text-left rounded-mini px-1 py-1.5 -mx-1"
                >
                  {content}
                </button>
              ) : (
                <div key={key} className="flex items-start gap-3 px-1 py-1.5">
                  {content}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Sheet>
  )
}
