import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useAppStore = create(
  persist(
    (set) => ({
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
      // 페이지 이동 없이 어디서든 열 수 있는 ScheduleDetailModal 전역 상태.
      // 대시보드 버스 행 탭 등에서 쓰인다. detail 객체는 SchedulePage의 detail과 동일 shape.
      detailModal: null,
      setDetailModal: (detail) => set({ detailModal: detail }),
      closeDetailModal: () => set({ detailModal: null }),
      taxiOpen: false,
      setTaxiOpen: (v) => set({ taxiOpen: v }),
      toggleTaxiOpen: () => set((s) => ({ taxiOpen: !s.taxiOpen })),

      // 지하철 노선도 전역 시트 (SubwayPanel·SchedulePage → App 레벨 렌더링)
      subwayLineSheet: null, // { line, direction, currentStation, destination, color } | null
      setSubwayLineSheet: (item) => set({ subwayLineSheet: item }),
      closeSubwayLineSheet: () => set({ subwayLineSheet: null }),

      // ── 신규 테마 / UX 상태 (persist 대상) ───────────────────────────
      themeMode: 'system',          // 'light' | 'dark' | 'system'
      setThemeMode: (mode) => set({ themeMode: mode }),

      selectedMode: 'bus',          // 'bus' | 'subway' | 'shuttle' | 'taxi'
      setSelectedMode: (mode) => set({ selectedMode: mode }),

      selectedSubwayStation: '정왕', // '정왕' | '초지' | '시흥시청'
      setSubwayStation: (station) => set({ selectedSubwayStation: station }),

      // 버스 정류장·방향 (각각 독립 상태)
      // station: '한국공학대' | '이마트' | '시흥시청' | '서울'
      // direction: '등교' | '하교'  (정류장별 허용 방향은 busStationConfig에서 정의)
      selectedBusStation: '한국공학대',
      setBusStation: (station) => set({ selectedBusStation: station }),
      selectedBusDirection: '하교',
      setBusDirection: (direction) => set({ selectedBusDirection: direction }),

      // 셔틀 캠퍼스 ('main' = 본캠 direction 0/1, 'second' = 2캠 direction 2/3)
      selectedShuttleCampus: 'main',
      setShuttleCampus: (campus) => set({ selectedShuttleCampus: campus }),

      // 방향 수동 오버라이드. null일 때 effectiveDirection은 시간대로 자동 판정된다.
      // in-memory 전용 (persist 제외) — 새로고침 시 해제되어 자동 모드로 복귀.
      directionOverride: null,     // '등교' | '하교' | null
      setDirectionOverride: (dir) => set({ directionOverride: dir }),

      // ── 2단 스냅 (지도 40% ↔ 대시보드 60%) ────────────────────────────
      snapMode: 'default',           // 'default' | 'dashboard' | 'map'
      setSnapMode: (m) => set({ snapMode: m }),
      toggleSnap: () =>
        set((s) => ({
          snapMode: s.snapMode === 'dashboard' ? 'default' : 'dashboard',
        })),

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
      version: 7,
      migrate: (state, fromVersion) => {
        if (!state) return state
        // v1 → v2: 버스 그룹 4분할
        if (fromVersion < 2 && state.selectedBusGroup) {
          const map = {
            '정왕역': '정왕역행',
            '서울':   '버스 - 서울행',
            '서울행': '버스 - 서울행',
          }
          state.selectedBusGroup = map[state.selectedBusGroup] ?? state.selectedBusGroup
        }
        // v2 → v3: 버스 그룹 3분할 (등교/하교/기타)
        if (fromVersion < 3 && state.selectedBusGroup) {
          const map = {
            '정왕역행':      '하교',
            '버스 - 서울행': '하교',
            '버스 - 학교행': '등교',
          }
          state.selectedBusGroup = map[state.selectedBusGroup] ?? state.selectedBusGroup
        }
        // v3 → v4: 2단 스냅 snapMode 도입 + 레거시 collapsed 제거
        if (fromVersion < 4) {
          const valid = new Set(['default', 'dashboard', 'map'])
          if (!valid.has(state.snapMode)) state.snapMode = 'default'
          delete state.headerCollapsed
          delete state.cardCollapsed
        }
        // v4 → v5: selectedBusGroup → selectedBusStation + selectedBusDirection
        if (fromVersion < 5) {
          const prev = state.selectedBusGroup
          if (prev === '등교' || prev === '기타') {
            state.selectedBusStation = '이마트'
          } else {
            state.selectedBusStation = '한국공학대'
          }
          state.selectedBusDirection = '하교'
          delete state.selectedBusGroup
        }
        // v6 → v7: 지금 탭 제거. 관련 키 정리.
        if (fromVersion < 7) {
          delete state.commuteMode
          delete state.commuteModeOverride
          delete state.selectedDestinationCode
          delete state.firstScreen
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
        selectedMode: state.selectedMode,
        selectedSubwayStation: state.selectedSubwayStation,
        selectedBusStation: state.selectedBusStation,
        selectedBusDirection: state.selectedBusDirection,
        selectedShuttleCampus: state.selectedShuttleCampus,
        pwaBannerDismissedAt: state.pwaBannerDismissedAt,
        notifPrefs: state.notifPrefs,
      }),
    }
  )
)

export default useAppStore
