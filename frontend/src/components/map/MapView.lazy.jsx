import { lazyWithReload } from '../../utils/lazyWithReload'

// 카카오 SDK 연동을 포함한 MapView 본체를 별도 청크로 내린다.
//
// MainShell(모바일)은 지도를 실제로 펼치는 시점에, PCMainShell(PC)은 마운트
// 즉시 이 컴포넌트를 통해서만 MapView를 불러와야 한다 — 두 호출부 중 하나라도
// '../map/MapView'를 정적으로 import하면 rollup이 이 청크를 index 청크에
// 합쳐버려(INEFFECTIVE_DYNAMIC_IMPORT) 분리 자체가 무효화된다.
export const LazyMapView = lazyWithReload(() => import('./MapView'))
