/**
 * skyPalette.test.js — 하늘 사다리와 잉크 대비 검증.
 *
 * 핵심은 마지막 describe다: 무드 × 고도 × 테마 전 조합을 훑어 본문/보조 잉크가
 * 세 스톱 어디에 얹혀도 WCAG AA(4.5:1)를 넘는지 확인한다. 다크모드 히어로에서
 * 흰 글자가 흰 알약 위에 얹혔던(1.01:1) 사고, 회색 라벨이 남색 하늘에 묻혔던
 * (2.22:1) 사고가 이 스윕을 통과하지 못한다.
 */
import { describe, it, expect } from 'vitest'
import {
  getSkyPalette,
  SKY_MOODS,
  SCRIM_BASE_ALPHA,
  contrastRatio,
  relativeLuminance,
  hexToOklab,
  oklabToHex,
  overlay,
  hexToRgb,
  rgbToHex,
} from './skyPalette'

describe('색 변환 왕복', () => {
  it('hex → OKLab → hex 가 원래 색으로 돌아온다', () => {
    for (const hex of ['#000000', '#ffffff', '#12a594', '#8cc4f2', '#0d1526', '#f3c89e']) {
      expect(oklabToHex(hexToOklab(hex))).toBe(hex)
    }
  })

  it('hex ↔ rgb 왕복이 일치한다', () => {
    expect(rgbToHex(hexToRgb('#0bd8b6'))).toBe('#0bd8b6')
  })

  it('OKLab의 L은 사람이 느끼는 밝기 순서를 지킨다', () => {
    const dark = hexToOklab('#101211').L
    const mid = hexToOklab('#717d79').L
    const light = hexToOklab('#eceeed').L
    expect(dark).toBeLessThan(mid)
    expect(mid).toBeLessThan(light)
  })
})

