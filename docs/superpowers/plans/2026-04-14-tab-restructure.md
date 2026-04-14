# 탭 개편 구현 계획 — 셔틀+버스 통합 & 더보기 탭 신설

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 셔틀·버스 탭을 `transit` 탭으로 통합하고, 공지사항·링크·앱 정보·셔틀 알림을 담는 `more` 탭을 신설한다.

**Architecture:** 백엔드에 `Notice / AppLink / AppInfo` 세 모델을 추가하고 `/api/v1/more/*` 공개 엔드포인트 + `/api/v1/admin/*` CRUD를 구현한다. 프론트엔드는 `TransitTab` (ShuttleCard + BusCard + BottomSheet)과 `MoreTab`을 신규 작성하고, 탭 라우팅을 `transit` / `more`로 업데이트한다.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, Redis, React 18, Tailwind CSS v3, Zustand

**병렬 실행 안내:**
- **Task 1 + Task 2** — 동시 실행 가능 (백엔드 DB, 프론트 레이아웃 독립)
- **Task 3 + Task 4 + Task 5** — Task 1 완료 후 동시 실행 가능
- **Task 6** — Task 3·4·5 완료 후 통합

---

## Task 1: 백엔드 — DB 모델 + Alembic 마이그레이션

**담당:** db-infra 에이전트

**Files:**
- Create: `backend/app/models/more.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/0002_add_more_tables.py`

---

- [ ] **Step 1: `backend/app/models/more.py` 작성**

```python
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AppLink(Base):
    __tablename__ = "app_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    icon: Mapped[str] = mapped_column(String(10), nullable=False)   # 이모지
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class AppInfo(Base):
    __tablename__ = "app_info"

    id: Mapped[int] = mapped_column(primary_key=True)          # 항상 id=1 단일 행
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    feedback_url: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

- [ ] **Step 2: `backend/app/models/__init__.py`에 임포트 추가**

파일을 읽어 현재 내용을 확인한 뒤 `more` 모델을 추가한다. 파일이 비어 있거나 없으면 아래 내용으로 생성한다.

```python
from app.models.bus import BusArrivalHistory, BusRoute, BusStop, BusStopRoute, BusTimetableEntry
from app.models.more import AppInfo, AppLink, Notice
from app.models.shuttle import SchedulePeriod, ShuttleRoute, ShuttleTimetableEntry
from app.models.subway import SubwayTimetableEntry
from app.models.traffic import TrafficSnapshot

