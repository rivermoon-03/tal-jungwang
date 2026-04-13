export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1a237e',
          light:   '#283593',
        },
        accent: '#e53935',
        line4: {
          DEFAULT: '#1B5FAD',
          light:   '#E8F0FB',
        },
        suinbundang: {
          DEFAULT: '#F5A623',
          light:   '#FEF6E6',
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
