# Routes

- `/` + `#/map|main`: `frontend/src/components/layout/MainShell.jsx`
- `/schedule`: `frontend/src/pages/SchedulePage.jsx` → `frontend/src/components/schedule/SchedulePage.jsx`
- `/route/:id`: `frontend/src/pages/RouteDetailPage.jsx`
- `/cafeteria`: `frontend/src/pages/CafeteriaPage.jsx`
- `/more`: `frontend/src/components/more/MorePage.jsx`

라우터 라이브러리는 사용하지 않는다. `frontend/src/App.jsx`의 `pathnameToPage()`와 `popstate` 구독이 페이지를 선택한다.

