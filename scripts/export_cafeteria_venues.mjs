/**
 * 교내 매장 운영정보(프런트 단일 출처) → 백엔드용 JSON 파생.
 *
 * frontend/src/data/cafeteriaVenues.js 가 원본이다. 위젯(안드로이드)은 서버가
 * 계산해 준 "지금 영업 중" 목록만 받으므로 백엔드도 같은 데이터가 필요한데,
 * 손으로 복제하면 반드시 갈라진다. 그래서 복제 대신 이 스크립트로 파생한다.
 *
 *   node scripts/export_cafeteria_venues.mjs
 *   → backend/app/data/cafeteria_venues.json (생성물, 커밋 대상)
 *
 * 원본을 고쳤으면 이 스크립트를 다시 돌려야 위젯에 반영된다.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const { ALL_VENUES } = await import(
  resolve(here, '../frontend/src/data/cafeteriaVenues.js')
)

// 위젯이 쓰는 필드만 남긴다(메뉴·설명 등은 앱 화면 전용).
const venues = ALL_VENUES.map((v) => ({
  id: v.id,
  name: v.name,
  building: v.building ?? null,
  floor: v.floor ?? null,
  category: v.category ?? null,
  is24h: Boolean(v.is24h || v.alwaysOpen),
  closedDays: v.closedDays ?? [],
  schedule: v.schedule ?? null,
}))

const out = resolve(here, '../backend/app/data/cafeteria_venues.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(
  out,
  JSON.stringify(
    { _generated_by: 'scripts/export_cafeteria_venues.mjs', count: venues.length, venues },
    null,
    2
  ) + '\n',
  'utf8'
)
console.log(`wrote ${venues.length} venues → ${out}`)
