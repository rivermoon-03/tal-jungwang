import { useState, useEffect, useRef, useCallback } from 'react'
import { requestNotificationPermission } from '../utils/pushNotifications'
import {
  alarmFireDate,
  loadShuttleAlarms,
  saveShuttleAlarms,
  upsertShuttleAlarm,
  removeShuttleAlarm as removeAlarmFromList,
  findShuttleAlarm,
} from '../utils/shuttleAlarmStorage'
import { SHUTTLE_ALARM_TITLE, formatShuttleAlarmMessage } from '../utils/shuttleAlarmMessage'

const STORAGE_KEY = 'shuttle_notification_enabled'
const NOTIFY_BEFORE_MIN = 10

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function useShuttleNotification(timeObjs = []) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  )
  const [permission, setPermission] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  )

  const toggle = useCallback(async () => {
    if (!enabled) {
      if (permission !== 'granted') {
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result !== 'granted') return
      }
      localStorage.setItem(STORAGE_KEY, '1')
      setEnabled(true)
    } else {
      localStorage.setItem(STORAGE_KEY, '0')
      setEnabled(false)
    }
  }, [enabled, permission])

  useEffect(() => {
    if (!enabled || permission !== 'granted' || timeObjs.length === 0) return

    const check = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const next = timeObjs.find((t) => toMin(t.depart_at) > nowMin)
      if (!next) return
      const diff = toMin(next.depart_at) - nowMin
      if (diff === NOTIFY_BEFORE_MIN) {
        new Notification('셔틀 출발 알림', {
          body: `${next.depart_at} 셔틀이 ${NOTIFY_BEFORE_MIN}분 후 출발합니다.`,
          icon: '/favicon.ico',
        })
      }
    }

    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [enabled, permission, timeObjs])

  return { enabled, permission, toggle }
}

/**
 * useShuttleAlarms — 특정 편(HH:MM)에 대한 알림 예약(F3-3). 위 useShuttleNotification
 * 과 달리 "10분 전 고정 하나"가 아니라 사용자가 편/리드타임을 골라 여러 건 예약할 수
 * 있다. 예약 목록은 localStorage(tj-shuttle-alarms)에 두고(스토어 수정 금지 범위),
 * 각 예약마다 setTimeout으로 로컬 Notification을 울린다.
 *
 * 주의: setTimeout 기반이라 이 훅이 마운트된 동안(=셔틀 시간표 탭이 열려있는 동안)만
 * 동작한다. 앱을 완전히 닫거나 tab을 벗어나 컴포넌트가 언마운트되면 예약도 함께
 * 사라진다(서버 푸시가 아닌 로컬 알림의 알려진 한계 — 실제 백그라운드 발송이 필요하면
 * utils/pushNotifications.js의 VAPID 구독 경로를 확장해야 한다).
 */
export function useShuttleAlarms() {
  const [alarms, setAlarms] = useState(() => loadShuttleAlarms())
  const timersRef = useRef([])

  // alarms가 바뀔 때마다 예약된 setTimeout을 모두 재설정한다. 언마운트/재실행 시
  // 이전 타이머를 반드시 정리해 좀비 타이머가 남지 않게 한다.
  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const now = new Date()
    const timers = []
    for (const alarm of alarms) {
      const delay = alarmFireDate(alarm.time, alarm.lead, now).getTime() - now.getTime()
      if (delay <= 0) continue // 로드 시 정리에서 대부분 걸러지지만 방어적으로 한 번 더 확인
      const id = setTimeout(() => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(SHUTTLE_ALARM_TITLE, {
            body: formatShuttleAlarmMessage(alarm.time, alarm.lead),
            icon: '/favicon.ico',
          })
        }
        setAlarms((prev) => {
          const next = removeAlarmFromList(prev, alarm.time, alarm.direction)
          saveShuttleAlarms(next)
          return next
        })
      }, delay)
      timers.push(id)
    }
    timersRef.current = timers

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [alarms])

  // 알림 권한을 요청하고, 허용되면 (time, direction) 예약을 추가/교체한다.
  const addAlarm = useCallback(async (time, lead, direction) => {
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') return { ok: false, reason: permission }
    setAlarms((prev) => {
      const next = upsertShuttleAlarm(prev, { time, lead, direction })
      saveShuttleAlarms(next)
      return next
    })
    return { ok: true }
  }, [])

  const removeAlarm = useCallback((time, direction) => {
    setAlarms((prev) => {
      const next = removeAlarmFromList(prev, time, direction)
      saveShuttleAlarms(next)
      return next
    })
  }, [])

  const isAlarmSet = useCallback(
    (time, direction) => findShuttleAlarm(alarms, time, direction) != null,
    [alarms]
  )

  return { alarms, addAlarm, removeAlarm, isAlarmSet }
}
