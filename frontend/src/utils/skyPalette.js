/**
 * skyPalette.js — 히어로 하늘 색과 그 위에 얹을 잉크를 한 곳에서 정한다.
 *
 * 왜 이 파일이 생겼나
 * ────────────────────
 * 전에는 배경 그라데이션이 CSS에 8종(무드 4 × 시간 3, 다크는 또 별개)으로
 * 손으로 찍혀 있었고, 글자 색은 JSX의 `lightText` 불리언이 날씨와 시간만 보고
 * 따로 정했다. 두 판단이 서로를 모르니 다크모드에서 어긋났다(다크 맑음·낮은
 * 배경이 남색인데 lightText가 false라 회색 글자가 얹혔다 · 대비 2.2:1).
 *
 * 그래서 배경과 잉크를 **한 함수의 반환값**으로 묶었다. 하늘을 새로 추가해도
 * 잉크가 자동으로 따라오고, skyPalette.test.js가 모든 조합의 대비를 실제로
 * 계산해 AA(4.5:1) 미만이면 빌드를 막는다. 같은 종류의 버그가 구조적으로
 * 다시 생기지 못한다.
 *
 * 색 다루는 방식
 * ──────────────
 * 보간과 명도 조절은 전부 OKLab에서 한다. sRGB에서 두 색을 섞으면 중간이
 * 탁한 회색으로 주저앉는데(저녁 하늘의 남색에서 주홍으로 넘어가는 구간이
 * 특히 심하다), OKLab은 사람이 느끼는 밝기 축이 분리돼 있어 그 진흙길이
 * 생기지 않는다. 색상환 회전(LCH의 H) 대신 a·b를 직접 보간하므로 색상
 * 되감김(hue wraparound) 문제도 없다.
 *
 * 다크모드는 별도 팔레트가 아니다. 같은 사다리의 OKLab 명도(L)에 상한을
 * 씌우고 채도를 눌러 만든 값이라, 라이트에서 하늘을 손보면 다크가 자동으로
 * 따라온다.
 */

// ── sRGB ↔ OKLab ─────────────────────────────────────────────────────────
// Björn Ottosson의 OKLab 표준 계수.

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** '#rrggbb' → [r, g, b] (0~255) */
export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** [r, g, b] (0~255) → '#rrggbb' */
export function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** '#rrggbb' → { L, a, b } (OKLab) */
export function hexToOklab(hex) {
  const [r0, g0, b0] = hexToRgb(hex).map((v) => srgbToLinear(v / 255))
  const l = Math.cbrt(0.4122214708 * r0 + 0.5363325363 * g0 + 0.0514459929 * b0)
  const m = Math.cbrt(0.2119034982 * r0 + 0.6806995451 * g0 + 0.1073969566 * b0)
  const s = Math.cbrt(0.0883024619 * r0 + 0.2817188376 * g0 + 0.6299787005 * b0)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/** { L, a, b } (OKLab) → 선형 RGB 3채널(색역 밖이면 0~1을 벗어난 값이 나온다) */
function oklabToLinearRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** { L, a, b } (OKLab) → '#rrggbb' */
export function oklabToHex(lab) {
  const rgb = oklabToLinearRgb(lab).map((c) => linearToSrgb(Math.max(0, Math.min(1, c))) * 255)
  return rgbToHex(rgb)
}

/** 해당 OKLab 색이 sRGB 안에 있는가. */
function inGamut(lab) {
  return oklabToLinearRgb(lab).every((c) => c >= -0.0005 && c <= 1.0005)
}

/**
 * 색역 매핑 — 명도(L)와 색상(a:b 비율)은 지키고 채도만 줄여 sRGB 안으로 넣는다.
 *
 * 채널을 그냥 0~1로 자르면(clamp) 색상이 틀어진다. 예를 들어 한낮의 하늘색을
 * 밤 밝기까지 눌러 놓고 자르면 R 채널이 0에 붙으면서 원래보다 시퍼런 색이
 * 나온다. 이분 탐색으로 "그 밝기에서 가능한 최대 채도"를 찾으면, 어두운
 * 하늘이 색을 잃지도 않고 엉뚱한 색으로 튀지도 않는다.
 */
function toGamut(lab) {
  if (inGamut(lab)) return lab
  let lo = 0
  let hi = 1
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    if (inGamut({ L: lab.L, a: lab.a * mid, b: lab.b * mid })) lo = mid
    else hi = mid
  }
  return { L: lab.L, a: lab.a * lo, b: lab.b * lo }
}

