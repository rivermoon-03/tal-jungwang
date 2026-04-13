import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import InfoPanelTabs from './InfoPanelTabs'

const subwayData = {
  up: { arrive_in_seconds: 180 },
  down: { arrive_in_seconds: 420 },
  line4_up: { arrive_in_seconds: 300 },
  line4_down: { arrive_in_seconds: 660 },
}

const busJeongwangData = {
  station_name: '한국공학대학교',
  arrivals: [
    { route_no: '20-1', arrive_in_seconds: 480, destination: '정왕역', arrival_type: 'realtime' },
    { route_no: '33', arrive_in_seconds: 780, destination: '정왕역', arrival_type: 'realtime' },
  ],
}

describe('InfoPanelTabs', () => {
  it('기본으로 정왕역 탭이 활성화된다', () => {
    render(
      <InfoPanelTabs
        tab="jeongwang"
        setTab={() => {}}
        subwayData={subwayData}
        busJeongwangData={busJeongwangData}
        busSeoulData={null}
        walkSec={720}
      />
    )
    expect(screen.getByText('왕십리 방면')).toBeInTheDocument()
  })

  it('수인분당선 분 단위 시간을 표시한다', () => {
    render(
      <InfoPanelTabs
        tab="jeongwang"
        setTab={() => {}}
        subwayData={subwayData}
        busJeongwangData={busJeongwangData}
        busSeoulData={null}
        walkSec={720}
      />
    )
    expect(screen.getByText('3분')).toBeInTheDocument() // 180초
    expect(screen.getByText('7분')).toBeInTheDocument() // 420초
  })

  it('서울 탭 클릭 시 setTab("seoul")이 호출된다', () => {
    let called = null
    render(
      <InfoPanelTabs
        tab="jeongwang"
        setTab={(t) => { called = t }}
        subwayData={subwayData}
        busJeongwangData={busJeongwangData}
        busSeoulData={null}
        walkSec={720}
      />
    )
    fireEvent.click(screen.getByText('서울'))
    expect(called).toBe('seoul')
  })

  it('버스 노선번호가 표시된다', () => {
    render(
      <InfoPanelTabs
        tab="jeongwang"
        setTab={() => {}}
        subwayData={subwayData}
        busJeongwangData={busJeongwangData}
        busSeoulData={null}
        walkSec={720}
      />
    )
    expect(screen.getByText('20-1')).toBeInTheDocument()
    expect(screen.getByText('33')).toBeInTheDocument()
  })
})
