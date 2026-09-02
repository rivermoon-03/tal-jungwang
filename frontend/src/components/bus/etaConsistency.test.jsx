import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import ArrivalEtaCard from './ArrivalEtaCard'
import BusEtaCard from './BusEtaCard'

/**
 * ArrivalEtaCard · BusEtaCard — 도착 표기 일관성 회귀 테스트.
 *
 * 리팩터 전에는 두 카드가 "초 → 표시 문자열" 변환을 각자 들고 있었고, 특히
 * BusEtaCard는 "곧 도착" 텍스트 전환(60초)과 빨간 강조(180초) 임계가 서로
 * 달라 "2분 후"가 빨갛게 뜨는 버그가 있었다. 이제 둘 다 utils/eta.js에
 * 위임하므로, 같은 초 입력에는 항상 같은 임박 판정을 내야 한다.
 */
afterEach(() => cleanup())

const CASES = [0, 30, 89, 90, 91, 120, 179, 180, 181, 300, 3600]

describe('ArrivalEtaCard · BusEtaCard — 임박 판정 일관성', () => {
  it.each(CASES)('%i초 입력 시 두 카드의 "곧 도착" 여부가 같다', (sec) => {
    const { unmount: unmountArrival } = render(
      <ArrivalEtaCard
        histData={{ realtime_eta: { primary: { arrive_in_seconds: sec, arrive_at_hhmm: null } } }}
        histLoading={false}
        nextScheduled={null}
      />
    )
    const arrivalIsSoon = screen.queryAllByText('곧 도착').length > 0
    unmountArrival()

    const { unmount: unmountBus } = render(
      <BusEtaCard
        realtimeEta={{ primary: { arrive_in_seconds: sec, arrive_at_hhmm: null }, secondary: null }}
        predictedEta={null}
      />
    )
    const busIsSoon = screen.queryAllByText('곧 도착').length > 0
    unmountBus()

    expect(busIsSoon).toBe(arrivalIsSoon)
  })

  it.each(CASES)('%i초 입력 시 두 카드의 빨간 강조(text-imminent) 여부가 같다', (sec) => {
    const { container: arrivalContainer, unmount: unmountArrival } = render(
      <ArrivalEtaCard
        histData={{ realtime_eta: { primary: { arrive_in_seconds: sec, arrive_at_hhmm: null } } }}
        histLoading={false}
        nextScheduled={null}
      />
    )
    const arrivalImminent = arrivalContainer.innerHTML.includes('text-imminent')
    unmountArrival()

    const { container: busContainer, unmount: unmountBus } = render(
      <BusEtaCard
        realtimeEta={{ primary: { arrive_in_seconds: sec, arrive_at_hhmm: null }, secondary: null }}
        predictedEta={null}
      />
    )
    const busImminent = busContainer.innerHTML.includes('text-imminent')
    unmountBus()

    expect(busImminent).toBe(arrivalImminent)
  })
})
