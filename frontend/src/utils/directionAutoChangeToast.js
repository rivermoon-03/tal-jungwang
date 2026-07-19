/**
 * directionAutoChangeToast.js — 자동 방향 전환 토스트 문구 생성 유틸
 *
 * 등하교 방향이 자동 판정으로 바뀔 때(오버라이드가 아닌 자동 전환)의 토스트 문구를 생성한다.
 * 시간 기반 판정 규칙(KST 14시 경계): 자정~13시 = 등교, 14시~23시 = 하교.
 */

import { getKstHour } from './timeOfDay'

/**
 * 한글 명사 뒤에 붙을 조사를 판정한다.
 * 받침 있음(자음으로 끝남): "-이라서"
 * 받침 없음(모음으로 끝남): "-라서"
 *
 * @param {string} noun
 * @returns {string} 문구(예: "이라서", "라서")
 */
function getParticleForNoun(noun) {
  if (!noun || noun.length === 0) return '라서'
  const lastChar = noun.charCodeAt(noun.length - 1)
  // 한글 범위: 0xAC00('가') ~ 0xD7A3('힣')
  if (lastChar >= 0xac00 && lastChar <= 0xd7a3) {
    // 한글 유니코드 구조: (초성*588 + 중성*28 + 종성) + 0xAC00
    // 종성(받침)은 (charCode - 0xAC00) % 28로 추출 (0 = 받침 없음, 1~27 = 받침 있음)
    const remainder = (lastChar - 0xac00) % 28
    return remainder !== 0 ? '이라서' : '라서'
  }
  return '라서'
}

/**
 * 자동 방향 전환 토스트 문구를 생성한다.
 *
 * @param {string} newDirection - 새로운 방향('등교'|'하교')
 * @param {Date} [now] - 테스트용 주입 시각. 기본값은 호출 시점의 현재 시각.
 * @returns {string} 토스트 문구(예: "아침이라서 등교로 전환했어요", "오후라서 하교로 전환했어요")
 */
export function getDirectionAutoChangeMessage(newDirection, now = new Date()) {
  const hour = getKstHour(now)
  const timeOfDay = hour < 14 ? '아침' : '오후'
  const particle = getParticleForNoun(timeOfDay)
  return `${timeOfDay}${particle} ${newDirection}로 전환했어요`
}
