# Theme

## Compact token summary

- Framework: React 19 + Vite + Tailwind CSS 3
- Font: Pretendard 계열 sans-serif
- Primary accent: teal semantic tokens (`--tj-accent`, `--tj-accent-soft`)
- Surfaces: `--tj-bg`, `--tj-surface`, `--tj-surface-2`, `--tj-surface-3`
- Text: `--tj-ink`, `--tj-ink-2`, `--tj-mute`
- Line: `--tj-line`
- Selected pills: `--tj-pill-active-bg`, `--tj-pill-active-fg`
- Typography floor: 12px 미만 금지
- Large teal backgrounds 금지; teal은 실시간/진행/CTA 강조에 제한
- Touch target: 주요 탭 44px 이상
- Radius/spacing/motion은 `frontend/DESIGN.md`와 `frontend/tailwind.config.js` 토큰을 따른다.

## Raw source locations

- `frontend/src/index.css`: `:root`, `.dark`, 공통 semantic CSS variables 전체
- `frontend/tailwind.config.js`: 색상/타이포/라디우스/모션 매핑 전체
- `frontend/DESIGN.md`: 디자인 시스템 규율과 컴포넌트 사용법

