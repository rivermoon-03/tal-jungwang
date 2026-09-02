/**
 * MapView — 카카오 SDK 로드 실패 상태 테스트
 *
 * 이전엔 <script>.onerror가 console.error만 찍고 sdkReady를 영원히 false로
 * 남겨 "지도를 불러오는 중..."에서 화면이 영구 정지했다. 실패를 state로 잡아
 * "지도를 불러올 수 없어요 · 다시 시도"를 렌더하는지, 다시 시도가 로딩 상태로
 * 되돌리는지 확인한다.
 *
 * 이 테스트는 실제 MapView를 마운트한다 — 내부 실시간 훅(useShuttleNext 등)은
 * apiFetch 실패를 조용히 삼키므로(useApi.js) 렌더가 깨지지 않는다. SDK 로드
 * 로직은 window.kakao 유무와 <script id="kakao-map-sdk">에 발생하는 load/error
 * 이벤트만으로 검증한다(door: 실제 kakao 지도 SDK는 로드하지 않는다).
 */
import { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapView from './MapView'

vi.stubEnv('VITE_KAKAO_JS_APP_KEY', 'test-kakao-key')

// vi.mock은 파일 어디에 적어도 모듈 최상단으로 호이스팅되어 파일 전체에 적용된다
// (vitest 특성) — 아래 두 describe 블록 안에 흩어 적으면 실제로는 전역이라는
// 사실이 가려지므로, 여기 모아서 명시한다. 결함 #3 테스트(MarkerSheet가
// document.body로 포탈되는지)에서만 쓰지만, 다른 테스트들은 SDK가 준비되지
// 않은 placeholder 상태만 검증해 이 컴포넌트들을 렌더하는 경로에 도달하지
// 않으므로 전역으로 모킹해도 영향이 없다.
function FakeZoomAwareOverlayManager({ onTap }) {
  useEffect(() => {
    onTap({ id: 'test-marker', name: '테스트 정류장', type: 'subway' })
  }, [onTap])
  return null
}
vi.mock('./ZoomAwareOverlayManager', () => ({
  default: (props) => FakeZoomAwareOverlayManager(props),
}))
vi.mock('./UserLocationMarker', () => ({ default: () => null }))
vi.mock('./DriveRoutePolyline', () => ({ default: () => null }))
vi.mock('./WalkRoutePolyline', () => ({ default: () => null }))
vi.mock('./TrafficRoadOverlay', () => ({ default: () => null }))

describe('MapView — SDK 로드 실패', () => {
  beforeEach(() => {
    document.getElementById('kakao-map-sdk')?.remove()
    delete window.kakao
  })

  it('스크립트 로드가 실패하면 "지도를 불러올 수 없어요 · 다시 시도"를 렌더한다', async () => {
    render(<MapView />)
    const script = document.getElementById('kakao-map-sdk')
    expect(script).toBeTruthy()

    fireEvent.error(script)

    expect(await screen.findByText(/지도를 불러올 수 없어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument()
    // 로딩 문구는 더 이상 보이지 않아야 한다 — 영구 정지 상태가 아니라는 뜻.
    expect(screen.queryByText('지도를 불러오는 중...')).not.toBeInTheDocument()
  })

  it('"다시 시도"를 누르면 실패 안내가 사라지고 다시 로딩 상태로 돌아간다', async () => {
    render(<MapView />)
    const script = document.getElementById('kakao-map-sdk')
    fireEvent.error(script)

    const retryBtn = await screen.findByRole('button', { name: /다시 시도/ })
    fireEvent.click(retryBtn)

    expect(screen.queryByText(/지도를 불러올 수 없어요/)).not.toBeInTheDocument()
    expect(await screen.findByText('지도를 불러오는 중...')).toBeInTheDocument()
    // 새 <script> 태그로 교체되어 다시 로드를 시도한다.
    expect(document.getElementById('kakao-map-sdk')).toBeTruthy()
  })

  it('API 키가 없으면 실패 안내 대신 안내 문구를 렌더한다', () => {
    vi.stubEnv('VITE_KAKAO_JS_APP_KEY', '')
    render(<MapView />)
    expect(screen.getByText(/카카오맵/)).toBeInTheDocument()
    vi.stubEnv('VITE_KAKAO_JS_APP_KEY', 'test-kakao-key')
  })
})

/**
 * MapView — 결함 #1: mapExpanded 상태에서 지도를 나갈 방법이 없던 결함.
 *
 * 예전엔 "닫기" 버튼이 SDK 정상 렌더 경로에만 있어서, API 키가 없거나(!kakaoKey)
 * SDK 로드가 실패했거나(sdkError) 아직 로딩 중이면(!sdkReady) mapExpanded=true여도
 * 지도 전체화면을 나갈 수단이 하나도 없었다. 세 상태 모두에서 "지도 닫기"
 * 버튼이 뜨고 onClose를 부르는지 확인한다.
 */
describe('MapView — mapExpanded일 때 SDK 상태와 무관한 닫기 버튼(결함 #1)', () => {
  beforeEach(() => {
    document.getElementById('kakao-map-sdk')?.remove()
    delete window.kakao
    vi.stubEnv('VITE_KAKAO_JS_APP_KEY', 'test-kakao-key')
  })

  it('API 키가 없어도(!kakaoKey) mapExpanded면 닫기 버튼이 뜨고 onClose를 부른다', () => {
    vi.stubEnv('VITE_KAKAO_JS_APP_KEY', '')
    const onClose = vi.fn()
    render(<MapView mapExpanded onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: '지도 닫기' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.stubEnv('VITE_KAKAO_JS_APP_KEY', 'test-kakao-key')
  })

  it('SDK 로드가 실패해도(sdkError) mapExpanded면 닫기 버튼이 뜬다', () => {
    const onClose = vi.fn()
    render(<MapView mapExpanded onClose={onClose} />)
    const script = document.getElementById('kakao-map-sdk')
    fireEvent.error(script)
    const closeBtn = screen.getByRole('button', { name: '지도 닫기' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('SDK가 아직 로딩 중이어도(!sdkReady) mapExpanded면 닫기 버튼이 뜬다', () => {
    const onClose = vi.fn()
    render(<MapView mapExpanded onClose={onClose} />)
    expect(screen.getByText('지도를 불러오는 중...')).toBeInTheDocument()
    const closeBtn = screen.getByRole('button', { name: '지도 닫기' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('mapExpanded가 아니면(축소 상태) SDK 로딩 중에는 닫기 버튼이 없다', () => {
    render(<MapView mapExpanded={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '지도 닫기' })).not.toBeInTheDocument()
  })
})

/**
 * MapView — 결함 #3: 상세 모달이 열려도 하단 독이 백드롭 위에 살아 있던 결함.
 *
 * MarkerSheet(ui/Sheet)가 App > MainShell(mapExpanded 높이를 calc()로 제한하는
 * overflow-hidden 컨테이너) > MapView(relative 컨테이너) 세 겹 아래 그대로
 * 걸려 있었다 — FloatingDock은 App.jsx 바로 아래(사실상 document.body 수준)
 * fixed로 뜬다. document.body로 포탈했는지를, 렌더 컨테이너가 더 이상 그
 * dialog를 포함하지 않는지로 구조적으로 검증한다(jsdom은 실제 페인트 순서를
 * 계산하지 않으므로 elementFromPoint로 직접 스태킹을 검증할 수는 없다).
 */
describe('MapView — MarkerSheet가 document.body로 포탈된다(결함 #3)', () => {
  beforeEach(() => {
    document.getElementById('kakao-map-sdk')?.remove()
    vi.stubEnv('VITE_KAKAO_JS_APP_KEY', 'test-kakao-key')

    class FakeLatLng {
      constructor(lat, lng) { this.lat = lat; this.lng = lng }
      getLat() { return this.lat }
      getLng() { return this.lng }
    }
    class FakeLatLngBounds {
      extend() {}
    }
    class FakeMap {
      setCenter() {}
      setLevel() {}
      setBounds() {}
      relayout() {}
      panTo() {}
      getCenter() { return new FakeLatLng(0, 0) }
      getLevel() { return 4 }
    }
    window.kakao = {
      maps: {
        LatLng: FakeLatLng,
        LatLngBounds: FakeLatLngBounds,
        Map: FakeMap,
        event: { addListener: vi.fn(), removeListener: vi.fn() },
        load: (cb) => cb(),
      },
    }
  })

  // window.kakao는 다음 beforeEach가 매번 새로 대입하므로 여기서 지우지 않는다
  // — afterEach에서 지우면 RTL의 자동 unmount(다음 afterEach)가 언마운트 effect
  // 정리 중 window.kakao.maps.event.removeListener를 호출하다 TypeError를 낸다.
  it('마커를 탭해 연 MarkerSheet 다이얼로그가 렌더 컨테이너 밖(document.body)으로 포탈된다', async () => {
    const { container } = render(<MapView />)
    const dialog = await screen.findByRole('dialog')
    expect(container.contains(dialog)).toBe(false)
    expect(document.body.contains(dialog)).toBe(true)
  })
})
