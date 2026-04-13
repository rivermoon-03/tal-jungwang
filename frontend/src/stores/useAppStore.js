import { create } from 'zustand'

const DARK_KEY = 'tal_dark'

const useAppStore = create((set) => ({
  activeTab: 'main',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedStationId: null,
  setSelectedStationId: (id) => set({ selectedStationId: id }),
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),
  sheetOpen: false,
  setSheetOpen: (open) => set({ sheetOpen: open }),
  driveRouteCoords: null,       // [[lng, lat], ...] | null — 지도에 그릴 경로
  setDriveRouteCoords: (coords) => set({ driveRouteCoords: coords }),
  tabBadges: { shuttle: false, bus: false, subway: false },
  setTabBadges: (badges) => set({ tabBadges: badges }),
  mapPanTarget: null,            // { lat, lng } | null — 지도 이동 요청
  setMapPanTarget: (target) => set({ mapPanTarget: target }),
  taxiOpen: false,
  setTaxiOpen: (v) => set({ taxiOpen: v }),
  toggleTaxiOpen: () => set((s) => ({ taxiOpen: !s.taxiOpen })),
  darkMode: localStorage.getItem(DARK_KEY) === '1',
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode
    localStorage.setItem(DARK_KEY, next ? '1' : '0')
    return { darkMode: next }
  }),
}))

export default useAppStore
