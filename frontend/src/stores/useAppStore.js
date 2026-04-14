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
  driveRouteCoords: null,
  setDriveRouteCoords: (coords) => set({ driveRouteCoords: coords }),
  tabBadges: { transit: false, subway: false, more: false },
  setTabBadges: (badges) => set((s) => ({ tabBadges: { ...s.tabBadges, ...badges } })),
  mapPanTarget: null,
  setMapPanTarget: (target) => set({ mapPanTarget: target }),
  openInfoTab: null,
  setOpenInfoTab: (tab) => set({ openInfoTab: tab }),
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
