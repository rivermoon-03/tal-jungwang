// 차트 로딩 중 자리표시. 24개 막대가 일정한 펄스로 반짝인다.
// 라이트/다크 양쪽에서 동일한 실루엣을 유지하도록 white alpha로만 채운다.
const BAR_HEIGHTS = [
  28, 34, 40, 46, 58, 66, 72, 84, 92, 98, 104, 112,
  108, 104, 98, 90, 82, 72, 64, 56, 48, 42, 36, 30,
]

export default function ChartSkeleton({ stroke = '#ffffff' }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 160 }}>
      <div className="absolute inset-0 flex items-end gap-[3px] px-3 pb-5">
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm tj-skel-bar"
            style={{
              height: `${h}%`,
              background: stroke,
              opacity: 0.12,
              animationDelay: `${(i % 8) * 80}ms`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes tjSkelPulse {
          0%, 100% { opacity: 0.08; }
          50%      { opacity: 0.22; }
        }
        .tj-skel-bar {
          animation: tjSkelPulse 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .tj-skel-bar { animation: none !important; opacity: 0.14 !important; }
        }
      `}</style>
    </div>
  )
}