describe('대비 계산', () => {
  it('흰색과 검정의 대비는 21:1이다', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1)
  })

  it('같은 색끼리는 1:1이다', () => {
    expect(contrastRatio('#12a594', '#12a594')).toBeCloseTo(1, 5)
  })

  it('배포본에서 문제였던 조합을 실제로 실패로 잡아낸다', () => {
    // 흰 알약(bg-white/95) 위의 흰 잉크(text-ink) — 실측 1.01:1
    expect(contrastRatio('#eceeed', '#f3f4f5')).toBeLessThan(1.1)
    // 남색 하늘 위의 mute 라벨 — 실측 2.22:1
    expect(contrastRatio('#717d79', '#3a4756')).toBeLessThan(2.5)
  })

  it('상대 휘도는 0~1 범위다', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('overlay — 알파 합성', () => {
  it('alpha 0이면 원본 그대로다', () => {
    expect(overlay('#8cc4f2', '#000000', 0)).toBe('#8cc4f2')
  })

  it('alpha 1이면 얹은 색이 된다', () => {
    expect(overlay('#8cc4f2', '#000000', 1)).toBe('#000000')
  })

  it('검정 베일을 씌우면 휘도가 내려간다', () => {
    const before = relativeLuminance('#8cc4f2')
    const after = relativeLuminance(overlay('#8cc4f2', '#000000', 0.4))
    expect(after).toBeLessThan(before)
  })
})

describe('getSkyPalette — 사다리 형태', () => {
  it('스톱 3개를 hex로 돌려준다', () => {
    const sky = getSkyPalette({ mood: 'sunny', altitudeDeg: 40, dark: false })
    expect(sky.stops).toHaveLength(3)
    for (const s of sky.stops) expect(s).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('고도가 높아질수록 하늘이 밝아진다(맑음·라이트)', () => {
    const lums = [-30, -8, 0, 10, 45].map(
      (alt) => relativeLuminance(getSkyPalette({ mood: 'sunny', altitudeDeg: alt }).stops[1]),
    )
    for (let i = 1; i < lums.length; i++) {
      expect(lums[i]).toBeGreaterThan(lums[i - 1])
    }
  })

  it('다크 테마는 같은 조건의 라이트보다 항상 어둡다', () => {
    for (const mood of SKY_MOODS) {
      for (const alt of [-30, -4, 6, 45]) {
        const light = relativeLuminance(getSkyPalette({ mood, altitudeDeg: alt }).stops[1])
        const dark = relativeLuminance(getSkyPalette({ mood, altitudeDeg: alt, dark: true }).stops[1])
        expect(dark, `${mood} alt=${alt}`).toBeLessThan(light)
      }
    }
  })

  it('앵커 밖의 극단 고도에서도 값이 안정적이다(클램프)', () => {
    const low = getSkyPalette({ mood: 'sunny', altitudeDeg: -90 })
    const high = getSkyPalette({ mood: 'sunny', altitudeDeg: 90 })
    expect(low.stops).toEqual(getSkyPalette({ mood: 'sunny', altitudeDeg: -12 }).stops)
    expect(high.stops).toEqual(getSkyPalette({ mood: 'sunny', altitudeDeg: 30 }).stops)
  })

  it('고도를 조금 움직이면 색도 조금만 움직인다(연속성)', () => {
    const a = getSkyPalette({ mood: 'sunny', altitudeDeg: 0 }).stops[1]
    const b = getSkyPalette({ mood: 'sunny', altitudeDeg: 0.5 }).stops[1]
    const delta = Math.abs(relativeLuminance(a) - relativeLuminance(b))
    expect(delta).toBeLessThan(0.03)
  })

  it('모르는 무드는 맑음으로 떨어진다', () => {
    expect(getSkyPalette({ mood: 'sandstorm', altitudeDeg: 30 }).stops)
      .toEqual(getSkyPalette({ mood: 'sunny', altitudeDeg: 30 }).stops)
  })

  it('다크 하늘에는 밝은 잉크가, 밝은 하늘에는 어두운 잉크가 온다', () => {
    const darkSky = getSkyPalette({ mood: 'sunny', altitudeDeg: 40, dark: true })
    const lightSky = getSkyPalette({ mood: 'sunny', altitudeDeg: 40, dark: false })
    expect(darkSky.onDarkSky).toBe(true)
    expect(lightSky.onDarkSky).toBe(false)
  })

  it('다크 테마에서는 어떤 무드·고도든 밝은 잉크를 쓴다', () => {
    for (const mood of SKY_MOODS) {
      for (let alt = -40; alt <= 70; alt += 5) {
        expect(getSkyPalette({ mood, altitudeDeg: alt, dark: true }).onDarkSky, `${mood} alt=${alt}`).toBe(true)
      }
    }
  })
})

// ── 이 파일의 존재 이유 ────────────────────────────────────────────────
describe('대비 스윕 — 무드 × 고도 × 테마 전 조합이 AA를 넘는다', () => {
  const ALTITUDES = []
  for (let alt = -40; alt <= 75; alt += 2.5) ALTITUDES.push(alt)

  it(`본문 잉크가 모든 조합에서 4.5:1 이상이다 (${SKY_MOODS.length} × ${ALTITUDES.length} × 2 조합)`, () => {
    const failures = []
    for (const dark of [false, true]) {
      for (const mood of SKY_MOODS) {
        for (const altitudeDeg of ALTITUDES) {
          const sky = getSkyPalette({ mood, altitudeDeg, dark })
          if (sky.contrast < 4.5) {
            failures.push(
              `${dark ? 'dark' : 'light'} ${mood} alt=${altitudeDeg} ` +
                `on=${sky.on} stops=${sky.stops.join(',')} contrast=${sky.contrast.toFixed(2)}`,
            )
          }
        }
      }
    }
    expect(failures, `본문 잉크 AA 미달:\n${failures.join('\n')}`).toEqual([])
  })

  it('보조 잉크도 모든 조합에서 4.5:1 이상이다', () => {
    const failures = []
    for (const dark of [false, true]) {
      for (const mood of SKY_MOODS) {
        for (const altitudeDeg of ALTITUDES) {
          const sky = getSkyPalette({ mood, altitudeDeg, dark })
          if (sky.contrast2 < 4.5) {
            failures.push(
              `${dark ? 'dark' : 'light'} ${mood} alt=${altitudeDeg} ` +
                `on2=${sky.on2} contrast2=${sky.contrast2.toFixed(2)}`,
            )
          }
        }
      }
    }
    expect(failures, `보조 잉크 AA 미달:\n${failures.join('\n')}`).toEqual([])
  })

  it('스크림 두께는 상한(0.42)을 넘지 않는다', () => {
    const overs = []
    for (const dark of [false, true]) {
      for (const mood of SKY_MOODS) {
        for (const altitudeDeg of ALTITUDES) {
          const { scrimAlpha } = getSkyPalette({ mood, altitudeDeg, dark })
          if (scrimAlpha > 0.42) overs.push(`${mood} alt=${altitudeDeg} a=${scrimAlpha}`)
        }
      }
    }
    expect(overs).toEqual([])
  })

  it('다크 테마에서는 베일이 항상 최소 두께다(하늘이 이미 충분히 어둡다)', () => {
    for (const mood of SKY_MOODS) {
      for (const altitudeDeg of ALTITUDES) {
        expect(
          getSkyPalette({ mood, altitudeDeg, dark: true }).scrimAlpha,
          `${mood} alt=${altitudeDeg}`,
        ).toBe(SCRIM_BASE_ALPHA)
      }
    }
  })

  it('두꺼운 베일이 필요한 구간은 낮은 해 근처에 한정된다', () => {
    // 베일이 최소 두께를 넘는 조합이 전체의 일부여야 한다. 절반을 넘어가면
    // 사다리 자체가 중간 밝기에 너무 오래 머문다는 뜻이라 앵커를 손봐야 한다.
    let thick = 0
    let total = 0
    for (const mood of SKY_MOODS) {
      for (const altitudeDeg of ALTITUDES) {
        total++
        if (getSkyPalette({ mood, altitudeDeg }).scrimAlpha > SCRIM_BASE_ALPHA) thick++
      }
    }
    expect(thick / total).toBeLessThan(0.35)
  })
})
