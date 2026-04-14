export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: '#FF385C',
        },
        navy: {
          DEFAULT: '#1b3a6e',
          light:   '#283593',
        },
        accent: '#e53935',
        // Dark mode surface tokens
        'bg-soft': '#1c1f26',
        'surface-dark': '#272a33',
        'border-dark': '#3a3e48',
        'text-secondary-dark': '#94a3b8',
        // Route line colors
        line4: {
          DEFAULT: '#1B5FAD',
          light:   '#E8F0FB',
        },
        suinbundang: {
          DEFAULT: '#F5A623',
          light:   '#FEF6E6',
        },
        // Bus route colors
        'route-201': '#2563EB',    // 20-1 파랑
        'route-33':  '#0891B2',    // 시흥33 청록
        'route-1':   '#F97316',    // 시흥1 주황
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
    },
  },
  plugins: [],
}
