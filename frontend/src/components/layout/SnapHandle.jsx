/**
 * SnapHandle — 지도와 대시보드 사이의 스냅 인디케이터.
 *
 * 높이 24px. 중앙에 52×7px 회색 인디케이터.
 * 상태 전환은 상위 MainShell의 useSnap 포인터 제스처(위/아래 스와이프)만 사용한다.
 * 즉 이 컴포넌트 자체는 클릭/탭이 아닌 드래그 방향에 따라 스냅 모드가 바뀐다.
 */
export default function SnapHandle(props) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="지도·대시보드 구분선 (위/아래로 밀어 펼치거나 접기)"
      className="h-6 w-full flex items-center justify-center shrink-0
                 bg-white dark:bg-bg-dark
                 border-t border-b border-slate-100 dark:border-border-dark
                 select-none"
      style={{ touchAction: 'none', cursor: 'grab' }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="block w-[52px] h-[7px] rounded-full bg-mute/70 dark:bg-border-dark"
      />
    </div>
  )
}
