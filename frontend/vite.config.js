/* global process -- vite 설정은 Node 환경에서 실행된다 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
)

// public/sw.js 의 자리표시자에 빌드 산출물 목록과 빌드 id 를 채운다. 앱 셸을 설치 시점에 미리 캐시하려는 것이다.
function swPrecache() {
  let assets = []
  let outDir = 'dist'
  return {
    name: 'tj-sw-precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    generateBundle(_, bundle) {
      assets = Object.keys(bundle).filter((f) => /\.(js|css)$/.test(f)).map((f) => `/${f}`).sort()
    },
    closeBundle() {
      const file = join(outDir, 'sw.js')
      if (!existsSync(file)) return
      const id = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 10)
      const src = readFileSync(file, 'utf-8')
        .replace("'__BUILD_ID__'", JSON.stringify(id))
        .replace("['__PRECACHE_LIST__']", JSON.stringify(assets))
      writeFileSync(file, src)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    swPrecache(),
    // ANALYZE=1 npm run build 로만 켠다 — devDependency라 런타임 번들에는 영향 없음.
    // manualChunks(vendor-react/vendor) 전략이 실제로 잘 나뉘는지 점검용.
    process.env.ANALYZE && visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
  ].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // 앱 정보에 보이는 빌드 날짜(KST, yy.mm.dd)
    __BUILD_DATE__: JSON.stringify(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit' })
        .format(new Date())
        .replaceAll('-', '.'),
    ),
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return 'vendor-react'
            }
            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
  },
})
