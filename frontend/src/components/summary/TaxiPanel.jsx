import { useState, useEffect } from 'react'
import { Navigation, LocateFixed } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { apiFetch } from '../../hooks/useApi'
import { splitFare, formatWon } from '../../utils/taxiSplit'
import IconButton from '../ui/IconButton'

const PICKUP_POINT = '정문 앞 로터리'

// D4 — GPS가 없어도 통학 동선은 학교↔정왕역 등으로 정해져 있으므로,
// 고정 출발지 프리셋으로 대부분의 수요를 처리한다. '내 위치'는 선택지 중 하나일 뿐
// 전제 조건이 아니다(예전엔 "GPS 위치를 켜주세요" 한 줄로 막다른 화면이었다).
const ORIGIN_PRESETS = [
  { id: 'school',    name: '학교 정문', lat: 37.340012, lng: 126.733548, pickup: PICKUP_POINT },
  { id: 'jeongwang', name: '정왕역',    lat: 37.351618, lng: 126.742747, pickup: '정왕역 앞 택시승강장' },
]

const TAXI_DESTS = [
  { id: 'jeongwang',       name: '정왕역',       lat: 37.351618,  lng: 126.742747 },
  { id: 'siheung_station', name: '시흥시청역',   lat: 37.37970,   lng: 126.80260 },
  { id: 'sadang',          name: '사당역',        lat: 37.47624,   lng: 126.98175 },
  { id: 'baegot',          name: '배곧(라온초)', lat: 37.37258,   lng: 126.73493 },
]

// 정왕역 출발(막차 놓친 귀가/등교 시나리오)은 학교행이 본체다.
const DESTS_FROM_JEONGWANG = [
  { id: 'school', name: '한국공학대(정문)', lat: 37.340012, lng: 126.733548 },
  { id: 'baegot', name: '배곧(라온초)',     lat: 37.37258,  lng: 126.73493 },
  { id: 'siheung_station', name: '시흥시청역', lat: 37.37970, lng: 126.80260 },
]

function fmtMin(sec) {
  if (sec == null) return '정보 없음'
  const m = Math.round(sec / 60)
  return m === 0 ? '1분 미만' : `약 ${m}분`
}

