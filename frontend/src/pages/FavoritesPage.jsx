/**
 * FavoritesPage — /favorites 페이지
 * CTA "시간표에서 추가" → /schedule 로 이동
 */
import FavoritesPageContent from '../components/favorites/FavoritesPage'

function navigate(href) {
  window.history.pushState({}, '', href)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function FavoritesPage() {
  return (
    <FavoritesPageContent
      onGoSchedule={() => navigate('/schedule')}
    />
  )
}
