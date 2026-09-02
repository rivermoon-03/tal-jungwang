/**
 * fontScale.js — 인라인 style 의 글자 크기를 설정(F4) 슬라이더에 연결한다.
 *
 * tailwind.config.js 의 fontSize 토큰은 전부 calc(Npx * var(--tj-font-scale,1))
 * 이라 text-* 클래스를 쓰는 텍스트는 슬라이더를 따라 커진다. 그런데 일부
 * 컴포넌트가 인라인 style 의 fontSize 에 숫자를 직접 박아 두어, 그 텍스트만
 * 커지지 않고 남아 있었다. 화면 일부만 커지면 오히려 읽기 더 어렵다.
 *
 * 인라인 style 을 클래스로 전부 걷어내는 건 색·굵기·행간까지 같이 옮겨야 해서
 * 회귀 위험이 크다. 대신 크기 값만 같은 calc 식으로 감싸 스케일에 연결한다.
 *
 * @param {number} px  기준 픽셀 크기(스케일 1일 때의 값)
 * @returns {string}   CSS font-size 값
 */
export function scaledPx(px) {
  return `calc(${px}px * var(--tj-font-scale, 1))`
}
