/**
 * PrivacyPolicyPage — 개인정보처리방침 sub-page.
 *
 * Play Store / 앱 마켓 등록 시 요구되는 개인정보처리방침의 앱 내 정적 페이지.
 * 안정적인 URL(/privacy)로 직접 접근 가능해야 하며, 마켓 콘솔의
 * "개인정보처리방침 URL"에 https://<도메인>/privacy 를 등록한다.
 *
 * ⚠️ 운영자가 확정해야 하는 항목은 [대괄호] 플레이스홀더로 표시했다.
 *    (운영자/연락처 이메일/시행일 등) — 마켓 제출 전 반드시 채울 것.
 *
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft } from 'lucide-react'

const EFFECTIVE_DATE = '[시행일: YYYY-MM-DD]'
const CONTACT_EMAIL = '[운영자 연락처 이메일]'
const OPERATOR = 'moonlandingplan (탈것:정왕 운영자)'

function Section({ title, children }) {
  return (
    <section className="bg-surface dark:bg-surface rounded-card shadow-card px-5 py-4">
      <h2 className="text-body font-semibold text-ink dark:text-ink mb-2">{title}</h2>
      <div className="text-meta leading-relaxed text-ink-2 dark:text-mute flex flex-col gap-1.5">
        {children}
      </div>
    </section>
  )
}

export default function PrivacyPolicyPage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-line dark:hover:bg-line transition-colors"
        >
          <ChevronLeft size={22} className="text-ink dark:text-ink" />
        </button>
        <h1 className="text-panel-ttl text-ink dark:text-ink">개인정보처리방침</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-28 md:pb-6 flex flex-col gap-3">
        <p className="text-meta text-mute dark:text-mute px-1">
          탈것:정왕(이하 “서비스”)은 이용자의 개인정보를 중요하게 생각하며, 아래와 같이
          개인정보를 처리합니다. {EFFECTIVE_DATE}
        </p>

        <Section title="1. 수집·이용하는 정보">
          <p>서비스는 회원가입 없이 이용되며, 이름·전화번호 등 식별 가능한 개인정보를
            수집하지 않습니다. 다만 아래 정보가 처리될 수 있습니다.</p>
          <p><b>· 위치정보(선택):</b> 가까운 정류장·도착정보 표시를 위해 이용자가 권한을
            허용한 경우에만 기기의 위치를 사용합니다. 위치정보는 화면 표시 목적에 한해
            이용되며 서비스 서버에 저장하지 않습니다.</p>
          <p><b>· 단말 저장 설정(즐겨찾기·테마·알림 설정 등):</b> 이용자 기기의 로컬
            저장소(localStorage)에만 저장되며 서버로 전송되지 않습니다.</p>
          <p><b>· 자동 수집 정보:</b> 서비스 이용 과정에서 접속 로그, 기기·브라우저 정보,
            광고 식별자 등이 자동 생성·수집될 수 있습니다(아래 “4. 위탁/광고” 참고).</p>
        </Section>

        <Section title="2. 이용 목적">
          <p>· 버스·지하철·셔틀·학식·날씨 등 교통/생활 정보 제공</p>
          <p>· 위치 기반 주변 정류장 안내 및 서비스 품질 개선</p>
          <p>· 광고 게재(해당하는 경우) 및 부정 이용 방지</p>
        </Section>

        <Section title="3. 보관 및 파기">
          <p>· 단말에 저장된 설정 정보는 이용자가 앱 데이터를 삭제하면 함께 삭제됩니다.</p>
          <p>· 서비스가 별도로 보관하는 개인정보는 없으며, 자동 수집 로그는 관련 법령이
            정한 기간 또는 처리 목적 달성 시까지 보관 후 파기합니다.</p>
        </Section>

        <Section title="4. 처리 위탁 및 광고">
          <p>서비스는 아래 외부 서비스를 이용하며, 각 사업자의 개인정보처리방침이
            적용됩니다.</p>
          <p>· <b>Google</b>(광고 게재 시 AdSense/AdMob, 지도/경로 등) —
            <a className="text-accent dark:text-accent underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">정책 보기</a></p>
          <p>· <b>카카오</b>(지도/경로 일부 기능)</p>
          <p>· 호스팅/인프라 사업자(Vercel, Railway)</p>
          <p className="text-mute dark:text-mute">앱(설치형) 환경에서는 웹 광고를
            게재하지 않으며, 인앱 광고가 필요한 경우 정책에 맞는 광고 SDK를 사용합니다.</p>
        </Section>

        <Section title="5. 이용자의 권리">
          <p>· 기기 설정에서 위치 권한을 언제든지 철회할 수 있습니다.</p>
          <p>· 광고 개인 맞춤 설정은 기기/계정의 광고 설정에서 변경할 수 있습니다.</p>
        </Section>

        <Section title="6. 아동의 개인정보">
          <p>서비스는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.</p>
        </Section>

        <Section title="7. 문의처">
          <p>개인정보 관련 문의: {CONTACT_EMAIL}</p>
          <p>운영: {OPERATOR}</p>
        </Section>

        <p className="text-label text-mute dark:text-mute px-1 pt-1">
          본 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지를 통해
          고지합니다.
        </p>
      </div>
    </div>
  )
}
