import DayChips from './DayChips'

/**
 * CafeteriaHero — 학식 탭 상단 히어로(모바일).
 *
 * "오늘 뭐 먹지"라는 질문을 헤드라인으로 올리고 바로 아래 요일 칩 레일을
 * 붙여, 날짜를 넘겨보는 동작과 질문이 한 시야에 들어오게 한다.
 * 요일 칩의 "선택됨"(채움)과 "오늘"(점)은 서로 다른 신호라 헷갈리기 쉬워서
 * 캡션 한 줄로 명시한다 — DayChips 자체 주석에도 같은 근거가 있다.
 *
 * 결함 #16: min-h-[290px]에 justify-center를 얹어 두면 실제 콘텐츠 높이가
 * 290px보다 낮을 때 위아래에 똑같이 빈 여백이 생긴다. 식당 칩과 이 히어로의
 * 제목 사이, 요일 칩 캡션과 그 아래 첫 끼니 카드 사이에 각각 90px 가까운 빈
 * 공간이 생기던 원인이 이 고정 높이였다. 콘텐츠 높이만큼만 차지하게 뺐다.
 *
 * @param {string|null} cafeteriaName — 현재 선택된 식당명(부제)
 * @param {{id:string,label:string,hasMenu:boolean,isToday:boolean}[]} dayChipItems
 * @param {string|null} effectiveDay
 * @param {(id:string)=>void} onSelectDay
 */
export default function CafeteriaHero({ cafeteriaName, dayChipItems, effectiveDay, onSelectDay }) {
  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      <div>
        <h2 className="text-title font-extrabold text-ink tracking-[-0.02em]">
          오늘 뭐 먹지
        </h2>
        {cafeteriaName && (
          <p className="mt-1 text-body text-ink-2">{cafeteriaName}</p>
        )}
      </div>

      {dayChipItems.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="overflow-x-auto">
            <DayChips items={dayChipItems} value={effectiveDay} onChange={onSelectDay} />
          </div>
          <p className="text-caption text-mute">점은 오늘 · 채움은 선택</p>
        </div>
      )}
    </div>
  )
}