__all__ = [
    "BusArrivalHistory",
    "BusRoute",
    "BusStop",
    "BusStopRoute",
    "BusTimetableEntry",
    "AppInfo",
    "AppLink",
    "Notice",
    "SchedulePeriod",
    "ShuttleRoute",
    "ShuttleTimetableEntry",
    "SubwayTimetableEntry",
    "TrafficSnapshot",
]
```

- [ ] **Step 3: Alembic 마이그레이션 파일 생성**

`backend/alembic/versions/` 디렉토리의 가장 최신 revision ID를 확인한다 (파일이 없으면 `None`).

```bash
ls backend/alembic/versions/
```

`backend/alembic/versions/0002_add_more_tables.py` 작성 (down_revision은 실제 최신 revision ID로 교체):

```python
"""add more tables (notices, app_links, app_info)

Revision ID: 0002_add_more_tables
Revises: <이전_revision_id_또는_None>
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_add_more_tables"
down_revision = None   # ← 실제 이전 revision ID로 교체 (없으면 None 유지)
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_table(
        "app_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("icon", sa.String(10), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_table(
        "app_info",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("feedback_url", sa.String(500), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("app_info")
    op.drop_table("app_links")
    op.drop_table("notices")
```

- [ ] **Step 4: 마이그레이션 실행 확인**

Docker Compose가 실행 중인지 확인하고, 마이그레이션을 적용한다.

```bash
cd backend
alembic upgrade head
```

Expected output에 `Running upgrade ... -> 0002_add_more_tables` 포함.

- [ ] **Step 5: 테이블 생성 확인**

```bash
docker compose exec db psql -U postgres -d taljeongwang -c "\dt notices; \dt app_links; \dt app_info;"
```

세 테이블 모두 보이면 성공.

- [ ] **Step 6: 초기 데이터 삽입 (app_info 단일 행)**

```bash
docker compose exec db psql -U postgres -d taljeongwang -c "
INSERT INTO app_info (id, version, description, feedback_url)
VALUES (1, '1.0.0', '정왕동 교통 통합 정보 서비스', NULL)
ON CONFLICT (id) DO NOTHING;
"
```

- [ ] **Step 7: 커밋**

```bash
git add backend/app/models/more.py backend/app/models/__init__.py backend/alembic/versions/0002_add_more_tables.py
git commit -m "feat(db): add notices, app_links, app_info tables"
```

---

## Task 2: 프론트엔드 — 탭 레이아웃 재구성

**담당:** frontend 에이전트  
**Task 1과 병렬 실행 가능**

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/stores/useAppStore.js`
- Modify: `frontend/src/components/layout/MobileTabBar.jsx`
- Modify: `frontend/src/components/layout/PCNavbar.jsx`
- Modify: `frontend/src/components/layout/PCSidebar.jsx`

---

- [ ] **Step 1: `useAppStore.js` — 탭 관련 상태 업데이트**

`tabBadges`에서 `shuttle` / `bus` 키를 `transit` / `more`로 교체.

```js
// frontend/src/stores/useAppStore.js
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
  setTabBadges: (badges) => set({ tabBadges: badges }),
  mapPanTarget: null,
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
```

- [ ] **Step 2: `MobileTabBar.jsx` — 탭 목록 변경**

`Bus`, `BusFront` 아이콘 임포트 제거하고 `MoreHorizontal` 추가.  
TABS 배열을 `transit` / `more`로 교체.

```jsx
// frontend/src/components/layout/MobileTabBar.jsx
import { Map, Bus, TrainFront, MoreHorizontal, Locate, School } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '지도',   Icon: Map           },
  { id: 'transit', label: '교통',   Icon: Bus           },
  { id: 'subway',  label: '지하철', Icon: TrainFront    },
  { id: 'more',    label: '더보기', Icon: MoreHorizontal },
]

const DEFAULT_CENTER = { lat: 37.3400, lng: 126.7335 }

export default function MobileTabBar() {
  const activeTab       = useAppStore((s) => s.activeTab)
  const setActiveTab    = useAppStore((s) => s.setActiveTab)
  const sheetOpen       = useAppStore((s) => s.sheetOpen)
  const tabBadges       = useAppStore((s) => s.tabBadges)
  const userLocation    = useAppStore((s) => s.userLocation)
  const setMapPanTarget = useAppStore((s) => s.setMapPanTarget)

  const showMap = activeTab === 'main' && !sheetOpen

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
        transition-all duration-300 ease-out
        ${sheetOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
      style={{ bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))' }}
    >
      {/* 내 위치 버튼 */}
      <button
        aria-label="내 위치로 이동"
        disabled={!userLocation}
        onClick={() => setMapPanTarget({ lat: userLocation.lat, lng: userLocation.lng })}
        className={`w-10 h-10 rounded-full
          bg-white/90 dark:bg-slate-700/90 backdrop-blur-md shadow-lg
          flex items-center justify-center pressable transition-all duration-200
          text-navy dark:text-blue-300
          ${showMap && userLocation
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 pointer-events-none'
          }`}
      >
        <Locate size={18} strokeWidth={2} />
      </button>

      {/* 독 */}
      <nav className="flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-full px-2 py-2 shadow-2xl shadow-black/20 border border-slate-100/80 dark:border-slate-700/80">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          const hasBadge = tabBadges?.[id] === true
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all pressable
                ${active
                  ? 'bg-navy text-white shadow-md'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
            >
              <Icon size={24} strokeWidth={active ? 2.2 : 1.8} />
              {hasBadge && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white dark:border-slate-800" />
              )}
            </button>
          )
        })}
      </nav>

      {/* 학교 버튼 */}
      <button
        aria-label="학교로 이동"
        onClick={() => setMapPanTarget(DEFAULT_CENTER)}
        className={`w-10 h-10 rounded-full
          bg-white/90 dark:bg-slate-700/90 backdrop-blur-md shadow-lg
          flex items-center justify-center pressable transition-all duration-200
          text-navy dark:text-blue-300
          ${showMap
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 pointer-events-none'
          }`}
      >
        <School size={18} strokeWidth={2} />
      </button>
    </div>
  )
}
```

- [ ] **Step 3: `PCNavbar.jsx` — 탭 목록 변경**

```jsx
// frontend/src/components/layout/PCNavbar.jsx
import { Map, Bus, TrainFront, MoreHorizontal, Moon, Sun } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '메인 지도', Icon: Map           },
  { id: 'transit', label: '교통',     Icon: Bus           },
  { id: 'subway',  label: '지하철',   Icon: TrainFront    },
  { id: 'more',    label: '더보기',   Icon: MoreHorizontal },
]

export default function PCNavbar() {
  const activeTab      = useAppStore((s) => s.activeTab)
  const setActiveTab   = useAppStore((s) => s.setActiveTab)
  const darkMode       = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  return (
    <header className="flex items-center gap-6 bg-navy text-white px-6 h-14 shrink-0">
      <div className="flex flex-col leading-tight mr-4">
        <span className="font-a2z text-xl font-bold">탈정왕</span>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 px-4 h-14 text-sm font-medium border-b-2 transition-colors
                ${active
                  ? 'text-white border-accent'
                  : 'text-white/55 border-transparent hover:text-white/80'
                }`}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>
      <div className="flex-1" />
      <button
        aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        onClick={toggleDarkMode}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all pressable
          bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
      >
        {darkMode
          ? <Sun  size={16} strokeWidth={2} className="text-yellow-300" />
          : <Moon size={16} strokeWidth={2} />
        }
      </button>
    </header>
  )
}
```

- [ ] **Step 4: `PCSidebar.jsx` — 탭 목록 변경**

```jsx
// frontend/src/components/layout/PCSidebar.jsx
import { Map, Bus, TrainFront, MoreHorizontal } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

const TABS = [
  { id: 'main',    label: '메인 지도', Icon: Map           },
  { id: 'transit', label: '교통',     Icon: Bus           },
  { id: 'subway',  label: '지하철',   Icon: TrainFront    },
  { id: 'more',    label: '더보기',   Icon: MoreHorizontal },
]

export default function PCSidebar() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <aside
      className="flex flex-col bg-navy text-white"
      style={{ width: 240, minHeight: '100vh' }}
    >
      <div className="px-5 py-5 border-b border-white/10">
        <div className="font-a2z text-2xl font-bold leading-tight">탈정왕</div>
      </div>
      <nav className="flex-1 py-3">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-3 px-5 py-3 text-base font-medium
                border-r-4 transition-colors
                ${active
                  ? 'bg-white/10 text-white border-accent'
                  : 'text-white/55 border-transparent hover:bg-white/5'
                }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 5: `App.jsx` — 탭 라우팅 업데이트**

`shuttle` / `bus`를 `transit`으로, `more` 추가. TransitTab / MoreTab은 아직 없으니 플레이스홀더로.

```jsx
// frontend/src/App.jsx
import { useEffect } from 'react'
import useAppStore from './stores/useAppStore'
import MobileTabBar from './components/layout/MobileTabBar'
import PCNavbar from './components/layout/PCNavbar'
import MainTab from './components/map/MainTab'
import SubwayTab from './components/subway/SubwayTab'

// TODO: Task 4에서 실제 컴포넌트로 교체
function TransitTabPlaceholder() {
  return <div className="flex-1 flex items-center justify-center text-slate-400">교통 탭 구현 중</div>
}
function MoreTabPlaceholder() {
  return <div className="flex-1 flex items-center justify-center text-slate-400">더보기 탭 구현 중</div>
}

const VALID_TABS = ['main', 'transit', 'subway', 'more']

function hashToTab(hash) {
  const id = hash.replace(/^#\/?/, '') || 'main'
  return VALID_TABS.includes(id) ? id : 'main'
}

export default function App() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const darkMode     = useAppStore((s) => s.darkMode)

  useEffect(() => {
    const initial = hashToTab(window.location.hash)
    if (initial !== activeTab) setActiveTab(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = () => setActiveTab(hashToTab(window.location.hash))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setActiveTab])

  useEffect(() => {
    const current = hashToTab(window.location.hash)
    if (current !== activeTab) {
      history.pushState(null, '', `#${activeTab}`)
    }
  }, [activeTab])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="flex flex-col h-dvh bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="hidden md:block">
        <PCNavbar />
      </div>
      <main className="flex-1 overflow-hidden min-h-0">
        <div className={`h-full ${activeTab === 'main' ? '' : 'hidden'}`}>
          <MainTab />
        </div>
        {activeTab === 'transit' && (
          <div key="transit" className="h-full overflow-hidden animate-fade-in">
            <TransitTabPlaceholder />
          </div>
        )}
        {activeTab === 'subway' && (
          <div key="subway" className="h-full overflow-hidden animate-fade-in">
            <SubwayTab />
          </div>
        )}
        {activeTab === 'more' && (
          <div key="more" className="h-full overflow-hidden animate-fade-in">
            <MoreTabPlaceholder />
          </div>
        )}
      </main>
      <div className="md:hidden">
        <MobileTabBar />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 개발 서버 실행 후 탭 전환 확인**

```bash
cd frontend && npm run dev
```

브라우저에서 탭 4개(지도/교통/지하철/더보기)가 보이고 전환되는지, hash URL이 바뀌는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/stores/useAppStore.js \
        frontend/src/components/layout/MobileTabBar.jsx \
        frontend/src/components/layout/PCNavbar.jsx \
        frontend/src/components/layout/PCSidebar.jsx \
        frontend/src/App.jsx
git commit -m "feat(frontend): restructure tabs to transit+more"
```

---

## Task 3: 백엔드 — More API 엔드포인트 + Admin CRUD

**담당:** backend 에이전트  
**Task 1 완료 후 실행**

**Files:**
- Create: `backend/app/schemas/more.py`
- Create: `backend/app/services/more.py`
- Create: `backend/app/api/more.py`
- Modify: `backend/app/api/admin.py`
- Modify: `backend/app/main.py`

---

- [ ] **Step 1: `backend/app/schemas/more.py` 작성**

```python
from datetime import datetime
from pydantic import BaseModel, HttpUrl


class NoticeOut(BaseModel):
    id: int
    title: str
    content: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NoticeCreate(BaseModel):
    title: str
    content: str | None = None
    is_active: bool = True


class NoticeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    is_active: bool | None = None


class AppLinkOut(BaseModel):
    id: int
    icon: str
    label: str
    url: str
    sort_order: int

    model_config = {"from_attributes": True}


class AppLinkCreate(BaseModel):
    icon: str
    label: str
    url: str
    sort_order: int = 0
    is_active: bool = True


class AppLinkUpdate(BaseModel):
    icon: str | None = None
    label: str | None = None
    url: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class AppInfoOut(BaseModel):
    version: str
    description: str | None
    feedback_url: str | None

    model_config = {"from_attributes": True}


class AppInfoUpdate(BaseModel):
    version: str | None = None
    description: str | None = None
    feedback_url: str | None = None
```

- [ ] **Step 2: `backend/app/services/more.py` 작성**

Redis 캐싱 패턴은 `cache.py`의 `get_cached_json` / `set_cached_json` 그대로 사용.

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json
from app.models.more import AppInfo, AppLink, Notice

_TTL_NOTICES = 300   # 5분
_TTL_LINKS   = 3600  # 1시간
_TTL_INFO    = 3600  # 1시간


async def get_notices(db: AsyncSession) -> list[dict]:
    cached = await get_cached_json("more:notices")
    if cached is not None:
        return cached

    rows = await db.execute(
        select(Notice)
        .where(Notice.is_active == True)  # noqa: E712
        .order_by(Notice.created_at.desc())
    )
    notices = rows.scalars().all()
    data = [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "created_at": n.created_at.isoformat(),
        }
        for n in notices
    ]
    await set_cached_json("more:notices", data, _TTL_NOTICES)
    return data


async def get_links(db: AsyncSession) -> list[dict]:
    cached = await get_cached_json("more:links")
    if cached is not None:
        return cached

    rows = await db.execute(
        select(AppLink)
        .where(AppLink.is_active == True)  # noqa: E712
        .order_by(AppLink.sort_order)
    )
    links = rows.scalars().all()
    data = [
        {"id": lnk.id, "icon": lnk.icon, "label": lnk.label, "url": lnk.url, "sort_order": lnk.sort_order}
        for lnk in links
    ]
    await set_cached_json("more:links", data, _TTL_LINKS)
    return data


async def get_info(db: AsyncSession) -> dict | None:
    cached = await get_cached_json("more:info")
    if cached is not None:
        return cached

    row = await db.get(AppInfo, 1)
    if not row:
        return None
    data = {
        "version": row.version,
        "description": row.description,
        "feedback_url": row.feedback_url,
    }
    await set_cached_json("more:info", data, _TTL_INFO)
    return data


async def invalidate_notices(redis=None) -> None:
    from app.core.cache import get_redis
    r = redis or await get_redis()
    await r.delete("more:notices")


async def invalidate_links(redis=None) -> None:
    from app.core.cache import get_redis
    r = redis or await get_redis()
    await r.delete("more:links")


async def invalidate_info(redis=None) -> None:
    from app.core.cache import get_redis
    r = redis or await get_redis()
    await r.delete("more:info")
```

- [ ] **Step 3: `backend/app/api/more.py` 작성**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.services.more import get_info, get_links, get_notices

router = APIRouter(prefix="/api/v1/more", tags=["more"])


@router.get("/notices")
async def notices(db: AsyncSession = Depends(get_db)):
    data = await get_notices(db)
    return ApiResponse.ok(data)


@router.get("/links")
async def links(db: AsyncSession = Depends(get_db)):
    data = await get_links(db)
    return ApiResponse.ok(data)


@router.get("/info")
async def info(db: AsyncSession = Depends(get_db)):
    data = await get_info(db)
    if data is None:
        return ApiResponse.fail("NOT_FOUND", "앱 정보가 없습니다.")
    return ApiResponse.ok(data)
```

- [ ] **Step 4: `backend/app/api/admin.py` 하단에 Notice / AppLink / AppInfo CRUD 추가**

파일 맨 끝에 아래 코드를 추가한다.

```python
# ── More 관리 ─────────────────────────────────────────────────
from app.models.more import AppInfo as AppInfoModel
from app.models.more import AppLink as AppLinkModel
from app.models.more import Notice as NoticeModel
from app.schemas.more import (
    AppInfoOut, AppInfoUpdate,
    AppLinkCreate, AppLinkOut, AppLinkUpdate,
    NoticeCreate, NoticeOut, NoticeUpdate,
)
from app.services.more import invalidate_info, invalidate_links, invalidate_notices


# ── 공지사항 ──────────────────────────────────────────────────

@router.get("/notices", response_model=ApiResponse[list[NoticeOut]])
async def admin_list_notices(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    rows = await db.execute(select(NoticeModel).order_by(NoticeModel.created_at.desc()))
    return ApiResponse.ok(rows.scalars().all())


@router.post("/notices", response_model=ApiResponse[NoticeOut])
async def admin_create_notice(
    body: NoticeCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    notice = NoticeModel(**body.model_dump())
    db.add(notice)
    await db.commit()
    await db.refresh(notice)
    await invalidate_notices()
    return ApiResponse.ok(notice)


@router.patch("/notices/{notice_id}", response_model=ApiResponse[NoticeOut])
async def admin_update_notice(
    notice_id: int,
    body: NoticeUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    notice = await db.get(NoticeModel, notice_id)
    if not notice:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(notice, field, value)
    await db.commit()
    await db.refresh(notice)
    await invalidate_notices()
    return ApiResponse.ok(notice)


@router.delete("/notices/{notice_id}", response_model=ApiResponse[dict])
async def admin_delete_notice(
    notice_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    notice = await db.get(NoticeModel, notice_id)
    if not notice:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    await db.delete(notice)
    await db.commit()
    await invalidate_notices()
    return ApiResponse.ok({"deleted": notice_id})


# ── 유용한 링크 ───────────────────────────────────────────────

@router.get("/links", response_model=ApiResponse[list[AppLinkOut]])
async def admin_list_links(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    rows = await db.execute(select(AppLinkModel).order_by(AppLinkModel.sort_order))
    return ApiResponse.ok(rows.scalars().all())


@router.post("/links", response_model=ApiResponse[AppLinkOut])
async def admin_create_link(
    body: AppLinkCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    link = AppLinkModel(**body.model_dump())
    db.add(link)
    await db.commit()
    await db.refresh(link)
    await invalidate_links()
    return ApiResponse.ok(link)


@router.patch("/links/{link_id}", response_model=ApiResponse[AppLinkOut])
async def admin_update_link(
    link_id: int,
    body: AppLinkUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    link = await db.get(AppLinkModel, link_id)
    if not link:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="링크를 찾을 수 없습니다.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(link, field, value)
    await db.commit()
    await db.refresh(link)
    await invalidate_links()
    return ApiResponse.ok(link)


@router.delete("/links/{link_id}", response_model=ApiResponse[dict])
async def admin_delete_link(
    link_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    link = await db.get(AppLinkModel, link_id)
    if not link:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="링크를 찾을 수 없습니다.")
    await db.delete(link)
    await db.commit()
    await invalidate_links()
    return ApiResponse.ok({"deleted": link_id})


# ── 앱 정보 ───────────────────────────────────────────────────

@router.get("/info", response_model=ApiResponse[AppInfoOut])
async def admin_get_info(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    info = await db.get(AppInfoModel, 1)
    if not info:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="앱 정보가 없습니다.")
    return ApiResponse.ok(info)


@router.patch("/info", response_model=ApiResponse[AppInfoOut])
async def admin_update_info(
    body: AppInfoUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    verify_token(credentials.credentials)
    info = await db.get(AppInfoModel, 1)
    if not info:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="앱 정보가 없습니다.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(info, field, value)
    await db.commit()
    await db.refresh(info)
    await invalidate_info()
    return ApiResponse.ok(info)
```

- [ ] **Step 5: `backend/app/main.py`에 more 라우터 등록**

`from app.api import ...` 줄에 `more` 추가하고 `app.include_router(more.router)` 추가.

```python
from app.api import admin, bus, dashboard, map, more, recommend, route, shuttle, subway, traffic
# ... (나머지 동일)
app.include_router(more.router)
```

- [ ] **Step 6: 백엔드 재시작 후 엔드포인트 확인**

```bash
curl -s http://localhost:8000/api/v1/more/notices | python3 -m json.tool
curl -s http://localhost:8000/api/v1/more/links | python3 -m json.tool
curl -s http://localhost:8000/api/v1/more/info | python3 -m json.tool
```

세 응답 모두 `"success": true` 포함.

- [ ] **Step 7: 커밋**

```bash
git add backend/app/schemas/more.py \
        backend/app/services/more.py \
        backend/app/api/more.py \
        backend/app/api/admin.py \
        backend/app/main.py
git commit -m "feat(backend): add more tab API and admin CRUD"
```

---

## Task 4: 프론트엔드 — TransitTab + BottomSheet

**담당:** frontend 에이전트  
**Task 2 완료 후 실행 (Task 3과 병렬 가능)**

**Files:**
- Create: `frontend/src/components/transit/BottomSheet.jsx`
- Create: `frontend/src/components/transit/ShuttleCard.jsx`
- Create: `frontend/src/components/transit/BusCard.jsx`
- Create: `frontend/src/components/transit/ShuttleSheetContent.jsx`
- Create: `frontend/src/components/transit/BusStationSheetContent.jsx`
- Create: `frontend/src/components/transit/TransitTab.jsx`
- Modify: `frontend/src/App.jsx`

---

- [ ] **Step 1: `BottomSheet.jsx` 작성 — 공통 바텀 시트 컴포넌트**

```jsx
// frontend/src/components/transit/BottomSheet.jsx
import { useEffect } from 'react'

/**
 * 공통 바텀 시트
 * @param {boolean} open - 시트 열림 여부
 * @param {() => void} onClose - 닫기 콜백
 * @param {string} title - 시트 헤더 제목
 * @param {React.ReactNode} children - 시트 내부 콘텐츠
 */
export default function BottomSheet({ open, onClose, title, children }) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 딤 배경 */}
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 시트 본체 — 화면 높이의 65% */}
      <div
        className="relative flex flex-col bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl animate-slide-up"
        style={{ height: '65vh' }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-navy dark:text-blue-300">{title}</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
```

`animate-slide-up`이 없으면 `frontend/src/index.css` 또는 `tailwind.config.js`에 추가한다. Tailwind 설정에 커스텀 애니메이션이 없다면 인라인 style로 대체:

```jsx
// animate-slide-up 대신 아래처럼 사용 가능
style={{ height: '65vh', animation: 'slideUp 0.25s ease-out' }}
```

그리고 전역 CSS에 키프레임 추가:
```css
/* frontend/src/index.css에 추가 */
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

- [ ] **Step 2: `ShuttleSheetContent.jsx` 작성 — 시트 내 셔틀 시간표**

기존 `ShuttleTimetable.jsx`를 그대로 재사용.

```jsx
// frontend/src/components/transit/ShuttleSheetContent.jsx
import { useState } from 'react'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import ShuttleTimetable from '../shuttle/ShuttleTimetable'

// DB route_name → 표시 이름
const DIRECTION_LABEL = {
  '정왕역행 (하교)': '📍 정왕역',
  '학교행 (등교)':   '🏫 학교',
  '정왕역방면':      '📍 정왕역',
  '정왕역→학교':    '🏫 학교',
  '하교 (정왕역행)': '📍 정왕역',
  '등교 (학교행)':   '🏫 학교',
}

function dirLabel(name) {
  return DIRECTION_LABEL[name] ?? name
}

export default function ShuttleSheetContent() {
  const { data: schedule, loading } = useShuttleSchedule()
  const directions = schedule?.directions ?? []
  const [activeDir, setActiveDir] = useState(null)

  const currentDirKey = activeDir ?? directions[0]?.direction ?? null
  const currentDir = directions.find((d) => d.direction === currentDirKey)
  const timeObjs = currentDir?.times ?? []

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 방면 서브탭 */}
      {directions.length > 0 && (
        <div className="flex border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          {directions.map(({ direction }) => {
            const active = direction === currentDirKey
            return (
              <button
                key={direction}
                onClick={() => setActiveDir(direction)}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors
                  ${active
                    ? 'text-navy dark:text-blue-400 border-navy dark:border-blue-400'
                    : 'text-slate-500 dark:text-slate-400 border-transparent'}`}
              >
                {dirLabel(direction)}
              </button>
            )
          })}
        </div>
      )}

      {/* 시간표 — 기존 컴포넌트 재사용 */}
      <ShuttleTimetable times={timeObjs} />
    </div>
  )
}
```

- [ ] **Step 3: `BusStationSheetContent.jsx` 작성 — 시트 내 정류장 선택**

```jsx
// frontend/src/components/transit/BusStationSheetContent.jsx
export default function BusStationSheetContent({ stations, selectedId, onSelect }) {
  return (
    <ul className="overflow-y-auto h-full">
      {stations.map((station) => {
        const isSelected = station.station_id === selectedId
        return (
          <li key={station.station_id}>
            <button
              onClick={() => onSelect(station.station_id)}
              className={`flex w-full items-center justify-between px-5 py-4
                border-b border-slate-100 dark:border-slate-800 text-left
                border-l-4 transition-colors
                ${isSelected
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-l-navy'
                  : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              <div>
                <p className={`font-semibold text-base ${isSelected ? 'text-navy dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  {station.name}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {station.routes.map((r) => r.route_name ?? r).join(' · ')}
                </p>
              </div>
              {isSelected && (
                <span className="text-xs font-bold text-navy dark:text-blue-400 border border-navy dark:border-blue-400 rounded px-2 py-1">
                  선택됨
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 4: `ShuttleCard.jsx` 작성**

```jsx
// frontend/src/components/transit/ShuttleCard.jsx
import { useState, useEffect } from 'react'
import { Bus } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'

// DB route_name → 표시 방향 키
const DIR_KEY = {
  '정왕역행 (하교)': 'station',
  '학교행 (등교)':   'school',
  '정왕역방면':      'station',
  '정왕역→학교':    'school',
  '하교 (정왕역행)': 'station',
  '등교 (학교행)':   'school',
}

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function findNextTwo(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const upcoming = times.filter((t) => toMin(t.depart_at) > nowMin)
  return [upcoming[0] ?? null, upcoming[1] ?? null]
}

export default function ShuttleCard({ onOpenSheet }) {
  const { data: schedule, loading } = useShuttleSchedule()
  const [tick, setTick] = useState(0)

  // 1분마다 다음 셔틀 재계산
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  void tick

  const directions = schedule?.directions ?? []

  // 방면별 다음/다다음 계산
  const info = { station: [null, null], school: [null, null] }
  for (const dir of directions) {
    const key = DIR_KEY[dir.direction]
    if (key) {
      info[key] = findNextTwo(dir.times ?? [])
    }
  }

  function TimeCell({ label, emoji, pair }) {
    const [next, afterNext] = pair
    return (
      <div className="p-3">
        <p className="text-xs font-bold text-slate-400 mb-1.5">{emoji} {label}</p>
        {next ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[17px] font-extrabold text-navy dark:text-blue-300 tabular-nums">
                {next.depart_at}
              </span>
              <span className="text-[10px] font-bold text-white bg-navy dark:bg-blue-600 rounded px-1.5 py-0.5">
                다음
              </span>
            </div>
            {afterNext && (
              <p className="text-xs text-slate-400 mt-1">다다음 {afterNext.depart_at}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-1">운행 종료</p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Bus size={16} strokeWidth={2} className="text-navy dark:text-blue-400" />
          <span className="text-sm font-bold text-navy dark:text-blue-300">셔틀버스</span>
          {schedule && (
            <span className="text-xs text-slate-400">{schedule.schedule_name}</span>
          )}
        </div>
        <button
          onClick={onOpenSheet}
          className="text-xs text-blue-500 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          시간표 전체보기 ›
        </button>
      </div>

      {/* 2×2 그리드 */}
      {loading ? (
        <div className="py-6 text-center text-slate-400 text-sm">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700">
          <TimeCell label="정왕역" emoji="📍" pair={info.station} />
          <TimeCell label="학교" emoji="🏫" pair={info.school} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: `BusCard.jsx` 작성**

```jsx
// frontend/src/components/transit/BusCard.jsx
import { useState, useEffect, useMemo } from 'react'
import { BusFront, RefreshCw } from 'lucide-react'
import { useBusStations, useBusArrivals } from '../../hooks/useBus'
import ArrivalList from '../bus/ArrivalList'

export default function BusCard({ onOpenStationSheet, timetableRoute, setTimetableRoute }) {
  const { data: stationsData, loading: stationsLoading } = useBusStations()
  const stations = stationsData ?? []
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!selectedId && stations.length > 0) {
      setSelectedId(stations[0].station_id)
    }
  }, [selectedId, stations])

  const { data: arrivals, loading: arrivalsLoading, fetchedAt, refetch } = useBusArrivals(selectedId)

  const adjustedArrivals = useMemo(() => {
    if (!arrivals?.arrivals || !fetchedAt) return arrivals
    const elapsedSec = (Date.now() - fetchedAt) / 1000
    return {
      ...arrivals,
      arrivals: arrivals.arrivals.map((a) =>
        a.arrival_type === 'realtime'
          ? { ...a, arrive_in_seconds: Math.max(0, a.arrive_in_seconds - elapsedSec) }
          : a
      ),
    }
  }, [arrivals, fetchedAt])

  const timeStr = arrivals?.updated_at
    ? new Date(arrivals.updated_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--'

  const selectedStation = stations.find((s) => s.station_id === selectedId)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <BusFront size={16} strokeWidth={2} className="text-navy dark:text-blue-400" />
          <span className="text-sm font-bold text-navy dark:text-blue-300">공공버스</span>
          <span className="text-xs text-slate-400">갱신 {timeStr}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} aria-label="새로고침" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <RefreshCw size={13} />
          </button>
          <button
            onClick={onOpenStationSheet}
            className="text-xs text-blue-500 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            정류장 변경 ›
          </button>
        </div>
      </div>

      {/* 선택된 정류장 칩 */}
      {!stationsLoading && selectedStation && (
        <div className="flex gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-700 overflow-x-auto scrollbar-hide">
          {stations.map((s) => (
            <button
              key={s.station_id}
              onClick={() => setSelectedId(s.station_id)}
              className={`flex-shrink-0 text-xs font-semibold rounded-full px-3 py-1 transition-colors
                ${s.station_id === selectedId
                  ? 'bg-navy text-white dark:bg-blue-600'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* 도착 정보 리스트 */}
      {arrivalsLoading ? (
        <div className="py-6 text-center text-slate-400 text-sm">도착 정보 불러오는 중...</div>
      ) : (
        <ArrivalList
          arrivals={adjustedArrivals?.arrivals ?? []}
          onTimetableClick={(routeId, routeNo) => setTimetableRoute({ routeId, routeNo })}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: `TransitTab.jsx` 작성 — 전체 조합**

```jsx
// frontend/src/components/transit/TransitTab.jsx
import { useState } from 'react'
import ShuttleCard from './ShuttleCard'
import BusCard from './BusCard'
import BottomSheet from './BottomSheet'
import ShuttleSheetContent from './ShuttleSheetContent'
import BusStationSheetContent from './BusStationSheetContent'
import BusTimetableDetail from '../bus/BusTimetableDetail'
import { useBusStations } from '../../hooks/useBus'

export default function TransitTab() {
  const [shuttleSheetOpen, setShuttleSheetOpen] = useState(false)
  const [stationSheetOpen, setStationSheetOpen] = useState(false)
  const [timetableRoute, setTimetableRoute] = useState(null) // { routeId, routeNo }

  const { data: stationsData } = useBusStations()
  const stations = stationsData ?? []
  const [selectedStationId, setSelectedStationId] = useState(null)

  // 시간표 상세 뷰 (BusTimetableDetail은 기존 push 방식 유지)
  if (timetableRoute) {
    return (
      <BusTimetableDetail
        routeId={timetableRoute.routeId}
        routeNo={timetableRoute.routeNo}
        onBack={() => setTimetableRoute(null)}
      />
    )
  }

  function handleStationSelect(id) {
    setSelectedStationId(id)
    setStationSheetOpen(false)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6 flex flex-col gap-4">
        <ShuttleCard onOpenSheet={() => setShuttleSheetOpen(true)} />
        <BusCard
          onOpenStationSheet={() => setStationSheetOpen(true)}
          timetableRoute={timetableRoute}
          setTimetableRoute={setTimetableRoute}
        />
      </div>

      {/* 셔틀 시간표 시트 */}
      <BottomSheet
        open={shuttleSheetOpen}
        onClose={() => setShuttleSheetOpen(false)}
        title="셔틀버스 시간표"
      >
        <ShuttleSheetContent />
      </BottomSheet>

      {/* 정류장 선택 시트 */}
      <BottomSheet
        open={stationSheetOpen}
        onClose={() => setStationSheetOpen(false)}
        title="정류장 선택"
      >
        <BusStationSheetContent
          stations={stations}
          selectedId={selectedStationId}
          onSelect={handleStationSelect}
        />
      </BottomSheet>
    </div>
  )
}
```

- [ ] **Step 7: `App.jsx`에 TransitTab 연결 (플레이스홀더 교체)**

```jsx
// App.jsx 상단 import 추가
import TransitTab from './components/transit/TransitTab'

// TransitTabPlaceholder 함수 제거 후, transit 탭 렌더링 부분 교체:
{activeTab === 'transit' && (
  <div key="transit" className="h-full overflow-hidden animate-fade-in">
    <TransitTab />
  </div>
)}
```

- [ ] **Step 8: 개발 서버에서 교통 탭 확인**

```bash
cd frontend && npm run dev
```

확인 항목:
- 셔틀 카드: 2×2 그리드, 정왕역/학교 레이블, 다음/다다음 시간 표시
- "시간표 전체보기 ›" → 바텀 시트 오픈, 65% 높이, 정왕역/학교 서브탭, 시간표 목록
- "정류장 변경 ›" → 바텀 시트 오픈, 정류장 목록, 선택 후 시트 닫힘 + 카드 업데이트
- 버스 카드: 정류장 칩, 도착 정보, 새로고침 버튼
- 딤 클릭 / ESC → 시트 닫힘

- [ ] **Step 9: 커밋**

```bash
git add frontend/src/components/transit/ frontend/src/App.jsx
git commit -m "feat(frontend): add TransitTab with ShuttleCard, BusCard, BottomSheet"
```

---

## Task 5: 프론트엔드 — MoreTab

**담당:** frontend 에이전트  
**Task 2 완료 후 실행 (Task 3·4와 병렬 가능)**

**Files:**
- Create: `frontend/src/hooks/useMore.js`
- Create: `frontend/src/hooks/useShuttleNotification.js`
- Create: `frontend/src/components/more/MoreTab.jsx`
- Modify: `frontend/src/App.jsx`

---

- [ ] **Step 1: `useMore.js` 작성**

```js
// frontend/src/hooks/useMore.js
import { useApi } from './useApi'

export function useNotices() {
  return useApi('/more/notices', { interval: 300_000 })   // 5분 폴링
}

export function useLinks() {
  return useApi('/more/links', { interval: 3_600_000 })   // 1시간 폴링
}

export function useAppInfo() {
  return useApi('/more/info', { interval: 3_600_000 })
}
```

- [ ] **Step 2: `useShuttleNotification.js` 작성**

```js
// frontend/src/hooks/useShuttleNotification.js
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'shuttle_notification_enabled'
const NOTIFY_BEFORE_MIN = 10   // 출발 10분 전

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * 셔틀 출발 알림 훅
 * @param {Array} timeObjs - 셔틀 시간 객체 배열 [{ depart_at: "HH:MM", ... }]
 */
export function useShuttleNotification(timeObjs = []) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  )
  const [permission, setPermission] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  )

  const toggle = useCallback(async () => {
    if (!enabled) {
      // 활성화 시도
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

  // 매분 체크: 다음 셔틀이 10분 후면 알림 발송
  useEffect(() => {
    if (!enabled || permission !== 'granted' || timeObjs.length === 0) return

    const check = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const next = timeObjs.find((t) => toMin(t.depart_at) > nowMin)
      if (!next) return

      const diff = toMin(next.depart_at) - nowMin
      if (diff === NOTIFY_BEFORE_MIN) {
        new Notification('🚌 셔틀 출발 알림', {
          body: `${next.depart_at} 셔틀이 ${NOTIFY_BEFORE_MIN}분 후 출발합니다.`,
          icon: '/favicon.ico',
        })
      }
    }

    check()  // 마운트 즉시 1회
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [enabled, permission, timeObjs])

  return { enabled, permission, toggle }
}
```

- [ ] **Step 3: `MoreTab.jsx` 작성**

```jsx
// frontend/src/components/more/MoreTab.jsx
import { useNotices, useLinks, useAppInfo } from '../../hooks/useMore'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useShuttleNotification } from '../../hooks/useShuttleNotification'
import useAppStore from '../../stores/useAppStore'

function SectionLabel({ children }) {
  return (
    <p className="px-1 py-2 text-xs font-bold text-slate-400 tracking-widest uppercase">
      {children}
    </p>
  )
}

function Card({ children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
      {children}
    </div>
  )
}

function Row({ icon, label, sub, right, onClick, href }) {
  const Inner = (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="text-xl w-7 text-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  )

  const cls = 'block w-full text-left border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50'

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{Inner}</a>
  }
  if (onClick) {
    return <button onClick={onClick} className={cls}>{Inner}</button>
  }
  return <div className={cls}>{Inner}</div>
}

export default function MoreTab() {
  const { data: noticesData, loading: noticesLoading } = useNotices()
  const { data: linksData, loading: linksLoading } = useLinks()
  const { data: infoData } = useAppInfo()

  // 셔틀 알림용 시간 데이터 (첫 번째 방면)
  const { data: schedule } = useShuttleSchedule()
  const firstDirTimes = schedule?.directions?.[0]?.times ?? []
  const { enabled: notifEnabled, permission, toggle: toggleNotif } = useShuttleNotification(firstDirTimes)

  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)

  const notices = noticesData ?? []
  const links = linksData ?? []

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 px-4 py-4 pb-28 md:pb-6 gap-1">

      {/* 공지사항 */}
      <SectionLabel>공지사항</SectionLabel>
      <Card>
        {noticesLoading ? (
          <div className="py-6 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">공지사항이 없습니다.</div>
        ) : (
          notices.map((n) => (
            <Row
              key={n.id}
              icon="📢"
              label={n.title}
              sub={new Date(n.created_at).toLocaleDateString('ko-KR')}
            />
          ))
        )}
      </Card>

      {/* 알림 */}
      <SectionLabel>알림</SectionLabel>
      <Card>
        <Row
          icon="🔔"
          label="셔틀 출발 알림"
          sub={
            permission === 'denied'
              ? '브라우저 알림이 차단되어 있습니다'
              : `다음 셔틀 ${10}분 전 알림`
          }
          right={
            <div
              className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${
                notifEnabled ? 'bg-navy dark:bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                notifEnabled ? 'right-1' : 'left-1'
              }`} />
            </div>
          }
          onClick={toggleNotif}
        />
      </Card>

      {/* 유용한 링크 */}
      <SectionLabel>유용한 링크</SectionLabel>
      <Card>
        {linksLoading ? (
          <div className="py-6 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : links.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">링크가 없습니다.</div>
        ) : (
          links.map((lnk) => (
            <Row
              key={lnk.id}
              icon={lnk.icon}
              label={lnk.label}
              href={lnk.url}
              right={<span className="text-slate-300 dark:text-slate-500 ml-2">↗</span>}
            />
          ))
        )}
      </Card>

      {/* 앱 정보 */}
      <SectionLabel>앱 정보</SectionLabel>
      <Card>
        <Row
          icon="ℹ️"
          label="탈정왕"
          sub={infoData ? `v${infoData.version} · ${infoData.description ?? '정왕 교통 허브'}` : '정왕 교통 허브'}
        />
        {infoData?.feedback_url && (
          <Row icon="💬" label="피드백 보내기" href={infoData.feedback_url} right={<span className="text-slate-300 dark:text-slate-500">↗</span>} />
        )}
      </Card>

      {/* 다크모드 */}
      <SectionLabel>디스플레이</SectionLabel>
      <Card>
        <Row
          icon={darkMode ? '🌙' : '☀️'}
          label="다크모드"
          sub={darkMode ? '켜짐' : '꺼짐'}
          onClick={toggleDarkMode}
          right={
            <div className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${
              darkMode ? 'bg-navy dark:bg-blue-600' : 'bg-slate-200'
            }`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                darkMode ? 'right-1' : 'left-1'
              }`} />
            </div>
          }
        />
      </Card>

    </div>
  )
}
```

- [ ] **Step 4: `App.jsx`에 MoreTab 연결**

```jsx
// App.jsx 상단 import 추가
import MoreTab from './components/more/MoreTab'

// MoreTabPlaceholder 함수 제거 후 교체:
{activeTab === 'more' && (
  <div key="more" className="h-full overflow-hidden animate-fade-in">
    <MoreTab />
  </div>
)}
```

- [ ] **Step 5: 더보기 탭 확인**

브라우저에서 더보기 탭 접근.  
공지 없음 → "공지사항이 없습니다." 메시지 확인.  
링크 없음 → "링크가 없습니다." 메시지 확인.  
셔틀 알림 토글 클릭 → 브라우저 권한 요청 팝업 (또는 이미 허용됨).  
다크모드 토글 → 즉시 반영.

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/hooks/useMore.js \
        frontend/src/hooks/useShuttleNotification.js \
        frontend/src/components/more/ \
        frontend/src/App.jsx
git commit -m "feat(frontend): add MoreTab with notices, links, notification, dark mode"
```

---

## Task 6: 통합 검증 + 더보기 탭 배지

**담당:** frontend 에이전트  
**Task 3·4·5 모두 완료 후 실행**

**Files:**
- Modify: `frontend/src/App.jsx` (공지 badge 로직)

---

- [ ] **Step 1: 공지사항 있을 때 `more` 탭 배지 표시**

`useNotices`로 가져온 공지가 1개 이상이면 `tabBadges.more = true`로 설정.  
`App.jsx`에 아래 Effect 추가:

```jsx
// App.jsx에 추가
import { useNotices } from './hooks/useMore'

// App 컴포넌트 내부
const { data: notices } = useNotices()
const setTabBadges = useAppStore((s) => s.setTabBadges)

useEffect(() => {
  setTabBadges({ more: (notices?.length ?? 0) > 0 })
}, [notices, setTabBadges])
```

- [ ] **Step 2: 백엔드에서 테스트 공지 삽입 후 배지 확인**

```bash
# 테스트 공지 삽입
curl -s -X POST http://localhost:8000/api/v1/admin/notices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -d '{"title": "테스트 공지", "content": "배지 확인용입니다."}'
```

브라우저 더보기 탭 아이콘에 빨간 점 배지 표시 확인.

- [ ] **Step 3: 전체 흐름 최종 확인**

| 확인 항목 | 기대 동작 |
|---|---|
| 탭 전환 (지도↔교통↔지하철↔더보기) | 부드러운 전환, URL hash 변경 |
| 교통 탭 - 셔틀 카드 | 정왕역/학교 2×2, 다음/다다음 시간 |
| 교통 탭 - 셔틀 시간표 전체보기 | 바텀 시트 65% 높이, 정왕역/학교 서브탭 |
| 교통 탭 - 정류장 변경 | 바텀 시트, 선택 후 닫힘 |
| 더보기 탭 - 공지 | 공지 목록 표시 |
| 더보기 탭 - 다크모드 | 토글 즉시 반영 |
| 모바일 바텀 독 | 탭 4개, 더보기에 배지 표시 |
| PC 네브바 | 탭 4개 정상 표시 |
| hash 딥링크 (#transit, #more) | 해당 탭으로 이동 |

- [ ] **Step 4: 최종 커밋**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): add notice badge on more tab"
```

---

## 병렬 실행 요약

```
[Task 1: DB 모델] ──┐
                    ├──→ [Task 3: More API]
[Task 2: 레이아웃] ─┤
                    ├──→ [Task 4: TransitTab]
                    └──→ [Task 5: MoreTab]
                              ↓
                         [Task 6: 통합]
```

Task 1 + Task 2 동시 실행 → Task 3·4·5 동시 실행 → Task 6
