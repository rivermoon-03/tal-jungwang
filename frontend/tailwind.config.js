export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════
        // BMW iDrive / Tesla OS 톤 (2026-05 redesign)
        // ═══════════════════════════════════════════════════

        // ── 라이트 모드 surface · 텍스트 ───────────────────
        'bg':           '#eef1f5',   // page bg (Tesla 오프화이트)
        'surface':      '#ffffff',   // 카드
        'surface-alt':  '#f7f8fa',   // 패널 내부 보조
        'line':         '#f1f3f5',   // 헤어라인 (행 구분)
        'text':         '#475569',   // 본문 (destination 등)

        // ── 다크 모드 surface · 텍스트 (iDrive OLED) ──────
        'bg-dark':           '#000000',  // OLED 순흑
        'surface-dark':      '#0a0a0a',  // 카드 (구 #141414)
        'surface-dark-alt':  '#050505',  // 보조 surface
        'line-dark':         '#1a1a1a',  // 헤어라인 (구 border-dark)
        'border-dark':       '#1a1a1a',  // 후방 호환 alias
        'ink-dark':          '#ffffff',  // primary text (다크)
        'text-dark':         '#d1d5db',
        'mute-dark':         '#6b7280',
        'mute-2-dark':       '#4b5563',
        'text-secondary-dark': '#94a3b8', // 후방 호환

        // ── 중립 ──────────────────────────────────────────
        ink:    '#0b0d10',           // primary (구 #111111)
        mute:   '#94a3b8',           // 보조 라벨 (구 #6b7280, 더 밝음)
        'mute-2': '#cbd2db',         // disabled / placeholder

        // ── 브랜드 액센트 (iDrive Blue) ───────────────────
        accent:         '#4f9fff',   // iDrive Blue (구 #102c4c)
        'accent-dark':  '#4f9fff',   // 다크 동일 (구 #7aa7e3)
        'accent-ink':   '#102c4c',   // 짙은 마린 (구 accent 값) — 짙은 강조 필요시

        // ── 모드별 식별 색 ────────────────────────────────
        shuttle: '#1b3a6e',          // 셔틀 전용 (구 navy)

        // ── 상태 토큰 (Muted iDrive) ──────────────────────
        'state-ok':       '#4a9d6a', // sage (구 #16a34a)
        'state-warn':     '#d4a14a', // ochre (구 #f59e0b)
        'state-bad':      '#c8553d', // coral (구 #dc2626)
        'imminent':       '#e26a4d', // "곧" 빨강 (라이트)
        'imminent-dark':  '#f87171', // "곧" 빨강 (다크)

        // ── Dock 전용 ─────────────────────────────────────
        'dock-bg':         '#0a0a0a',
        'dock-active-bg':  '#1a1a1a',
        'dock-text':       '#d1d5db',
        'dock-text-mute':  '#6b7280',

        // ── 노선 색 (지도 마커용 진한 단색 — 그대로 유지) ──
        'line-201':    '#2563eb',
        'line-33':     '#0891b2',
        'line-1':      '#f97316',
        'line-express':'#dc2626',
        'line-4':      '#1B5FAD',
        'line-suin':   '#F5A623',
        'line-seohae': '#75bf43',

        // ── 노선 칩 색 (Soft Tinted — 카드 내부용 신규) ──
        'chip-green-bg':   '#eef5f0', 'chip-green-fg':   '#3a7a52',
        'chip-blue-bg':    '#e6efff', 'chip-blue-fg':    '#2e5fb3',
        'chip-red-bg':     '#f5e6e2', 'chip-red-fg':     '#8a3a2c',
        'chip-purple-bg':  '#f0e8fc', 'chip-purple-fg':  '#5b3aa8',
        'chip-yellow-bg':  '#fef6e6', 'chip-yellow-fg':  '#a07517',
        // 다크 페어
        'chip-green-bg-dark':  '#1a2820', 'chip-green-fg-dark':  '#5fb085',
        'chip-blue-bg-dark':   '#1a2030', 'chip-blue-fg-dark':   '#7aa5e3',
        'chip-red-bg-dark':    '#2a1818', 'chip-red-fg-dark':    '#e07a6a',
        'chip-purple-bg-dark': '#1f1828', 'chip-purple-fg-dark': '#a78ce0',
        'chip-yellow-bg-dark': '#2a2410', 'chip-yellow-fg-dark': '#d4a14a',

        // ── 레거시 (호환을 위해 유지) ─────────────────────
        'bg-soft':      '#1c1f26',
        'line-soft':    '#eef1f5',
        'bg-soft-light':'#f6f7f9',
        line4: {
          DEFAULT: '#1B5FAD',
          light:   '#E8F0FB',
        },
        suinbundang: {
          DEFAULT: '#F5A623',
          light:   '#FEF6E6',
        },
        'route-201': '#2563EB',
        'route-33':  '#0891B2',
        'route-1':   '#F97316',

        // ── DEPRECATED (사용처 치환 후 제거 예정) ─────────
        coral: {
          DEFAULT: '#102c4c',
        },
        navy: {
          DEFAULT: '#1b3a6e',
          light:   '#283593',
        },
      },
      fontSize: {
        // ═══════════════════════════════════════════════════
        // 새 타이포 시스템 (BMW iDrive / Tesla OS 톤)
        // ═══════════════════════════════════════════════════

        // 큰 숫자 (시간 ETA · 카운트다운)
        'countdown':  ['32px', { lineHeight: '1.0',  fontWeight: '900', letterSpacing: '-0.05em' }],
        'eta-pc':     ['22px', { lineHeight: '1.0',  fontWeight: '900', letterSpacing: '-0.03em' }],
        'eta-mob':    ['26px', { lineHeight: '1.0',  fontWeight: '900', letterSpacing: '-0.03em' }],

        // 페이지 / 패널 헤더
        'page-ttl':   ['26px', { lineHeight: '1.1',  fontWeight: '900', letterSpacing: '-0.03em' }],
        'panel-ttl':  ['16px', { lineHeight: '1.1',  fontWeight: '900', letterSpacing: '-0.03em' }],

        // 본문
        'dest':       ['12px', { lineHeight: '1.3',  fontWeight: '600' }],
        'dest-mob':   ['11px', { lineHeight: '1.3',  fontWeight: '600' }],

        // 라벨 / 캡션
        'ghdr':       ['9px',  { lineHeight: '1.3',  fontWeight: '700', letterSpacing: '0.1em' }],
        'sub':        ['10px', { lineHeight: '1.3',  fontWeight: '700', letterSpacing: '0.04em' }],
        'meta':       ['11px', { lineHeight: '1.3',  fontWeight: '600' }],

        // 칩 (노선 번호)
        'chip':       ['11px', { lineHeight: '1',    fontWeight: '800' }],
        'chip-pc':    ['10px', { lineHeight: '1',    fontWeight: '800' }],

        // ── 레거시 (호환 유지, 점진적 제거) ──
        hero:    ['26px', { lineHeight: '1.1',  fontWeight: '900' }],
        bigMin:  ['30px', { lineHeight: '1.05', fontWeight: '900' }],
        display: ['18px', { lineHeight: '1.2',  fontWeight: '900' }],
        title:   ['14px', { lineHeight: '1.3',  fontWeight: '800' }],
        body:    ['13px', { lineHeight: '1.4',  fontWeight: '700' }],
        caption: ['11px', { lineHeight: '1.4',  fontWeight: '500' }],
        micro:   ['10px', { lineHeight: '1.3',  fontWeight: '600' }],
      },
      fontFamily: {
        sans: ['"SUIT Variable"', 'SUIT', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        card:      '0 2px 8px rgba(0,0,0,0.04)',     // 신규 가벼운 카드 (구 0 4px 14px ...0.06)
        'card-md': '0 2px 10px rgba(0,0,0,0.06)',
        pill:      '0 4px 14px rgba(0,0,0,0.10)',
        dock:      '0 6px 24px rgba(0,0,0,0.25)',    // 모바일 floating dock
        map:       '0 2px 10px rgba(0,0,0,0.08)',    // 지도 위 floating 컨트롤
      },
      borderRadius: {
        pill:       '999px',
        card:       '14px',   // 신규 표준 (구 18px)
        'card-lg':  '18px',   // 구 card 값 (호환 alias)
        'card-pc':  '12px',   // PC 패널
        chip:       '5px',
        mini:       '10px',   // 위젯 카드
        'dock-mob': '22px',   // 모바일 floating dock
        btn:        '10px',
      },
      transitionTimingFunction: {
        ios:  'cubic-bezier(0.16, 1, 0.3, 1)',
        snap: 'cubic-bezier(0.65, 0, 0.35, 1)',    // 슬롯머신·패널 collapse용
      },
      transitionDuration: {
        press: '120ms',
        snap:  '240ms',
        page:  '260ms',
        sheet: '280ms',
        slot:  '400ms',     // 슬롯머신 숫자 전환
        panel: '320ms',     // 좌측 패널 collapse
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
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%':   { transform: 'translateX(-100%)', opacity: '0.4' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'halo-pulse':      'haloPulse 1.6s ease-out infinite',
        'halo-pulse-dark': 'haloPulseDark 1.6s ease-out infinite',
        'user-pulse':      'userPulse 2.5s ease-out infinite',
        'dot-blink':       'dotBlink 1.5s ease-in-out infinite',
        'fade-in':         'fadeIn 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left':   'slideInLeft 280ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
