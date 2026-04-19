export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── 브랜드 액센트 ──────────────────────────────────
        accent: '#102c4c',        // 짙은 마린 (라이트)
        'accent-dark': '#7aa7e3', // 다크 모드 보정

        // ── 모드별 식별 색 ────────────────────────────────
        shuttle: '#1b3a6e',       // 셔틀 전용 (구 navy)

        // ── 중립 ──────────────────────────────────────────
        ink:  '#111111',
        mute: '#6b7280',

        // ── 다크 모드 표면 (OLED Pure Black) ─────────────
        'bg-dark':      '#000000',
        'surface-dark': '#141414',
        'border-dark':  '#222222',
        'text-secondary-dark': '#94a3b8',

        // ── 레거시 다크 토큰 (Phase F까지 유지, 이후 치환) ─
        'bg-soft':      '#1c1f26',

        // ── 노선 색 (한국 관례 준수 — 보존) ───────────────
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

        // ── DEPRECATED (Phase F에서 사용처 치환 후 제거) ──
        coral: {
          DEFAULT: '#102c4c',     // 호환: coral 참조를 accent 값으로 폴백
        },
        navy: {
          DEFAULT: '#1b3a6e',
          light:   '#283593',
        },
      },
      fontSize: {
        hero:    ['32px', { lineHeight: '1.1',  fontWeight: '900' }],
        display: ['22px', { lineHeight: '1.15', fontWeight: '900' }],
        title:   ['16px', { lineHeight: '1.3',  fontWeight: '800' }],
        body:    ['14px', { lineHeight: '1.4',  fontWeight: '800' }],
        caption: ['13px', { lineHeight: '1.4',  fontWeight: '500' }],
        micro:   ['11px', { lineHeight: '1.3',  fontWeight: '600' }],
      },
      fontFamily: {
        sans: ['"SUIT Variable"', 'SUIT', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 14px rgba(0,0,0,0.07)',
        pill: '0 4px 14px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        pill: '16px',
        card: '18px',
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        press: '120ms',
        snap:  '240ms',
        page:  '260ms',
        sheet: '280ms',
      },
    },
  },
  plugins: [],
}
