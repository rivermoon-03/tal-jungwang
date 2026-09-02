import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ArrivalEtaCard from './ArrivalEtaCard'

// 3401처럼 승차 정류장이 2곳 이상인 노선은 실시간 ETA가 어느 정류장 기준인지
// 표기가 없으면 승차 지점을 헷갈릴 수 있다(과제 §3). histData.stop_name을
// "실시간" 라벨 옆에 노출하는지 고정한다.
describe('ArrivalEtaCard — 승차 정류장 표기', () => {
  const baseHistData = {
    realtime_eta: {
      primary: { arrive_in_seconds: 300, arrive_at_hhmm: '18:20' },
      secondary: null,
    },
  }

  it('histData.stop_name이 있으면 실시간 ETA 행에 정류장 이름을 노출한다', () => {
    render(
      <ArrivalEtaCard
        histData={{ ...baseHistData, stop_name: '시흥시청역' }}
        histLoading={false}
        nextScheduled={null}
      />
    )
    expect(screen.getByText('· 시흥시청역 기준')).toBeInTheDocument()
  })

  it('stop_name이 없으면 정류장 표기를 지어내지 않는다', () => {
    render(
      <ArrivalEtaCard
        histData={{ ...baseHistData, stop_name: '' }}
        histLoading={false}
        nextScheduled={null}
      />
    )
    expect(screen.queryByText(/기준$/)).not.toBeInTheDocument()
  })
})
