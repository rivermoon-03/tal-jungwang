import '@testing-library/jest-dom'

// Node 26부터 전역에 게이트된 localStorage 게터가 생겨( --localstorage-file 없으면
// undefined 반환) jsdom이 자기 localStorage를 주입하지 않는다. CI(Node 22)는 정상이라
// 로컬에서만 shuttleAlarmStorage 등 23개 테스트가 깨졌다 — 인메모리 폴리필로 통일한다.
if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage == null) {
  const store = new Map()
  const memoryStorage = {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)) },
    removeItem: (k) => { store.delete(String(k)) },
    clear: () => { store.clear() },
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, writable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage, writable: true })
  }
}

// jsdom에는 window.matchMedia가 없어서 MarkerSheet 등에서 사용 시 오류 방지
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
