/**
 * GPS 소프트 프롬프트 상태 훅.
 *
 * 권한 상태를 비동기로 확인하고 결과를 반환한다. 컴포넌트(GpsSoftPrompt.jsx)와
 * 한 파일에 있으면 fast refresh가 동작하지 않아 분리했다.
 *
 * @returns {{ promptState: 'idle'|'prompt'|'denied'|'granted', checkAndShow: () => void, hide: () => void }}
 */
import { useState } from 'react'

export function useGpsSoftPrompt() {
  const [promptState, setPromptState] = useState('idle')

  async function checkAndShow() {
    if (!navigator.permissions?.query) {
      setPromptState('prompt')
      return
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      if (result.state === 'granted') {
        setPromptState('granted')
      } else {
        setPromptState(result.state)
      }
    } catch {
      setPromptState('prompt')
    }
  }

  function hide() {
    setPromptState('idle')
  }

  return { promptState, checkAndShow, hide }
}
