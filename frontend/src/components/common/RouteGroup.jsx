import Card from '../ui/Card'

// 그룹 묶음 컨테이너. 헤더(uppercase ghdr) + 행들.
// 라이트: 흰 카드 + 그림자. 다크: #0a0a0a + 1px 헤어라인 — ui/Card의 default
// 상태가 이미 이 규칙(그림자/보더 상호배타)을 구현하므로 그대로 위임한다.
// 행마다 자체 padding을 가지므로 카드 레벨 패딩은 없음(padding="none").

export default function RouteGroup({ heading, children, className = '' }) {
  return (
    <Card as="section" padding="none" className={`overflow-hidden ${className}`}>
      {heading && (
        <header className="px-3 pt-[7px] pb-[3px] text-dest font-bold uppercase text-mute dark:text-mute">
          {heading}
        </header>
      )}
      <div className="flex flex-col">
        {children}
      </div>
    </Card>
  )
}
