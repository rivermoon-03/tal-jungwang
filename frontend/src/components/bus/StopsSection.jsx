/**
 * StopsSection — 노선 상세 페이지 ③ 정류장 섹션(신설, 결함 #21).
 *
 * GET /bus/routes 응답의 stops 배열(등록된 탑승 정류장 — 경유 전체가 아니다)과
 * direction_name(종점/방면)만으로 세로 스파인을 그린다. 중간 경유 정류장이
 * 데이터에 없으면 "경유 정보는 준비 중" 같은 지어낸 문구 없이 그냥 탑승
 * 정류장 → 방면 두 점만 보여준다(정직한 표시).
 *
 * 탑승 정류장이 둘 이상(예: 3401 등교의 석수역/시흥시청역)이면 각각을
 * "여기서 탑승" 칩으로 동등하게 표시한다 — 예전 "도착/출발" 이진 토글처럼
 * 헷갈리는 라벨 대신 사람이 바로 이해할 수 있는 말로 통일한다.
 *
 * activeStopName(선택) — 위 ① ArrivalEtaCard가 실시간 ETA를 계산한 정류장 이름
 * (histData.stop_name). 정류장이 2곳 이상인 노선에서만 그 정류장 옆에 "· 실시간
 * ETA 기준"을 덧붙인다 — 하나뿐인 노선은 굳이 다시 말할 필요가 없다.
 */
export default function StopsSection({ stops, directionName, activeStopName = null }) {
  const hasStops = Array.isArray(stops) && stops.length > 0
  if (!hasStops && !directionName) return null

  return (
    <section aria-label="정류장">
      <h2 className="text-head font-semibold text-ink dark:text-ink tracking-[-0.01em] mb-2.5">
        정류장
      </h2>
      <div className="rounded-card bg-surface dark:bg-surface border border-line dark:border-line px-4 py-3.5">
        {hasStops && stops.map((stop) => {
          // 정류장이 2곳 이상일 때만 "실시간 ETA 기준" 표기 — 하나뿐이면 굳이 반복하지 않는다.
          const isActiveStop = stops.length > 1 && activeStopName && stop.name === activeStopName
          return (
            <div key={stop.id ?? stop.name} className="flex items-start gap-3">
              <div className="flex flex-col items-center self-stretch pt-1.5">
                <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-accent shrink-0" />
                <span aria-hidden="true" className="w-px flex-1 bg-line dark:bg-line mt-1" />
              </div>
              <div className="min-w-0 pb-4 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-body font-bold text-ink dark:text-ink">{stop.name}</span>
                  <span className="inline-flex items-center rounded-full bg-accent-bg text-accent-ink dark:text-accent px-2 py-0.5 text-caption font-bold">
                    여기서 탑승
                  </span>
                  {isActiveStop && (
                    <span className="inline-flex items-center rounded-full bg-chip-green-bg text-chip-green-fg px-2 py-0.5 text-caption font-bold">
                      실시간 ETA 기준
                    </span>
                  )}
                </div>
                {stop.sub_name && (
                  <span className="block text-caption font-semibold text-mute dark:text-mute mt-0.5">
                    {stop.sub_name}
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {directionName && (
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full border-2 border-line dark:border-line shrink-0 mt-1.5 bg-surface dark:bg-surface"
            />
            <div className="min-w-0">
              <span className="text-body font-semibold text-mute dark:text-mute">{directionName}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