function fmtKm(meters) {
  if (meters == null) return ''
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

function DestRow({ dest, origin }) {
  const setDriveRouteCoords = useAppStore((s) => s.setDriveRouteCoords)
  const driveRouteCoords    = useAppStore((s) => s.driveRouteCoords)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  // origin 객체는 매 렌더 새 참조일 수 있어 좌표 원시값만 의존성으로 둔다.
  // effect 본문도 같은 원시값을 쓰게 해서 의존성과 실제 사용을 일치시킨다.
  const originLat = origin?.lat
  const originLng = origin?.lng
  const destLat = dest.lat
  const destLng = dest.lng

  // 요청 대상이 바뀌는 순간의 초기화는 렌더 중에, 실제 요청만 effect에서 한다.
  const routeKey = `${originLat},${originLng}|${destLat},${destLng}`
  // 초기값을 null로 두어 첫 마운트에서도 로딩 상태가 켜지게 한다.
  const [seenRouteKey, setSeenRouteKey] = useState(null)
  if (routeKey !== seenRouteKey) {
    setSeenRouteKey(routeKey)
    if (originLat != null && originLng != null) {
      setLoading(true)
      setResult(null)
    }
  }

  useEffect(() => {
    if (originLat == null || originLng == null) return
    apiFetch('/route/driving', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin:      { lat: originLat, lng: originLng },
        destination: { lat: destLat,   lng: destLng   },
      }),
    })
      .then((data) => setResult(data))
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [originLat, originLng, destLat, destLng])

  const isActive = driveRouteCoords === result?.coordinates && result?.coordinates?.length > 0
  const hasRoute = result?.coordinates?.length > 0

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-label font-semibold text-ink tracking-tight">{dest.name}</p>
        {result && (
          <>
            <p className="text-caption font-semibold text-mute mt-0.5">
              {fmtKm(result.distance_meters)}
              {result.taxi_fee > 0 && (
                <span className="ml-2">약 {result.taxi_fee.toLocaleString()}원</span>
              )}
            </p>
            {result.taxi_fee > 0 && (
              <div className="border-t border-dashed border-line dark:border-line pt-1.5 mt-1.5">
                <p className="text-caption font-semibold text-mute tabular-nums">
                  2명이 나누면 {formatWon(splitFare(result.taxi_fee, 2))}
                </p>
                <p className="text-caption font-semibold text-mute tabular-nums">
                  4명이 나누면 {formatWon(splitFare(result.taxi_fee, 4))}
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <span className="text-panel-ttl font-bold tabular-nums text-ink whitespace-nowrap tracking-tight">
        {loading
          ? <span className="text-caption text-mute font-medium">조회 중…</span>
          : fmtMin(result?.duration_seconds)}
      </span>
      {/* 경로 보기 토글 — 정본 IconButton(44px). 활성/비활성은 색으로만 구분. */}
      <IconButton
        label={`${dest.name} 경로 보기`}
        aria-pressed={isActive}
        onClick={() => setDriveRouteCoords(isActive ? null : result?.coordinates)}
        disabled={!hasRoute}
        variant="ghost"
        className={`rounded-pill ${
          isActive
            ? 'bg-ink text-white dark:bg-accent'
            : hasRoute
              ? 'bg-line dark:bg-line text-ink dark:text-ink'
              : 'text-mute dark:text-mute cursor-not-allowed'
        }`}
      >
        <Navigation size={14} />
      </IconButton>
    </div>
  )
}

export default function TaxiPanel() {
  const userLocation = useAppStore((s) => s.userLocation)
  const setUserLocation = useAppStore((s) => s.setUserLocation)

  // 위치가 있으면 내 위치, 없으면 학교 정문을 기본 출발지로.
  const [originId, setOriginId] = useState(userLocation ? 'my' : 'school')
  const [gpsState, setGpsState] = useState('idle') // idle | loading | denied

  const requestGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsState('denied')
      return
    }
    setGpsState('loading')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude })
        setGpsState('idle')
        setOriginId('my')
      },
      () => setGpsState('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  }

  const myOrigin = userLocation
    ? { id: 'my', name: '내 위치', lat: userLocation.lat, lng: userLocation.lng, pickup: null }
    : null
  const origin =
    originId === 'my' && myOrigin
      ? myOrigin
      : ORIGIN_PRESETS.find((o) => o.id === originId) ?? ORIGIN_PRESETS[0]
  const dests = origin.id === 'jeongwang' ? DESTS_FROM_JEONGWANG : TAXI_DESTS

  const chipClass = (active) =>
    `px-2.5 py-1.5 rounded-pill text-caption font-semibold pressable transition-colors border ${
      active
        ? 'bg-accent-bg dark:bg-accent-bg text-accent-ink dark:text-accent-ink border-transparent ring-1 ring-accent dark:ring-accent'
        : 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute border-line dark:border-line'
    }`

  return (
    <div>
      <div role="group" aria-label="출발지 선택" className="flex flex-wrap items-center gap-1.5 pb-1.5">
        {myOrigin ? (
          <button type="button" aria-pressed={origin.id === 'my'} onClick={() => setOriginId('my')} className={chipClass(origin.id === 'my')}>
            내 위치
          </button>
        ) : (
          <button
            type="button"
            onClick={requestGps}
            disabled={gpsState === 'loading'}
            className={`${chipClass(false)} inline-flex items-center gap-1`}
          >
            <LocateFixed size={13} aria-hidden />
            {gpsState === 'loading' ? '위치 확인 중…' : '내 위치 켜기'}
          </button>
        )}
        {ORIGIN_PRESETS.map((o) => (
          <button key={o.id} type="button" aria-pressed={origin.id === o.id} onClick={() => setOriginId(o.id)} className={chipClass(origin.id === o.id)}>
            {o.name} 출발
          </button>
        ))}
      </div>
      {gpsState === 'denied' && (
        <p className="text-caption font-medium text-mute pb-1.5">
          위치 권한이 꺼져 있어요 · 브라우저 설정에서 허용하거나 출발지를 직접 선택해 주세요
        </p>
      )}
      <div className="divide-y divide-line dark:divide-line">
        {dests.map((dest) => (
          // key에 origin.id를 넣어 출발지 전환 시 행 상태(로딩/결과)가 즉시 리셋되게 한다
          <DestRow key={`${origin.id}-${dest.id}`} dest={dest} origin={origin} />
        ))}
        <div className="pt-2.5 text-center">
          <p className="text-caption font-semibold text-mute">
            실제 요금·시간과 다를 수 있습니다
          </p>
          <p className="text-caption font-semibold text-mute mt-1">
            승차 포인트: {origin.pickup ?? '내 위치 주변에서 호출'}
          </p>
        </div>
      </div>
    </div>
  )
}
