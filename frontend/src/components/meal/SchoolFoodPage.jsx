import { useState } from 'react'
import { navigate } from '../../lib/nav'
import Segmented from '../kit/Segmented'
import MealPage from './MealPage'
import CafeteriaVenues from '../cafeteria/CafeteriaVenues'
import LibrarySection from '../facilities/LibrarySection'

const TABS = [
  { value: 'meal', label: '학식' },
  { value: 'venues', label: '매장' },
  { value: 'library', label: '도서관' },
]

/** 학식 탭. 매장과 도서관은 기존 화면을 그대로 붙인다. */
export default function SchoolFoodPage() {
  const [tab, setTab] = useState('meal')
  return (
    <div>
      <div className="mx-auto w-full max-w-[560px] px-4 pt-4">
        <Segmented label="학교 시설" options={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === 'meal' && <MealPage />}
      {tab === 'venues' && (
        <div className="mx-auto w-full max-w-[560px] px-4 pt-4">
          <CafeteriaVenues onVenueClick={(id) => navigate(`/cafeteria/${encodeURIComponent(id)}`)} />
        </div>
      )}
      {tab === 'library' && (
        <div className="mx-auto w-full max-w-[560px] px-4 pt-4">
          <LibrarySection />
        </div>
      )}
    </div>
  )
}
