import { create } from 'zustand'

const useAppStore = create((set) => ({
  activeTab: 'main',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedStationId: null,
  setSelectedStationId: (id) => set({ selectedStationId: id }),
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),
  sheetOpen: false,
  setSheetOpen: (open) => set({ sheetOpen: open }),
}))

export default useAppStore
