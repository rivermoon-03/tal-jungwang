/**
 * StatusChip 의 kind 표.
 *
 * 값이 같아도 뜻이 다른 kind 는 따로 선언한다. 예전엔 'neutral' 이 선언에 없어
 * StatusChip 의 폴백을 타고 'last' 스타일로 그려졌다. 두 스타일이 같아서 화면은
 * 멀쩡했지만, 막차 칩 색을 바꾸는 순간 시간표 칩이 함께 따라갔을 자리다.
 *
 * 컴포넌트 파일이 아니라 여기 두는 이유는 react-refresh 규칙이다. 컴포넌트
 * 파일에서 상수를 함께 export 하면 fast refresh 가 깨진다.
 */
export const STATUS_CHIP_KIND_CLASS = {
  realtime: 'border border-accent text-accent',
  ease:     'border border-ease text-ease',
  crowded:  'border border-imminent text-imminent',
  neutral:  'border border-line text-mute',
  last:     'border border-line text-mute',
  beta:     'border border-line text-mute',
}

export const STATUS_CHIP_KINDS = Object.keys(STATUS_CHIP_KIND_CLASS)
