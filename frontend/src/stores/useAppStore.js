import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useAppStore = create(
  persist(
    (set, get) => ({
      // ── 기존 필드 (유지) ─────────────────────────────────────────────
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
      // 도보 경로: { coords: [[lng,lat],...], destName, durationSec, distanceM } | null
      walkRoute: null,
      setWalkRoute: (route) => set({ walkRoute: route }),
      clearWalkRoute: () => set({ walkRoute: null }),
      tabBadges: { transit: false, subway: false, more: false },
      setTabBadges: (badges) => set((s) => ({ tabBadges: { ...s.tabBadges, ...badges } })),
      mapPanTarget: null,
      setMapPanTarget: (target) => set({ mapPanTarget: target }),
      openInfoTab: null,
      setOpenInfoTab: (tab) => set({ openInfoTab: tab }),
      // 마커 시트의 "상세 보기" 버튼이 /schedule 진입 시 초기 모드·그룹을 지정
      scheduleHint: null, // { mode, group?, routeCode? } | null
      setScheduleHint: (hint) => set({ scheduleHint: hint }),
      taxiOpen: false,
      setTaxiOpen: (v) => set({ taxiOpen: v }),
      toggleTaxiOpen: () => set((s) => ({ taxiOpen: !s.taxiOpen })),

      // ── 신규 테마 / UX 상태 (persist 대상) ───────────────────────────
      themeMode: 'system',          // 'light' | 'dark' | 'system'
      setThemeMode: (mode) => set({ themeMode: mode }),

      headerCollapsed: false,
      toggleHeader: () => set((s) => ({ headerCollapsed: !s.headerCollapsed })),

      cardCollapsed: false,
      toggleCard: () => set((s) => ({ cardCollapsed: !s.cardCollapsed })),

      selectedMode: 'bus',          // 'subway' | 'bus' | 'shuttle'
      setSelectedMode: (mode) => set({ selectedMode: mode }),

      selectedSubwayStation: '정왕', // '정왕' | '초지' | '시흥시청'
      setSubwayStation: (station) => set({ selectedSubwayStation: station }),

      selectedBusGroup: '정왕역행',  // '정왕역행' | '버스 - 서울행' | '버스 - 학교행' | '기타'
      setBusGroup: (group) => set({ selectedBusGroup: group }),

      // ── 즐겨찾기 ─────────────────────────────────────────────────────
      favorites: { routes: [], stations: [] },
      toggleFavoriteRoute: (id) =>
        set((s) => {
          const routes = s.favorites.routes.includes(id)
            ? s.favorites.routes.filter((r) => r !== id)
            : [...s.favorites.routes, id]
          return { favorites: { ...s.favorites, routes } }
        }),
      toggleFavoriteStation: (id) =>
        set((s) => {
          const stations = s.favorites.stations.includes(id)
            ? s.favorites.stations.filter((st) => st !== id)
            : [...s.favorites.stations, id]
          return { favorites: { ...s.favorites, stations } }
        }),

      // ── PWA / 알림 ───────────────────────────────────────────────────
      pwaBannerDismissedAt: null,
      dismissPwaBanner: () => set({ pwaBannerDismissedAt: Date.now() }),

      notifPrefs: { enabled: false, leadMin: 10 },

      // ── 다크모드 레거시 (하위호환) ─────────────────────────────────────
      // App.jsx의 기존 useAppStore((s) => s.darkMode) 구독자들을 위해 유지.
      // useTheme 훅이 themeMode를 정식으로 처리하므로 이 값은 참고용.
      darkMode: false, // useTheme에서 실시간 업데이트
      toggleDarkMode: () =>
        set((s) => ({
          themeMode: s.themeMode === 'dark' ? 'light' : 'dark',
        })),
    }),
    {
      name: 'tal-jungwang',
      version: 2,
      migrate: (state, fromVersion) => {
        if (!state) return state
        // v1 → v2: 버스 그룹 4분할 (정왕역→정왕역행, 서울→버스 - 서울행)
        if (fromVersion < 2 && state.selectedBusGroup) {
          const map = {
            '정왕역': '정왕역행',
            '서울':   '버스 - 서울행',
            '서울행': '버스 - 서울행',
          }
          state.selectedBusGroup = map[state.selectedBusGroup] ?? state.selectedBusGroup
        }
        return state
      },
      storage: createJSONStorage(() => {
        // 시크릿 모드 / localStorage 실패 시 in-memory 폴백
        try {
          localStorage.setItem('__test__', '1')
          localStorage.removeItem('__test__')
          return localStorage
        } catch {
          const mem = {}
          return {
            getItem: (k) => mem[k] ?? null,
            setItem: (k, v) => { mem[k] = v },
            removeItem: (k) => { delete mem[k] },
          }
        }
      }),
      partialize: (state) => ({
        themeMode: state.themeMode,
        favorites: state.favorites,
        headerCollapsed: state.headerCollapsed,
        cardCollapsed: state.cardCollapsed,
        selectedMode: state.selectedMode,
        selectedSubwayStation: state.selectedSubwayStation,
        selectedBusGroup: state.selectedBusGroup,
        pwaBannerDismissedAt: state.pwaBannerDismissedAt,
        notifPrefs: state.notifPrefs,
      }),
    }
  )
)

export default useAppStore
