/**
 * PrivacyPage — /privacy 라우트.
 * 마켓(Play Store 등) 등록용 안정 URL. 직접 접근/딥링크로도 열린다.
 */
import PrivacyPolicyPage from '../components/more/PrivacyPolicyPage'

function goBack() {
  // 앱 내 이동에서 들어온 경우 뒤로, 직접 진입(히스토리 없음)이면 더보기로.
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.history.pushState({}, '', '/more')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

export default function PrivacyPage() {
  return <PrivacyPolicyPage onBack={goBack} />
}
