// arrive_in_seconds / arrive_seconds / next_arrive_in_seconds 같은
// "남은 초" 필드를 fetchedAt 이후 경과한 만큼 깎아 리턴한다.
// 백엔드가 응답 시점에는 값을 이미 보정해서 내려주지만, 프론트가
// 다음 refetch까지 수~수십 초를 그대로 들고 있기 때문에 그 gap을
// 클라이언트 tick으로 메운다.

function decrement(sec, elapsedSec) {
  if (sec == null) return sec
  return Math.max(0, sec - elapsedSec)
}

function elapsedSince(fetchedAt, now) {
  if (!fetchedAt) return 0
  return Math.max(0, (now - fetchedAt) / 1000)
}

// 버스 도착정보 응답 (BusArrivalsResponse): { arrivals: [...], ... }
// realtime 타입만 깎는다. 시간표 기반(depart_at)은 그대로.
export function tickBusArrivals(data, fetchedAt, now) {
  if (!data?.arrivals || !fetchedAt) return data
  const elapsed = elapsedSince(fetchedAt, now)
  if (elapsed <= 0) return data
  return {
    ...data,
    arrivals: data.arrivals.map((a) =>
      a.arrival_type === 'realtime' && a.arrive_in_seconds != null
        ? { ...a, arrive_in_seconds: decrement(a.arrive_in_seconds, elapsed) }
        : a
    ),
  }
}

// 지하철 다음 열차 응답 (/subway/next):
// { up, down, siheung_up, siheung_dn, ... } 각 객체에
// arrive_in_seconds / next_arrive_in_seconds 필드를 갖는다.
export function tickSubwayNext(data, fetchedAt, now) {
  if (!data || !fetchedAt) return data
  const elapsed = elapsedSince(fetchedAt, now)
  if (elapsed <= 0) return data

  const adjustTrain = (train) => {
    if (!train) return train
    const out = { ...train }
    if (train.arrive_in_seconds != null) {
      out.arrive_in_seconds = decrement(train.arrive_in_seconds, elapsed)
    }
    if (train.next_arrive_in_seconds != null) {
      out.next_arrive_in_seconds = decrement(train.next_arrive_in_seconds, elapsed)
    }
    return out
  }

  const out = { ...data }
  for (const key of Object.keys(data)) {
    const v = data[key]
    if (v && typeof v === 'object' && !Array.isArray(v) && (
      'arrive_in_seconds' in v || 'next_arrive_in_seconds' in v
    )) {
      out[key] = adjustTrain(v)
    }
  }
  return out
}

// 지하철 실시간 응답 (/subway/realtime): { [역명]: [{arrive_seconds, ...}, ...] }
export function tickSubwayRealtime(data, fetchedAt, now) {
  if (!data || !fetchedAt) return data
  const elapsed = elapsedSince(fetchedAt, now)
  if (elapsed <= 0) return data

  const out = {}
  for (const [station, arr] of Object.entries(data)) {
    if (Array.isArray(arr)) {
      out[station] = arr.map((t) =>
        t?.arrive_seconds != null
          ? { ...t, arrive_seconds: decrement(t.arrive_seconds, elapsed) }
          : t
      )
    } else {
      out[station] = arr
    }
  }
  return out
}

// 셔틀 다음 응답 (/shuttle/next): { arrive_in_seconds, next_arrive_in_seconds, ... }
export function tickShuttleNext(data, fetchedAt, now) {
  if (!data || !fetchedAt) return data
  const elapsed = elapsedSince(fetchedAt, now)
  if (elapsed <= 0) return data
  const out = { ...data }
  if (data.arrive_in_seconds != null) {
    out.arrive_in_seconds = decrement(data.arrive_in_seconds, elapsed)
  }
  if (data.next_arrive_in_seconds != null) {
    out.next_arrive_in_seconds = decrement(data.next_arrive_in_seconds, elapsed)
  }
  return out
}
