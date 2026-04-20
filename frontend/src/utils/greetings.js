// frontend/src/utils/greetings.js
// ────────────────────────────────────────────────────────────────
// Greeting bank — lines chosen by (slot, dayType) then deterministic seed.
// Add new lines to any bucket freely; the picker hashes over length.
// Voice: observational, a little tired, a little warm. Not cheerful.
// ────────────────────────────────────────────────────────────────

/** @type {Record<string, Record<string, string[]>>} */
export const GREETINGS = {
  // ── DAWN 04:00–06:59 ────────────────────────────────────────
  dawn: {
    weekday: [
      '아직 거리도 깨지 않았어요',
      '첫차보다 먼저 일어났네요 ☕',
      '오늘을 살짝 먼저 열어볼까요',
      '새벽 공기는 늘 조금 차요',
    ],
    weekend: [
      '주말 새벽, 조용히 흐르고 있어요',
      '이 시간만의 고요함이 있죠',
      '아직 아무도 깨지 않은 주말',
    ],
    holiday: [
      '쉬는 날 새벽에도 깨어 있네요',
      '오늘은 천천히 시작해도 돼요',
    ],
  },

  // ── MORNING 07:00–08:59 (등교/출근 peak) ────────────────────
  morning: {
    weekday: [
      '한 걸음이면, 오늘이 시작돼요 ☕',
      '아침 공기가 어깨를 가볍게 해요',
      '오늘도 정왕의 하루, 같이 가요',
      '버스 한 대, 마음 한 번 고르고',
      '어제보다 10분만 덜 뛰어요',
      '지금 나가면 딱 좋아요',
      '창문에 햇살이 비스듬해요',
    ],
    weekend: [
      '늦잠을 조금만 더 허락해도 돼요',
      '주말 아침은 발이 가벼워요',
      '오늘은 어디부터 시작할까요',
    ],
    holiday: [
      '공휴일 아침, 여유를 껴안아요',
      '오늘은 서두를 곳이 없어요',
    ],
  },

  // ── LATE MORNING 09:00–11:29 ───────────────────────────────
  late_morn: {
    weekday: [
      '오전이 천천히 자리를 잡네요',
      '창밖엔 이미 사람들이 분주해요',
      '커피 한 모금 쉬어갈 시간',
    ],
    weekend: [
      '햇살이 길어지는 주말 오전',
      '오늘은 조금 게을러도 괜찮아요',
    ],
    holiday: [
      '느긋한 오전, 그대로 즐겨요',
    ],
  },

  // ── LUNCH 11:30–13:29 ──────────────────────────────────────
  lunch: {
    weekday: [
      '점심, 오늘은 뭐 먹을까요 🍱',
      '잠깐 숨 고르는 시간이에요',
      '학식도 하나의 선택지죠',
    ],
    weekend: [
      '주말 점심은 늘 살짝 특별해요',
      '오늘은 누구랑 먹어요?',
    ],
    holiday: [
      '공휴일 점심은 조금 늘어져요',
    ],
  },

  // ── AFTERNOON 13:30–16:59 ──────────────────────────────────
  afternoon: {
    weekday: [
      '오후의 햇살이 길게 누워요',
      '나른한 오후, 버틸 힘만 있으면 돼요',
      '한 템포 쉬어도 괜찮아요',
    ],
    weekend: [
      '주말 오후엔 어디든 좋아요',
      '커피 한 잔으로 충분한 오후',
    ],
    holiday: [
      '오늘은 이대로 흘러가도 좋아요',
    ],
  },

  // ── EVENING 17:00–19:29 (하교/퇴근 peak) ────────────────────
  evening: {
    weekday: [
      '오늘도 고생 많았어요 🌇',
      '버스에 기대어 잠시 쉬어요',
      '하늘이 붉어질 시간이에요',
      '수고한 어깨 위, 바람 한 줌',
      '집까지 몇 정거장, 거의 다 왔어요',
      '정왕의 저녁은 조용히 와요',
      '오늘 하루, 여기까지면 충분해요',
    ],
    weekend: [
      '주말 저녁은 어쩐지 길어요',
      '이제 하루를 접어도 괜찮아요',
      '노을 보러 잠깐 멈춰볼까요',
    ],
    holiday: [
      '공휴일 저녁, 살짝 아쉬워요',
      '내일은 또 내일의 일이죠',
    ],
  },

  // ── NIGHT 19:30–22:59 ──────────────────────────────────────
  night: {
    weekday: [
      '밤이 조용히 내려앉았어요',
      '막차 시간이 다가오고 있어요',
      '오늘 하루, 수고했어요',
    ],
    weekend: [
      '주말 밤은 왜 더 빨리 갈까요',
      '오늘의 마무리는 어떻게 할래요',
    ],
    holiday: [
      '공휴일 밤, 내일을 잠시 미뤄도 돼요',
    ],
  },

  // ── LATE NIGHT 23:00–01:29 ────────────────────────────────
  late_night: {
    weekday: [
      '버스가 점점 줄어드는 시간이에요',
      '오늘은 이만 쉬어도 괜찮아요',
      '늦은 밤의 정왕은 꽤 고요해요 🌙',
    ],
    weekend: [
      '주말 밤의 여운, 조금만 더',
      '잠들기엔 살짝 아쉬운 시간',
    ],
    holiday: [
      '내일도 공휴일이면 좋을 텐데요',
    ],
  },

  // ── MID NIGHT 01:30–03:59 ─────────────────────────────────
  mid_night: {
    weekday: [
      '이 시간까지 버텨주셨네요 🌙',
      '잠깐이라도 눈 붙여요',
      '새벽 세 시, 세상이 가장 조용해요',
    ],
    weekend: [
      '주말 새벽, 혼자만의 시간이에요',
      '무리하지 말고 쉬어요',
    ],
    holiday: [
      '공휴일 새벽, 오늘은 푹 자요',
    ],
  },
}

// Stable hash — same (slot, dayType, seed) → same phrase.
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h
}

export function pickGreeting({ slot, dayType, seed = 0 } = {}) {
  const bySlot = GREETINGS[slot] ?? GREETINGS.morning
  const list   = bySlot[dayType] ?? bySlot.weekday ?? Object.values(bySlot)[0]
  if (!list || list.length === 0) return ''
  const idx = hash(`${slot}|${dayType}|${seed}`) % list.length
  return list[idx]
}
