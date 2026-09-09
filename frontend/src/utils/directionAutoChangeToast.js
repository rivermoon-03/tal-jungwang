/**
 * directionAutoChangeToast.js — 자동 방향 전환 토스트 문구 생성 유틸
 *
 * 등하교 방향이 자동 판정으로 바뀔 때(오버라이드가 아닌 자동 전환)의 토스트 문구를 생성한다.
 *
 * 근거(reason)는 판정한 쪽(useEffectiveDirection)이 알려줘야 한다. 예전엔 이
 * 함수가 결과값만 보고 시각으로 근거를 역추론해서, 위치 보정으로 방향이 바뀐
 * 경우에도 "오후라서" 라는 거짓 문구가 떴다. 01:30 에 "아침이라서" 라고 말하는
 * 문제도 같은 원인이다 — 14시 경계 하나로 하루를 아침과 오후로만 갈랐다.
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
 * @param {{reason?: 'time'|'location'|'manual', now?: Date}} [opts]
 *   reason: useEffectiveDirection이 돌려준 판정 근거.
 *   now: 테스트용 주입 시각. 기본값은 호출 시점의 현재 시각.
 * @returns {string} 토스트 문구
 */
export function getDirectionAutoChangeMessage(newDirection, opts = {}) {
  // 두 번째 인자로 Date를 넘기던 기존 호출부 호환.
  const { reason, now } = opts instanceof Date ? { now: opts } : opts

  if (reason === 'location') {
    return `학교 근처라서 ${newDirection}로 전환했어요`
  }

  const hour = getKstHour(now ?? new Date())
  const timeOfDay = describeHour(hour)
  if (!timeOfDay) {
    // 근거를 말할 수 없으면 지어내지 않는다.
    return `${newDirection}로 전환했어요`
  }
  const particle = getParticleForNoun(timeOfDay)
  return `${timeOfDay}${particle} ${newDirection}로 전환했어요`
}

/**
 * 시각을 사람이 쓰는 낱말로 옮긴다. 판정 경계(14시)와 낱말 경계는 다르다.
 * 새벽 1시를 "아침" 이라 부르면 문구가 거짓이 된다 — 그 구간은 말하지 않는다.
 */
function describeHour(hour) {
  if (hour >= 5 && hour < 12) return '아침'
  if (hour >= 12 && hour < 18) return '오후'
  if (hour >= 18 && hour < 23) return '저녁'
  return null
}