// ── 대비 ─────────────────────────────────────────────────────────────────

/** WCAG 상대 휘도 (0~1) */
export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 대비비 (1~21) */
export function contrastRatio(fgHex, bgHex) {
  const [hi, lo] = [relativeLuminance(fgHex), relativeLuminance(bgHex)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** sRGB 공간에서 두 색을 알파 합성한다(위에 얹는 색 over, 불투명도 alpha). */
export function overlay(baseHex, overHex, alpha) {
  const base = hexToRgb(baseHex)
  const over = hexToRgb(overHex)
  return rgbToHex(base.map((v, i) => v + (over[i] - v) * alpha))
}

// ── 하늘 사다리 ──────────────────────────────────────────────────────────
// 라이트 테마 기준 앵커만 손으로 잡는다. 다크는 아래 dimForDark()가 만든다.
// 각 앵커는 168deg 그라데이션의 [위, 중간, 아래] 세 스톱이다.
// 앵커 사이 고도는 OKLab에서 선형 보간된다.

// 앵커를 실제 대기 현상에 맞춰 잡았다. 골든아워는 고도 0~6도의 짧은 구간이라
// 앵커를 3도에 두고, 10도에서 이미 대부분 파란 하늘로 넘어가게 한다. 예전처럼
// 골든(6도)에서 낮(30도)까지 한 번에 이으면 고도 20도쯤에서 따뜻한 색과 찬
// 색이 반씩 섞여 진흙빛이 된다.
const ANCHOR_ALTITUDES = [-12, -4, 3, 10, 30]

const SKY_ANCHORS = {
  // 맑음: 밤의 감청 → 블루아워 → 골든아워 → 아침 푸른 기 → 한낮의 하늘색
  sunny: [
    ['#0d1526', '#141f38', '#1c2a4a'],
    ['#26305c', '#453a63', '#6e4a63'],
    ['#7b95cf', '#d4a189', '#f3c89e'],
    ['#7fabe0', '#a9c8e8', '#ddd9d4'],
    // 낮 하늘은 아래로 갈수록 옅어지되 흰색까지 가지 않는다. 흰색에 닿으면
    // 색상 정보가 사라져서, 다크 사다리로 눌렀을 때 회색이 되어 버린다.
    ['#7cbcf0', '#a8d6f8', '#d2ebff'],
  ],
  // 흐림: 채도를 거의 뺀 회색 사다리. 저녁에만 살짝 자줏빛이 돈다.
  cloudy: [
    ['#161920', '#1d2028', '#242830'],
    ['#3b3945', '#494551', '#5b5259'],
    ['#8f8d97', '#aaa19f', '#c2b5ab'],
    ['#9ba5ad', '#b3bcc2', '#cbd0d2'],
    ['#a7b3bd', '#bcc6ce', '#d2dae0'],
  ],
  // 비: 항상 어둡고 푸른 기가 도는 납빛. 낮에도 밝아지지 않는다
  // (비 오는 날 하늘은 실제로 어둡다 — 이 무드만 낮 앵커를 눌러 둔다).
  rainy: [
    ['#0d151f', '#131e2c', '#1a2839'],
    ['#202c3a', '#283544', '#313f50'],
    ['#2f414f', '#3a4e5e', '#465c6d'],
    ['#354a58', '#415a6a', '#4e6879'],
    ['#3a4f5d', '#475f70', '#557080'],
  ],
  // 눈: 비보다 밝고 푸른 파스텔. 낮에는 밝고 옅은 하늘.
  snowy: [
    ['#0e1720', '#15212c', '#1d2c39'],
    ['#2f3949', '#3b4557', '#4a5468'],
    ['#7a8698', '#949dad', '#b0b7c3'],
    ['#90b0c8', '#aeccdf', '#cbe0ee'],
    ['#a3c9e2', '#c2dcef', '#dceefa'],
  ],
}

export const SKY_MOODS = Object.keys(SKY_ANCHORS)

/**
 * 다크모드 하늘 = 같은 사다리의 명도를 눌러 만든 값.
 *
 * 상한(0.42)은 흰 잉크가 통과할 수 있는 한계까지 올려 잡았다. 더 낮게 잡으면
 * 한낮인데도 한밤처럼 보인다 — 다크모드라고 해서 낮이 밤이 되어야 할 이유는
 * 없고, 필요한 건 "잉크가 읽히는 어두움"이지 "검정"이 아니다. 하한(0.14)은
 * 반대로 한밤 하늘이 순수한 검정으로 주저앉지 않게 잡아 준다(완전한 검정이
 * 되면 별만 남고 하늘이라는 느낌 자체가 사라진다).
 *
 * 채도(a·b)는 줄이지 않고 오히려 올려 잡는다. 어두운 색은 같은 채도라도 사람
 * 눈에 훨씬 무채색으로 보여서, 그대로 누르면 하늘 아래쪽이 회색으로 탈색된다.
 * 올려 잡은 채도가 sRGB를 넘으면 toGamut()이 그 밝기에서 낼 수 있는 최대치로
 * 되돌린다(채널을 그냥 자르면 색상이 틀어진다).
 */
function dimForDark({ L, a, b }) {
  const dimmed = Math.max(0.14, Math.min(L * 0.54, 0.42))
  return toGamut({ L: dimmed, a: a * 1.25, b: b * 1.25 })
}

function lerpOklab(from, to, t) {
  return {
    L: from.L + (to.L - from.L) * t,
    a: from.a + (to.a - from.a) * t,
    b: from.b + (to.b - from.b) * t,
  }
}

/** 고도를 앵커 구간 인덱스 + 구간 내 비율로 환산한다. */
function locateAltitude(altitudeDeg) {
  if (altitudeDeg <= ANCHOR_ALTITUDES[0]) return { index: 0, t: 0 }
  const last = ANCHOR_ALTITUDES.length - 1
  if (altitudeDeg >= ANCHOR_ALTITUDES[last]) return { index: last - 1, t: 1 }
  for (let i = 0; i < last; i++) {
    const lo = ANCHOR_ALTITUDES[i]
    const hi = ANCHOR_ALTITUDES[i + 1]
    if (altitudeDeg < hi) return { index: i, t: (altitudeDeg - lo) / (hi - lo) }
  }
  return { index: last - 1, t: 1 }
}

// ── 잉크 · 스크림 ────────────────────────────────────────────────────────
// 스크림은 하늘 위에 까는 베일이다. 스트립의 칩과 패널의 글자가 하늘 색과
// 무관하게 항상 같은 바닥을 딛게 해준다(이게 없으면 칩마다 조건 분기가 다시
// 생긴다).
//
// 두께가 고정이 아닌 이유: 하늘이 어두운 쪽에서 밝은 쪽으로 넘어가는 도중에는
// 반드시 "밝은 잉크도 어두운 잉크도 애매한" 중간 밝기 구간을 지난다(비 오는
// 낮, 골든아워 직전 같은). 그 구간에서만 베일을 두껍게 해 배경을 한쪽으로
// 밀어준다. 나머지 시간에는 최소 두께라 하늘이 그대로 보인다. 마침 그 구간은
// 원래 대기가 뿌연 시간대라, 두꺼워진 베일이 연출로도 어색하지 않다.

const INK_ON_DARK = '#f5f8f9'
const INK_ON_LIGHT = '#0f1a20'

/** 평상시 스크림 두께. 중간 밝기 구간에서만 아래 사다리를 타고 올라간다. */
export const SCRIM_BASE_ALPHA = 0.12

/** 스크림이 시도하는 두께 사다리. 마지막 값이 상한이다. */
const SCRIM_STEPS = [0.12, 0.18, 0.24, 0.3, 0.36, 0.42]

/** 잉크가 통과해야 하는 최소 대비(WCAG AA 본문 기준). */
const AA = 4.5

function evaluate(stops, inkHex, scrimHex, alpha) {
  const veiled = stops.map((s) => overlay(s, scrimHex, alpha))
  // 보조 잉크는 본 잉크를 하늘 쪽으로 22% 당겨 한 단계 흐리게 만든 색이다.
  // 투명도(rgba)로 두지 않는 이유: 합성 결과를 여기서 알아야 대비를 잰다.
  const on2 = overlay(inkHex, veiled[1], 0.22)
  return {
    on: inkHex,
    on2,
    scrim: scrimHex,
    scrimAlpha: alpha,
    worst: Math.min(...veiled.map((v) => contrastRatio(inkHex, v))),
    worst2: Math.min(...veiled.map((v) => contrastRatio(on2, v))),
  }
}

/** 해당 극성이 AA를 넘기는 데 필요한 최소 두께로 평가한다. */
function inkCandidate(stops, inkHex, scrimHex) {
  let last = null
  for (const alpha of SCRIM_STEPS) {
    last = evaluate(stops, inkHex, scrimHex, alpha)
    if (last.worst >= AA && last.worst2 >= AA) return last
  }
  return last // 상한까지 갔는데도 못 넘긴 경우(테스트가 잡는다)
}

/**
 * 하늘 3스톱 위에 올릴 잉크를 고른다. 밝은 잉크와 어두운 잉크를 둘 다
 * 계산해 본 뒤, 더 얇은 베일로 AA를 넘기는 쪽을 쓴다(두께가 같으면 대비가
 * 더 좋은 쪽). 날씨 enum을 보고 추측하지 않는다 — 실제 색을 재서 정한다.
 */
function pickInk(stops) {
  const onDark = inkCandidate(stops, INK_ON_DARK, '#000000')
  const onLight = inkCandidate(stops, INK_ON_LIGHT, '#ffffff')

  const score = (c) => (c.worst >= AA && c.worst2 >= AA ? 0 : 1)
  let best
  if (score(onDark) !== score(onLight)) {
    best = score(onDark) < score(onLight) ? onDark : onLight
  } else if (onDark.scrimAlpha !== onLight.scrimAlpha) {
    best = onDark.scrimAlpha < onLight.scrimAlpha ? onDark : onLight
  } else {
    best = Math.min(onDark.worst, onDark.worst2) >= Math.min(onLight.worst, onLight.worst2)
      ? onDark
      : onLight
  }
  return { ...best, onDarkSky: best.on === INK_ON_DARK }
}

/**
 * 무드 · 태양고도 · 테마로 히어로 하늘 한 벌을 만든다.
 *
 * @param {object} opts
 * @param {'sunny'|'cloudy'|'rainy'|'snowy'} opts.mood
 * @param {number} opts.altitudeDeg 태양 고도(sunPosition.getSunAltitude)
 * @param {boolean} opts.dark 다크 테마 여부
 * @returns {{
 *   stops: string[],            // 그라데이션 3스톱(위→아래)
 *   on: string,                 // 본문 잉크
 *   on2: string,                // 보조 잉크
 *   scrim: string,              // 스크림 색('#000000' | '#ffffff')
 *   scrimAlpha: number,         // 스크림 최소 두께(중간 밝기 구간에서 올라간다)
 *   onDarkSky: boolean,         // 어두운 하늘 위(밝은 잉크)인가
 *   contrast: number,           // 본문 잉크의 최악 대비비
 *   contrast2: number,          // 보조 잉크의 최악 대비비
 * }}
 */
export function getSkyPalette({ mood = 'sunny', altitudeDeg = 30, dark = false } = {}) {
  const anchors = SKY_ANCHORS[mood] ?? SKY_ANCHORS.sunny
  const { index, t } = locateAltitude(altitudeDeg)

  const stops = [0, 1, 2].map((slot) => {
    const from = hexToOklab(anchors[index][slot])
    const to = hexToOklab(anchors[index + 1][slot])
    const lab = lerpOklab(from, to, t)
    return oklabToHex(dark ? dimForDark(lab) : lab)
  })

  const ink = pickInk(stops)
  return {
    stops,
    on: ink.on,
    on2: ink.on2,
    scrim: ink.scrim,
    scrimAlpha: ink.scrimAlpha,
    onDarkSky: ink.onDarkSky,
    contrast: ink.worst,
    contrast2: ink.worst2,
  }
}
