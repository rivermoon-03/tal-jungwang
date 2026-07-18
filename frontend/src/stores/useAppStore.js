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

      // 대시보드 스크롤 위치 보존 (탭 전환 시 유지)
      dashboardScrollTop: 0,
      setDashboardScrollTop: (v) => set({ dashboardScrollTop: v }),

      // 지하철 노선도 전역 시트 (SubwayPanel·SchedulePage → App 레벨 렌더링)
      subwayLineSheet: null, // { line, direction, currentStation, destination, color } | null
      setSubwayLineSheet: (item) => set({ subwayLineSheet: item }),
      closeSubwayLineSheet: () => set({ subwayLineSheet: null }),

      // 지하철 시간표+실시간 상세 시트 (지도 탭 패널 → App 레벨 렌더링)
      subwayDetailSheet: null, // { station, lineName, timetableKey, direction, color, darkColor, lightColor, symbol } | null
      setSubwayDetailSheet: (item) => set({ subwayDetailSheet: item }),
      closeSubwayDetailSheet: () => set({ subwayDetailSheet: null }),

      // ── 신규 테마 / UX 상태 (persist 대상) ───────────────────────────
      themeMode: 'system',          // 'light' | 'dark' | 'system'
      setThemeMode: (mode) => set({ themeMode: mode }),

      // F4 글자 크기: 0(작게)·1(보통)·2(크게). useFontScale이 --tj-font-scale로 변환.
      fontScale: 1,
      setFontScale: (v) => set({ fontScale: v }),

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
      hasAutoSelectedStation: false,
      setHasAutoSelectedStation: (v) => set({ hasAutoSelectedStation: v }),

      // PC 대시보드 정류장 GPS auto 모드. true면 useUserLocation 좌표 기준으로
      // 가장 가까운 정류장을 자동 선택. 사용자가 수동 chip 클릭 시 false로 전환.
      // "자동" chip 클릭 시 다시 true로 복귀.
      busStationAutoMode: true,
      setBusStationAutoMode: (v) => set({ busStationAutoMode: v }),

      // 셔틀 캠퍼스 ('main' = 본캠 direction 0/1, 'second' = 2캠 direction 2/3)
      selectedShuttleCampus: 'main',
      setShuttleCampus: (campus) => set({ selectedShuttleCampus: campus }),

      // 방향 수동 오버라이드. null일 때 effectiveDirection은 시간대로 자동 판정된다.
      // in-memory 전용 (persist 제외) — 새로고침 시 해제되어 자동 모드로 복귀.
      directionOverride: null,     // '등교' | '하교' | null
      setDirectionOverride: (dir) => set({ directionOverride: dir }),

      // 지도 뷰 상태 (탭 전환 시 유지, persist 제외 — 새로고침 시 초기화)
      mapView: null,               // { center: [lat, lng], level: number } | null
      setMapView: (v) => set({ mapView: v }),

      // PC 좌측 패널 영역 접기/펴기 (지도 풀스크린 토글). persist 안 함.
      mapFullscreen: false,
      toggleMapFullscreen: () => set((s) => ({ mapFullscreen: !s.mapFullscreen })),

      // 선택된 마커 ID (탭 전환 시 유지, persist 제외)
      selectedMarkerId: null,      // string | null
      setSelectedMarkerId: (id) => set({ selectedMarkerId: id }),

      // ── 지도 전체화면 토글 (시안2: 컴팩트 띠 ↔ 전체 지도) ──────────────
      // 구 snapMode는 backward compat용으로 남겨둔다 (persist migrate에서 정리됨).
      mapExpanded: false,
      toggleMapExpanded: () => set((s) => ({ mapExpanded: !s.mapExpanded })),
      setMapExpanded: (v) => set({ mapExpanded: v }),

      // ── 즐겨찾기 ─────────────────────────────────────────────────────
      // venues: F2 매점/식당(cafeteriaVenues) 즐겨찾기 id 배열.
      favorites: { routes: [], stations: [], venues: [] },
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
      // F2: 매점/식당 즐겨찾기 토글. routes/stations와 동일한 불변 배열 갱신 패턴.
      toggleFavoriteVenue: (id) =>
        set((s) => {
          const venues = (s.favorites.venues ?? []).includes(id)
            ? s.favorites.venues.filter((v) => v !== id)
            : [...(s.favorites.venues ?? []), id]
          return { favorites: { ...s.favorites, venues } }
        }),

      // ── PWA / 알림 ───────────────────────────────────────────────────
      pwaBannerDismissedAt: null,
      dismissPwaBanner: () => set({ pwaBannerDismissedAt: Date.now() }),

      notifPrefs: { enabled: false, leadMin: 10 },

      // ── 다크모드 토글 ─────────────────────────────────────────────────
      // darkMode는 useTheme이 themeMode + 시스템 설정을 종합해 실제 화면 상태로 동기화.
      // toggleDarkMode는 visible 상태(darkMode) 기준으로 반대로 explicit 전환한다
      // — themeMode가 'system'이어도 사용자가 보는 상태에서 명확히 뒤집힌다.
      darkMode: false, // useTheme에서 실시간 업데이트
      toggleDarkMode: () =>
        set((s) => ({
          themeMode: s.darkMode ? 'light' : 'dark',
        })),

      // ── F1: 등하교 자동/수동 판정 (persist 대상) ─────────────────────
      // commuteAutoMode=true면 useEffectiveDirection이 KST 시간대(+위치 보강)로
      // 자동 판정한다. false면 아래 commuteManualDirection 고정값을 그대로 쓴다.
      // (참고: directionOverride는 별개의 in-memory 세션 전용 퀵토글이며 항상 최우선.)
      commuteAutoMode: true,
      setCommuteAutoMode: (v) => set({ commuteAutoMode: v }),
      commuteManualDirection: '등교', // '등교' | '하교' — 수동 모드일 때만 사용
      setCommuteManualDirection: (dir) => set({ commuteManualDirection: dir }),

      // ── F3: 시간표 기본 보기(그리드/리스트) persist ───────────────────
      // ScheduleDetailModal의 viewMode 초기값 + SettingsPage "시간표 기본 보기"가
      // 이 필드를 공유한다.
      scheduleViewMode: 'grid', // 'grid' | 'list'
      setScheduleViewMode: (mode) => set({ scheduleViewMode: mode }),

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
      // zustand persist 기본 merge는 최상위 키를 얕게(shallow) 덮어쓴다.
      // favorites처럼 중첩 객체에 새 필드(venues)를 추가하면, 구버전 persisted
      // state(venues 없음)가 favorites 전체를 통째로 덮어써 새 필드가 사라진다.
      // → favorites만 얕은 병합을 한 번 더 해 새 필드 기본값을 보존한다.
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...persistedState }
        if (persistedState && typeof persistedState === 'object' && persistedState.favorites) {
          merged.favorites = { ...currentState.favorites, ...persistedState.favorites }
        }
        return merged
      },
      partialize: (state) => ({
        themeMode: state.themeMode,
        fontScale: state.fontScale,
        favorites: state.favorites,
        selectedMode: state.selectedMode,
        selectedSubwayStation: state.selectedSubwayStation,
        selectedBusStation: state.selectedBusStation,
        selectedBusDirection: state.selectedBusDirection,
        selectedShuttleCampus: state.selectedShuttleCampus,
        pwaBannerDismissedAt: state.pwaBannerDismissedAt,
        notifPrefs: state.notifPrefs,
        busStationAutoMode: state.busStationAutoMode,
        // F1/F3 신규 persist 필드
        commuteAutoMode: state.commuteAutoMode,
        commuteManualDirection: state.commuteManualDirection,
        scheduleViewMode: state.scheduleViewMode,
      }),
    }
  )
)

export default useAppStore
