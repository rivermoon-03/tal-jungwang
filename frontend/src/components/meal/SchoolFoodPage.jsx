import { useState } from 'react'
import Segmented from '../kit/Segmented'
import MealPage from './MealPage'
import VenuesView from './VenuesView'
import LibraryView from './LibraryView'

const TABS = [
  { value: 'meal', label: '학식' },
  { value: 'venues', label: '매장' },
  { value: 'library', label: '도서관' },
]

/** 학식 탭. 학식, 매장, 도서관을 같은 세그먼트로 오간다. */
export default function SchoolFoodPage() {
  const [tab, setTab] = useState('meal')
  return (
    <div>
      <div className="mx-auto w-full max-w-[560px] px-4 pt-4">
        <Segmented label="학교 시설" options={TABS} value={tab} onChange={setTab} />
      </div>
      {tab === 'meal' && <MealPage />}
      {tab === 'venues' && <VenuesView />}
      {tab === 'library' && <LibraryView />}
    </div>
  )
}
