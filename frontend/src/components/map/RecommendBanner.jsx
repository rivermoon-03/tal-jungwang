import { useState } from 'react'
import { X, Footprints, Bus } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useRecommend } from '../../hooks/useRecommend'

function isCommutePeriod() {
  const now = new Date()
  const t = now.getHours() * 60 + now.getMinutes()
  return (t >= 450 && t <= 570) || (t >= 990 && t <= 1140)
}

export default function RecommendBanner() {
  const [modalOpen, setModalOpen] = useState(false)
  const userLocation = useAppStore((s) => s.userLocation)
  const { data } = useRecommend(userLocation?.lat, userLocation?.lng)

  if (!isCommutePeriod() && !data) return null

  const message = data?.message ?? '교통 추천 정보를 불러오는 중...'
  const comparison = data?.comparison

  return (
    <>
      <div className="bg-navy text-white flex items-center justify-between px-5 py-3 text-sm font-semibold">
        <span>{message}</span>
        {comparison && (
          <button
            onClick={() => setModalOpen(true)}
            className="ml-3 text-white/70 hover:text-white whitespace-nowrap"
          >
            자세히 ›
          </button>
        )}
      </div>

      {modalOpen && comparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">교통수단 비교</h3>
              <button onClick={() => setModalOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                <X size={20} />
              </button>
            </div>
            <table className="w-full text-base border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 text-sm text-slate-500 dark:text-slate-400 font-medium">수단</th>
                  <th className="text-right py-2 text-sm text-slate-500 dark:text-slate-400 font-medium">예상 시간</th>
                </tr>
              </thead>
              <tbody>
                {comparison.walking && (
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-3 text-slate-700 dark:text-slate-300 flex items-center gap-1"><Footprints size={15} /> 도보</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-slate-100 time-num">
                      {comparison.walking.total_seconds != null
                        ? `${Math.round(comparison.walking.total_seconds / 60)}분`
                        : '—'}
                    </td>
                  </tr>
                )}
                {comparison.bus?.available && (() => {
                  const waitMin = Math.round((comparison.bus.wait_seconds ?? 0) / 60)
                  const rideMin = Math.round((comparison.bus.ride_seconds ?? 0) / 60)
                  const totalMin = Math.round(comparison.bus.total_seconds / 60)
                  return (
                    <>
                      <tr className="border-b border-slate-50 dark:border-slate-700">
                        <td className="py-3 text-slate-700 dark:text-slate-300"><span className="flex items-center gap-1"><Bus size={15} /> 버스 ({comparison.bus.route_no ?? ''})</span></td>
                        <td className="py-3 text-right font-bold text-slate-900 dark:text-slate-100 time-num">{totalMin}분</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-700">
                        <td colSpan={2} className="pb-3 text-sm text-slate-400 time-num">
                          대기 {waitMin}분 + 이동 {rideMin}분
                        </td>
                      </tr>
                    </>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
