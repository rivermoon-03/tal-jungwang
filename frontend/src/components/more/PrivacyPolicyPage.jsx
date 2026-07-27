/**
 * PrivacyPolicyPage — 개인정보처리방침 sub-page.
 *
 * Play Store / 앱 마켓 등록 시 요구되는 개인정보처리방침의 앱 내 정적 페이지.
 * 안정적인 URL(/privacy)로 직접 접근 가능해야 하며, 마켓 콘솔의
 * "개인정보처리방침 URL"에 https://<도메인>/privacy 를 등록한다.
 *
 * 서비스는 회원가입이 없고 자체 서버에 개인정보를 저장하지 않는다. 실제로 개인정보를
 * 다루는 주체는 지도·광고·호스팅에 쓰는 외부 사업자들이므로, 항목을 장황하게 서술하는
 * 대신 각 사업자의 방침으로 바로 갈 수 있는 링크를 제공한다.
 *
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft, ExternalLink } from 'lucide-react'

const EFFECTIVE_DATE = '2026-07-27'
const OPERATOR = 'moonlandingplan (탈것:정왕 운영자)'

// 서비스가 실제로 사용하는 외부 사업자와 각자의 방침 원문 링크.
// 사업자를 추가·교체할 때는 이 배열만 갱신한다.
const THIRD_PARTIES = [
  {
    name: 'Google',
    role: '광고 게재(AdSense/AdMob), 트래픽 분석',
    href: 'https://policies.google.com/privacy',
  },
  {
    name: '카카오',
    role: '지도 표시 및 길찾기(Kakao Maps)',
    href: 'https://www.kakao.com/policy/privacy',
  },
  {
    name: 'Vercel',
    role: '프런트엔드 호스팅, 접속 로그',
    href: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'Railway',
    role: '백엔드 서버 호스팅, 접속 로그',
    href: 'https://railway.com/legal/privacy',
  },
]

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

      {/* 산문 본문은 tj-prose-w로 한 줄 길이를 제한한다. PC에서 폭을 그대로 두면
          한 줄이 100자를 넘어 눈이 줄을 놓친다. */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-28 md:pb-6">
        <div className="tj-prose-w flex flex-col gap-3">
          <p className="text-meta text-mute dark:text-mute px-1">
            탈것:정왕(이하 “서비스”)은 회원가입 없이 이용되며, 이용자를 식별할 수 있는
            개인정보를 자체적으로 수집하거나 서버에 저장하지 않습니다. 시행일 {EFFECTIVE_DATE}.
          </p>

          <Section title="1. 서비스가 수집하지 않는 것">
            <p>서비스는 아래 정보를 수집하지 않습니다.</p>
            <p>· 이름, 전화번호, 이메일, 학번 등 이용자를 식별할 수 있는 정보</p>
            <p>· 계정 정보 (회원가입과 로그인 기능 자체가 없습니다)</p>
            <p>· 이용자가 지정한 즐겨찾기, 테마, 알림 설정 등의 서버 사본</p>
          </Section>

          <Section title="2. 기기 안에만 머무는 정보">
            <p>
              <b>· 위치정보(선택):</b> 가까운 정류장과 도착 정보를 보여주기 위해 이용자가
              권한을 허용한 경우에만 기기의 위치를 사용합니다. 위치는 화면을 그리는 순간에만
              쓰이고 서비스 서버로 전송하거나 저장하지 않습니다. 권한은 기기 설정에서 언제든
              철회할 수 있습니다.
            </p>
            <p>
              <b>· 설정값(즐겨찾기, 테마, 글자 크기, 알림 등):</b> 이용자 기기의 로컬
              저장소(localStorage)에만 저장됩니다. 앱 데이터나 브라우저 저장소를 삭제하면
              함께 사라지며, 서비스는 이 값을 읽을 수 없습니다.
            </p>
          </Section>

          <Section title="3. 외부 서비스와 각 사업자의 방침">
            <p>
              서비스는 지도 표시, 광고 게재, 서버 호스팅을 위해 아래 사업자를 이용합니다.
              이 과정에서 접속 로그, 기기·브라우저 정보, 광고 식별자 등이 각 사업자에 의해
              자동으로 생성되거나 수집될 수 있으며, 해당 정보의 처리에는 각 사업자의
              개인정보처리방침이 적용됩니다.
            </p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {THIRD_PARTIES.map((p) => (
                <li key={p.name}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noreferrer"
                    className="hoverable flex items-center justify-between gap-3 rounded-mini border border-line px-3 py-2 dark:border-line"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink dark:text-ink">{p.name}</span>
                      <span className="block text-mute dark:text-mute">{p.role}</span>
                    </span>
                    <span className="flex flex-none items-center gap-1 text-accent dark:text-accent">
                      방침 보기
                      <ExternalLink size={13} aria-hidden="true" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-mute dark:text-mute">
              앱(설치형) 환경에서는 웹 광고를 게재하지 않으며, 인앱 광고가 필요한 경우
              정책에 맞는 광고 SDK를 사용합니다.
            </p>
          </Section>

          <Section title="4. 이용자의 권리">
            <p>· 기기 설정에서 위치 권한을 언제든지 철회할 수 있습니다.</p>
            <p>· 앱 데이터 또는 브라우저 저장소를 삭제하면 기기에 저장된 설정이 모두 지워집니다.</p>
            <p>· 광고 개인 맞춤 설정은 기기와 계정의 광고 설정에서 변경할 수 있습니다.</p>
          </Section>

          <Section title="5. 아동의 개인정보">
            <p>서비스는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.</p>
          </Section>

          <Section title="6. 문의처">
            <p>운영: {OPERATOR}</p>
            <p>
              문의:{' '}
              <a
                className="text-accent dark:text-accent underline"
                href="https://github.com/rivermoon-03/tal-jungwang/issues"
                target="_blank"
                rel="noreferrer"
              >
                GitHub 이슈
              </a>
            </p>
          </Section>

          <p className="text-label text-mute dark:text-mute px-1 pt-1">
            본 방침은 법령이나 서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지를 통해
            고지합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
