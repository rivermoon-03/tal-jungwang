/**
 * NowBadge — 지금 운영 중인 끼니에 붙는 배지.
 *
 * PC 레이아웃에만 있던 것을 올려서 모바일과 같은 것을 쓰게 한다. 예전에는
 * CafeteriaPCLayout 만 isMealTypeOpenNow 로 현재 끼니를 판정해 배지와 액센트
 * 보더를 붙였고, FacilitiesPage(모바일)는 같은 meals 배열을 그대로 돌면서
 * 그 검사를 아예 하지 않았다 — 주력 화면인 폰에서 조식·중식·석식 중 무엇이
 * 지금 나오는지 알 수 없었다.
 */
export default function NowBadge() {
  return (
    <span className="ml-auto px-2 py-0.5 rounded-pill text-caption font-semibold bg-chip-green-bg text-chip-green-fg">
      지금
    </span>
  )
}
