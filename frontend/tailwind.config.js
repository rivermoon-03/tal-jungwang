export default {
  content: ['./index.html', './src/**/*.{js,jsx}', './test/**/*.{js,jsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════
        // 디자인 시스템 v1 semantic 토큰 (DESIGN.md §2, CSS 변수 단일 출처)
        // ═══════════════════════════════════════════════════
        'bg':           'var(--tj-bg)',
        'surface':      'var(--tj-surface)',
        'surface-2':    'var(--tj-surface-2)',
        'surface-3':    'var(--tj-surface-3)',
        'line':         'var(--tj-line)',
        'line-strong':  'var(--tj-line-strong)',
        'ink':          'var(--tj-ink)',
        'ink-2':        'var(--tj-ink-2)',
        'mute':         'var(--tj-mute)',
        'accent':       'var(--tj-accent)',
        'accent-hover': 'var(--tj-accent-hover)',
        'accent-ink':   'var(--tj-accent-ink)',
        'accent-bg':    'var(--tj-accent-bg)',
        'imminent':     'var(--tj-imminent)',
        'imminent-bg':  'var(--tj-imminent-bg)',
        'ease':         'var(--tj-ease)',
        'delayed':      'var(--tj-delayed)',
        'delayed-bg':   'var(--tj-delayed-bg)',
        'realtime':     'var(--tj-realtime)',

        // ═══════════════════════════════════════════════════
        // 레거시 별칭 — 값은 위 semantic CSS 변수로 통일(다크 2체계 제거).
        // 이름 자체의 소거(컴포넌트 전수 치환)는 Phase B 몫.
        // ═══════════════════════════════════════════════════

        // ── 라이트 모드 surface · 텍스트 ───────────────────
        'surface-alt':  'var(--tj-surface-2)',   // 패널 내부 보조
        'text':         'var(--tj-ink-2)',       // 본문 (destination 등)

        // ── 다크 모드 surface · 텍스트 (구 iDrive OLED — sage 다크 사다리로 통일) ──
        'bg-dark':           'var(--tj-bg)',
        'surface-dark':      'var(--tj-surface)',
        'surface-dark-alt':  'var(--tj-bg)',      // surface보다 한 단 어두운 보조
        'line-dark':         'var(--tj-line)',
        'border-dark':       'var(--tj-line)',    // 후방 호환 alias
        'ink-dark':          'var(--tj-ink)',
        'text-dark':         'var(--tj-ink-2)',
        'mute-dark':         'var(--tj-mute)',
        'mute-2-dark':       '#444947',           // sage7 dark
        'text-secondary-dark': 'var(--tj-ink-2)', // 후방 호환

        // ── 중립 (레거시 — 신규 컴포넌트는 ink/mute var() 키 사용) ─
        'mute-2': '#cbcfcd',         // sage7 — disabled / placeholder

        // ── 브랜드 액센트 (레거시) ────────────────────────
        'accent-dark':  'var(--tj-accent)',   // teal9는 라이트/다크 동일이라 accent와 일치

        // ── 모드별 식별 색 ────────────────────────────────
        shuttle: 'var(--tj-accent)',          // 셔틀 전용 (구 navy #1b3a6e)

        // ── 상태 토큰 ──────────────────────────────────────
        'state-ok':       'var(--tj-ease)',
        'state-warn':     'var(--tj-imminent)',
        'state-bad':      'var(--tj-delayed)',
        'imminent-dark':  'var(--tj-imminent)', // "곧" 배지 (다크) 레거시 — imminent와 통일

        // ── Dock 전용 ─────────────────────────────────────
        'dock-bg':         'var(--tj-dock-bg)',
        'dock-active-bg':  '#272a29',   // sage4 dark
        'dock-text':       '#eceeed',   // sage12 dark
        'dock-text-mute':  '#717d79',   // sage10 dark

        // ── 노선 색 (지도 마커용 진한 단색 — 그대로 유지) ──
        'line-201':    '#2563eb',
        'line-33':     '#0891b2',
        'line-1':      '#f97316',
        'line-express':'#dc2626',
        'line-4':      '#1B5FAD',
        'line-suin':   '#F5A623',
        'line-seohae': '#75bf43',

        // ── 노선 컬러 halo (출발지 도트 ring · alpha 16/28%) ──
        'route-halo-express':       'rgba(220,38,38,.16)',
        'route-halo-trunk':         'rgba(37,99,235,.16)',
        'route-halo-local':         'rgba(8,145,178,.18)',
        'route-halo-express-dark':  'rgba(220,38,38,.32)',
        'route-halo-trunk-dark':    'rgba(37,99,235,.32)',
        'route-halo-local-dark':    'rgba(8,145,178,.36)',

        // ── 카테고리 칩 팔레트 (Soft Tinted — DESIGN.md "카테고리 칩 팔레트", CSS 변수 단일 출처) ──
        'chip-green-bg':   'var(--tj-chip-green-bg)',  'chip-green-fg':   'var(--tj-chip-green-fg)',
        'chip-blue-bg':    'var(--tj-chip-blue-bg)',   'chip-blue-fg':    'var(--tj-chip-blue-fg)',
        'chip-red-bg':     'var(--tj-chip-red-bg)',    'chip-red-fg':     'var(--tj-chip-red-fg)',
        'chip-purple-bg':  'var(--tj-chip-purple-bg)', 'chip-purple-fg':  'var(--tj-chip-purple-fg)',
        'chip-yellow-bg':  'var(--tj-chip-yellow-bg)', 'chip-yellow-fg':  'var(--tj-chip-yellow-fg)',
        'chip-gray-bg':    'var(--tj-chip-gray-bg)',   'chip-gray-fg':    'var(--tj-chip-gray-fg)',
        // 레거시 별칭(-dark 접미) — 값은 위와 동일 var()라 라이트/다크 전환은 CSS에서 이미 처리됨.
        // 이름 자체(전수 치환)는 Phase B 몫 — 컴포넌트에서는 -dark 접미 없이 위 키를 그대로 쓴다.
        'chip-green-bg-dark':  'var(--tj-chip-green-bg)',  'chip-green-fg-dark':  'var(--tj-chip-green-fg)',
        'chip-blue-bg-dark':   'var(--tj-chip-blue-bg)',   'chip-blue-fg-dark':   'var(--tj-chip-blue-fg)',
        'chip-red-bg-dark':    'var(--tj-chip-red-bg)',    'chip-red-fg-dark':    'var(--tj-chip-red-fg)',
        'chip-purple-bg-dark': 'var(--tj-chip-purple-bg)', 'chip-purple-fg-dark': 'var(--tj-chip-purple-fg)',
        'chip-yellow-bg-dark': 'var(--tj-chip-yellow-bg)', 'chip-yellow-fg-dark': 'var(--tj-chip-yellow-fg)',

        // ── 레거시 (호환을 위해 유지, 값은 신규 팔레트로 정리) ──
        // bg-soft / line-soft / bg-soft-light / route-201 / route-33 / route-1 / suinbundang
        // 는 실사용처 0건(grep 확인) 이라 제거함(2026-07 Phase A).
        'line4-light': '#E8F0FB',   // bg-line4-light만 실사용(DEFAULT 미사용이라 제거)

        // ── 도메인 색 — shuttle 토큰과 동일 값으로 통일(구 #1b3a6e 네이비 폐기) ──
        navy: {
          DEFAULT: 'var(--tj-accent)',
        },
      },
      fontSize: {
        // ═══════════════════════════════════════════════════
        // 새 타이포 시스템 (BMW iDrive / Tesla OS 톤)
        // ═══════════════════════════════════════════════════
        // 모든 크기가 calc(Npx * var(--tj-font-scale,1))인 이유(F4 글자 크기 설정):
        // 이 스케일이 앱 텍스트의 절대다수(text-caption/body/label/head 등 200곳 이상)를
        // 차지해, 설정 화면의 글자 크기 슬라이더가 --tj-font-scale(html)만 바꾸면
        // 전수 반영된다. 단, 컴포넌트 인라인 style={{fontSize:N}}이나 text-[Npx] 임의값은
        // 이 스케일 밖이라 적용되지 않는다(알려진 범위 — SettingsPage.jsx TODO(F4) 참고).
        // lineHeight도 절대 px 값(예: '23px')인 항목은 같은 비율로 스케일해야 줄간격이
        // 글자 크기와 어긋나지 않는다 — 단위 없는 비율(예: '1.1')은 그대로 둔다.

        // 큰 숫자 (시간 ETA · 카운트다운)
        'countdown':  ['calc(32px * var(--tj-font-scale,1))', { lineHeight: '1.0',  fontWeight: '900', letterSpacing: '-0.05em' }],
        'eta-pc':     ['calc(22px * var(--tj-font-scale,1))', { lineHeight: '1.0',  fontWeight: '900', letterSpacing: '-0.03em' }],
        'eta-mob':    ['calc(26px * var(--tj-font-scale,1))', { lineHeight: '1.0',  fontWeight: '900', letterSpacing: '-0.03em' }],

        // 페이지 / 패널 헤더
        'page-ttl':   ['calc(26px * var(--tj-font-scale,1))', { lineHeight: '1.1',  fontWeight: '900', letterSpacing: '-0.03em' }],
        'panel-ttl':  ['calc(16px * var(--tj-font-scale,1))', { lineHeight: '1.1',  fontWeight: '900', letterSpacing: '-0.03em' }],

        // 본문
        'dest':       ['calc(12px * var(--tj-font-scale,1))', { lineHeight: '1.3',  fontWeight: '600' }],
        'dest-mob':   ['calc(11px * var(--tj-font-scale,1))', { lineHeight: '1.3',  fontWeight: '600' }],

        // 라벨 / 캡션
        'ghdr':       ['calc(10px * var(--tj-font-scale,1))', { lineHeight: '1.3',  fontWeight: '700', letterSpacing: '0.1em' }],
        'sub':        ['calc(10px * var(--tj-font-scale,1))', { lineHeight: '1.3',  fontWeight: '700', letterSpacing: '0.04em' }],
        'meta':       ['calc(11px * var(--tj-font-scale,1))', { lineHeight: '1.3',  fontWeight: '600' }],

        // 칩 (노선 번호)
        'chip':       ['calc(11px * var(--tj-font-scale,1))', { lineHeight: '1',    fontWeight: '800' }],
        'chip-pc':    ['calc(10px * var(--tj-font-scale,1))', { lineHeight: '1',    fontWeight: '800' }],

        // ── Warm Daylight 타이포 스케일(2026-06) — text-caption/body/label/head 사용처가
        //    각각 98/43/67/11곳이라 값(특히 weight) 전수 교체는 화면별 회귀 위험 큼.
        //    Phase A에서는 굵기(weight)는 유지, 신규 DESIGN.md §3 크기/행간만 반영.
        //    폰트 굵기 강등은 IMPLEMENTATION-PLAN Phase B 항목.
        'hero-temp': ['calc(60px * var(--tj-font-scale,1))', { lineHeight: '1', fontWeight: '800', letterSpacing: '-0.045em' }],
        'eta-xl': ['calc(38px * var(--tj-font-scale,1))', { lineHeight: '1',    fontWeight: '800' }],
        'eta':    ['calc(28px * var(--tj-font-scale,1))', { lineHeight: '1',    fontWeight: '800' }],
        'title':  ['calc(21px * var(--tj-font-scale,1))', { lineHeight: '1.15', fontWeight: '800' }],
        'head':   ['calc(17px * var(--tj-font-scale,1))', { lineHeight: 'calc(23px * var(--tj-font-scale,1))', fontWeight: '700' }],
        'body':   ['calc(16px * var(--tj-font-scale,1))', { lineHeight: 'calc(23px * var(--tj-font-scale,1))', fontWeight: '600' }],
        'label':  ['calc(15px * var(--tj-font-scale,1))', { lineHeight: 'calc(21px * var(--tj-font-scale,1))', fontWeight: '600' }],
        'caption':['calc(13px * var(--tj-font-scale,1))', { lineHeight: 'calc(17px * var(--tj-font-scale,1))', fontWeight: '600' }],

        // ── DESIGN.md §3 신규 스케일(무충돌 키) — Phase B/D에서 화면 적용 ──
        'body-sm': ['calc(14px * var(--tj-font-scale,1))', { lineHeight: 'calc(19px * var(--tj-font-scale,1))', fontWeight: '400' }],
        'head-sm': ['calc(17px * var(--tj-font-scale,1))', { lineHeight: 'calc(23px * var(--tj-font-scale,1))', fontWeight: '600' }],
        'num-lg':  ['calc(29px * var(--tj-font-scale,1))', { lineHeight: 'calc(33px * var(--tj-font-scale,1))', fontWeight: '600', letterSpacing: '-0.02em' }],
        'num-xl':  ['calc(37px * var(--tj-font-scale,1))', { lineHeight: 'calc(41px * var(--tj-font-scale,1))', fontWeight: '700', letterSpacing: '-0.02em' }],

        // ── 레거시 (호환 유지, 점진적 제거) ──
        hero:    ['calc(26px * var(--tj-font-scale,1))', { lineHeight: '1.1',  fontWeight: '900' }],
        bigMin:  ['calc(30px * var(--tj-font-scale,1))', { lineHeight: '1.05', fontWeight: '900' }],
        display: ['calc(18px * var(--tj-font-scale,1))', { lineHeight: '1.2',  fontWeight: '900' }],
        micro:   ['calc(10px * var(--tj-font-scale,1))', { lineHeight: '1.3',  fontWeight: '600' }],
      },
      fontFamily: {
        sans: ['"SUIT Variable"', 'SUIT', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        // DESIGN.md §4 — 최대 2단계, 다크는 그림자 대신 --line 보더로 구분(shadow-sh-card는 :root에서만 유효)
        'sh-card': '0 1px 3px rgba(0,0,0,.06)',
        'sh-pop':  '0 8px 24px rgba(0,0,0,.12)',

        // ── 레거시(호환 유지) ──
        card:      '0 2px 8px rgba(0,0,0,0.04)',
        'card-md': '0 2px 10px rgba(0,0,0,0.06)',
        pill:      '0 4px 14px rgba(0,0,0,0.10)',
        dock:      '0 6px 24px rgba(0,0,0,0.25)',    // 모바일 floating dock
        map:       '0 2px 10px rgba(0,0,0,0.08)',    // 지도 위 floating 컨트롤
      },
      borderRadius: {
        // DESIGN.md §4 — 5개 값으로 고정(의미있는 키 이름)
        badge:  '8px',    // 노선번호 뱃지
        button: '10px',   // 버튼
        input:  '10px',   // 인풋
        card:   '14px',
        sheet:  '20px',   // 바텀시트/모달
        pill:   '999px',

        // ── 레거시(호환 유지) — 5토큰 중 가장 가까운 값으로 정리 ──
        'card-lg':  '20px',  // 구 18px → sheet(20)에 가장 가까움
        'card-pc':  '14px',  // 구 12px → card(14)
        chip:       '8px',   // 구 5px → badge(8)
        mini:       '10px',  // 구 10px(그대로) → button/input(10)
        btn:        '10px',  // 구 10px(그대로) → button/input(10)
        // dock-mob(22px)은 실사용처 0건(grep 확인)이라 제거함(2026-07 Phase A).
      },
      transitionTimingFunction: {
        ios:  'cubic-bezier(0.16, 1, 0.3, 1)',
        snap: 'cubic-bezier(0.65, 0, 0.35, 1)',    // 슬롯머신·패널 collapse용
        // DESIGN.md §4 모션 이징
        out:   'cubic-bezier(0.32, 0.72, 0, 1)',   // 결정적 ease-out(진입/시트)
        spring:'cubic-bezier(0.5, 1.35, 0.5, 1)',  // 미세 오버슈트(press·pop·knob)
        inout: 'cubic-bezier(0.65, 0, 0.35, 1)',   // 크로스페이드
      },
      transitionDuration: {
        press: '120ms',
        snap:  '240ms',
        page:  '260ms',
        sheet: '280ms',
        slot:  '400ms',     // 슬롯머신 숫자 전환
        panel: '320ms',     // 좌측 패널 collapse
        // DESIGN.md §4 모션 duration
        base:  '200ms',     // 토글/세그/색
        enter: '300ms',     // 카드/리스트 진입
        motionSheet: '440ms', // 바텀시트(구 sheet=280ms와 별도 — vaul 등 Phase C 적용)
      },
      keyframes: {
        haloPulse: {
          '0%':   { boxShadow: '0 0 0 0 rgba(226, 106, 77, 0.45)' },
          '100%': { boxShadow: '0 0 0 18px rgba(226, 106, 77, 0)' },
        },
        haloPulseDark: {
          '0%':   { boxShadow: '0 0 0 0 rgba(248, 113, 113, 0.5)' },
          '100%': { boxShadow: '0 0 0 18px rgba(248, 113, 113, 0)' },
        },
        userPulse: {
          '0%':   { boxShadow: '0 0 0 0 rgba(79, 159, 255, 0.5)' },
          '100%': { boxShadow: '0 0 0 18px rgba(79, 159, 255, 0)' },
        },
        dotBlink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        // fadeIn keyframe은 index.css에 단일 출처로 정의됨(.animate-fade-in).
        // 여기서 중복 정의하면 이름 충돌로 두 정의 중 하나가 조용히 무시되므로
        // Phase B에서 제거함(2026-07).
        slideInLeft: {
          '0%':   { transform: 'translateX(-100%)', opacity: '0.4' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        panelSwap: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'halo-pulse':      'haloPulse 1.6s ease-out infinite',
        'halo-pulse-dark': 'haloPulseDark 1.6s ease-out infinite',
        'user-pulse':      'userPulse 2.5s ease-out infinite',
        'dot-blink':       'dotBlink 1.5s ease-in-out infinite',
        'slide-in-left':   'slideInLeft 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'panel-swap':      'panelSwap 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
