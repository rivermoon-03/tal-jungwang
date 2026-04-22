# 지하철 실시간 도착정보 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서울 지하철 실시간 API를 연동해 정왕역 지하철 탭에 실시간/시간표 탭 전환과 승강장 안내판 스타일 UI(디자인 C) + 세로 노선도를 추가한다.

**Architecture:** 백엔드에 `subway_realtime.py` 서비스를 신규 추가해 서울 실시간 API를 파싱·Redis 캐싱하고, APScheduler로 30s/90s 폴링(피크/비피크)을 처리한다. 프론트엔드는 SubwayTab에 실시간/시간표 탭을 추가하고, `SubwayRealtimeBoard`(승강장 안내판 행 레이아웃)와 `SubwayLineMap`(세로 노선도)을 신규 컴포넌트로 만든다.

**Tech Stack:** FastAPI, httpx, xml.etree.ElementTree, APScheduler, Redis, React 18, Tailwind CSS v3, Zustand

---

## 파일 구조

| 파일 | 역할 | 변경 유형 |
|---|---|---|
| `backend/app/core/config.py` | SEOUL_SUBWAY_KEY 환경변수 추가 | 수정 |
| `backend/app/schemas/subway.py` | SubwayRealtimeItem Pydantic 모델 추가 | 수정 |
| `backend/app/services/subway_realtime.py` | 서울 실시간 API 호출·파싱·캐시 | 신규 |
| `backend/app/api/subway.py` | GET /subway/realtime 엔드포인트 추가 | 수정 |
| `backend/app/core/scheduler.py` | 실시간 폴링 job 추가 | 수정 |
| `frontend/src/hooks/useSubway.js` | useSubwayRealtime 훅 추가 | 수정 |
| `frontend/src/components/subway/SubwayRealtimeBoard.jsx` | 승강장 안내판 스타일 실시간 뷰 | 신규 |
| `frontend/src/components/subway/SubwayLineMap.jsx` | 세로 노선도 컴포넌트 | 신규 |
| `frontend/src/components/subway/SubwayTab.jsx` | 실시간/시간표 탭 전환 통합 | 수정 |

---

## Task 1: 백엔드 — Config + Schema

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/schemas/subway.py`

- [ ] **Step 1: config.py에 SEOUL_SUBWAY_KEY 추가**

`backend/app/core/config.py`에서 외부 API 블록에 다음 한 줄 추가:

```python
# ── 외부 API ─────────────────────────────────────────────
KAKAO_MOBILITY_REST_KEY: str = ""
TMAP_APP_KEY: str = ""
DATA_GO_KR_SERVICE_KEY: str = ""
SEOUL_SUBWAY_KEY: str = ""          # ← 추가
```

- [ ] **Step 2: schemas/subway.py에 SubwayRealtimeItem 추가**

`backend/app/schemas/subway.py` 파일 하단에 추가:

```python
class SubwayRealtimeItem(BaseModel):
    line: str          # "4호선" | "수인분당선"
    direction: str     # "상행" | "하행"
    destination: str   # 종착역명 (예: "불암산", "왕십리")
    status_code: int   # arvlCd: 0=진입, 1=도착, 2=출발, 5=전역도착, 99=운행중
    status_msg: str    # 표시용 메시지 (예: "전역 도착", "[4]번째 전역 (소래포구)")
    current_station: str  # arvlMsg3: 현재 열차가 있는 역명
    train_no: str      # btrainNo
    color: str         # 호선 색상 hex
```

- [ ] **Step 3: 커밋**

```bash
git add backend/app/core/config.py backend/app/schemas/subway.py
git commit -m "feat(subway): SEOUL_SUBWAY_KEY config + SubwayRealtimeItem schema"
```

---

## Task 2: 백엔드 — subway_realtime.py 서비스

**Files:**
- Create: `backend/app/services/subway_realtime.py`

- [ ] **Step 1: 파싱 단위 테스트 작성**

`backend/tests/test_subway_realtime.py` 생성:

```python
import pytest
from app.services.subway_realtime import parse_rows

SAMPLE_ROWS = [
    # 4호선 상행 — 진입중 (subwayId 1004)
    {
        "subwayId": "1004",
        "updnLine": "상행",
        "trainLineNm": "불암산행 - 신길온천방면",
        "btrainNo": "4590",
        "bstatnNm": "불암산",
        "arvlMsg2": "전역 도착",
        "arvlMsg3": "오이도",
        "arvlCd": "5",
    },
    # 수인분당선 상행 — 운행중 (subwayId 1075)
    {
        "subwayId": "1075",
        "updnLine": "상행",
        "trainLineNm": "왕십리행 - 신길온천방면",
        "btrainNo": "6542",
        "bstatnNm": "왕십리",
        "arvlMsg2": "[4]번째 전역 (소래포구)",
        "arvlMsg3": "소래포구",
        "arvlCd": "99",
    },
    # 같은 열차 중복 (subwayId 1004, btrainNo 동일) — 제거되어야 함
    {
        "subwayId": "1004",
        "updnLine": "상행",
        "trainLineNm": "왕십리행 - 신길온천방면",
        "btrainNo": "6542",
        "bstatnNm": "왕십리",
        "arvlMsg2": "[4]번째 전역 (소래포구)",
        "arvlMsg3": "소래포구",
        "arvlCd": "99",
    },
    # 4호선 하행
    {
        "subwayId": "1004",
        "updnLine": "하행",
        "trainLineNm": "오이도행 - 오이도방면",
        "btrainNo": "4567",
        "bstatnNm": "오이도",
        "arvlMsg2": "정왕 진입",
        "arvlMsg3": "정왕",
        "arvlCd": "0",
    },
]

def test_parse_deduplicates_by_train_no():
    result = parse_rows(SAMPLE_ROWS)
    train_nos = [item["train_no"] for item in result]
    assert len(train_nos) == len(set(train_nos)), "btrainNo 기준 중복이 제거되어야 함"

def test_parse_line_classification():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    assert by_no["4590"]["line"] == "4호선"
    assert by_no["6542"]["line"] == "수인분당선"

def test_parse_status_code_mapping():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    # arvlCd 5 → 전역 도착
    assert by_no["4590"]["status_code"] == 5
    # arvlCd 0 → 진입
    assert by_no["4567"]["status_code"] == 0

def test_parse_color_by_line():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    assert by_no["4590"]["color"] == "#1B5FAD"
    assert by_no["6542"]["color"] == "#F5A623"

def test_parse_destination():
    result = parse_rows(SAMPLE_ROWS)
    by_no = {item["train_no"]: item for item in result}
    assert by_no["4590"]["destination"] == "불암산"
    assert by_no["6542"]["destination"] == "왕십리"
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd /home/rivermoon/Documents/Github/tal-jungwang/backend
python -m pytest tests/test_subway_realtime.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'app.services.subway_realtime'`

- [ ] **Step 3: subway_realtime.py 구현**

`backend/app/services/subway_realtime.py` 생성:

```python
"""서울 지하철 실시간 도착정보 서비스.

API 한도: 일 1,000회 (정왕역 단일 역)
폴링 전략: 피크(07~09, 17~19) 30초 / 비피크 90초 / 새벽(01~05) OFF
캐시 키: subway:realtime:정왕  TTL: 35초
"""

import time
import xml.etree.ElementTree as ET

import httpx

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.config import settings

_BASE_URL = "http://swopenAPI.seoul.go.kr/api/subway/{key}/xml/realtimeStationArrival/0/20/정왕"
_CACHE_KEY = "subway:realtime:정왕"
_CACHE_TTL = 35
_LAST_FETCH_KEY = "subway:realtime:last_fetch"

_LINE_MAP = {
    "1004": {"line": "4호선", "color": "#1B5FAD"},
    "1075": {"line": "수인분당선", "color": "#F5A623"},
}


def parse_rows(rows: list[dict]) -> list[dict]:
    """raw row dict 목록을 파싱해 중복 제거 후 반환.

    중복 제거 기준: btrainNo.
    같은 btrainNo에 1004·1075 둘 다 있으면 1075(수인분당선) 우선.
    """
    # btrainNo → 행 dict 맵 (1075 우선)
    seen: dict[str, dict] = {}
    for row in rows:
        train_no = row.get("btrainNo", "")
        subway_id = row.get("subwayId", "1004")
        if train_no not in seen:
            seen[train_no] = row
        elif subway_id == "1075":
            # 수인분당선 엔트리가 있으면 덮어쓴다
            seen[train_no] = row

    result = []
    for train_no, row in seen.items():
        subway_id = row.get("subwayId", "1004")
        meta = _LINE_MAP.get(subway_id, _LINE_MAP["1004"])
        result.append({
            "line": meta["line"],
            "direction": row.get("updnLine", ""),
            "destination": row.get("bstatnNm", ""),
            "status_code": int(row.get("arvlCd", "99")),
            "status_msg": row.get("arvlMsg2", ""),
            "current_station": row.get("arvlMsg3", ""),
            "train_no": train_no,
            "color": meta["color"],
        })
    return result


async def fetch_realtime() -> list[dict]:
    """서울 실시간 API 호출 → 파싱 → 반환."""
    url = _BASE_URL.format(key=settings.SEOUL_SUBWAY_KEY)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    root = ET.fromstring(resp.text)
    rows = []
    for row_el in root.findall("row"):
        row = {child.tag: (child.text or "") for child in row_el}
        rows.append(row)

    return parse_rows(rows)


async def get_realtime_cached() -> list[dict]:
    """Redis 캐시 hit → 반환, miss → fetch 후 저장."""
    cached = await get_cached_json(_CACHE_KEY)
    if cached is not None:
        return cached
    data = await fetch_realtime()
    await set_cached_json(_CACHE_KEY, data, ttl=_CACHE_TTL)
    return data


async def fetch_and_cache_realtime() -> list[dict]:
    """스케줄러용: 강제 fetch 후 캐시 덮어쓰기."""
    data = await fetch_realtime()
    await set_cached_json(_CACHE_KEY, data, ttl=_CACHE_TTL)
    redis = await get_redis()
    await redis.set(_LAST_FETCH_KEY, str(time.time()))
    return data
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
cd /home/rivermoon/Documents/Github/tal-jungwang/backend
python -m pytest tests/test_subway_realtime.py -v
```

Expected:
```
PASSED tests/test_subway_realtime.py::test_parse_deduplicates_by_train_no
PASSED tests/test_subway_realtime.py::test_parse_line_classification
PASSED tests/test_subway_realtime.py::test_parse_status_code_mapping
PASSED tests/test_subway_realtime.py::test_parse_color_by_line
PASSED tests/test_subway_realtime.py::test_parse_destination
5 passed
```

- [ ] **Step 5: 커밋**

```bash
git add backend/app/services/subway_realtime.py backend/tests/test_subway_realtime.py
git commit -m "feat(subway): 서울 실시간 API 파싱 서비스 + 단위 테스트"
```

---

## Task 3: 백엔드 — /subway/realtime 엔드포인트

**Files:**
- Modify: `backend/app/api/subway.py`

- [ ] **Step 1: 엔드포인트 추가**

`backend/app/api/subway.py`에서 기존 import에 `SubwayRealtimeItem` 추가하고 라우터 하단에 엔드포인트 추가:

```python
# 기존 import 수정
from app.schemas.subway import SubwayNextResponse, SubwayRealtimeItem, SubwayTimetableResponse
from app.services.subway import get_next, get_timetable
from app.services.subway_realtime import get_realtime_cached
```

파일 하단에 추가:

```python
@router.get("/realtime")
@limiter.limit("60/minute")
async def subway_realtime(request: Request):
    data = await get_realtime_cached()
    return ApiResponse[list[SubwayRealtimeItem]].ok(data)
```

- [ ] **Step 2: 로컬 동작 확인**

```bash
cd /home/rivermoon/Documents/Github/tal-jungwang
docker compose up -d
curl -s "http://localhost:8000/api/v1/subway/realtime" | python3 -m json.tool | head -40
```

Expected: `{"success": true, "data": [...]}` — 실시간 열차 목록 반환.  
SEOUL_SUBWAY_KEY가 `.env`에 `SEOUL_SUBWAY_KEY=767747555872697638335655475146`로 설정되어 있어야 함.

- [ ] **Step 3: 커밋**

```bash
git add backend/app/api/subway.py
git commit -m "feat(subway): GET /api/v1/subway/realtime 엔드포인트 추가"
```

---

## Task 4: 백엔드 — APScheduler 폴링 job

**Files:**
- Modify: `backend/app/core/scheduler.py`

- [ ] **Step 1: 폴링 job 함수 추가**

`backend/app/core/scheduler.py`에서 `import` 블록 하단에 추가:

```python
import time as _time
```

기존 job 함수들 아래에 추가:

```python
async def _subway_realtime_poll_job():
    """서울 지하철 실시간 도착정보 폴링.

    피크(07~09, 17~19): 30초마다 실제 호출.
    비피크: 90초 미만 경과 시 스킵 (30초 job이 돌지만 실제 API는 90초 주기).
    새벽(01~05): 첫차 없으므로 스킵.
    """
    hour = datetime.now(_KST).hour
    if 1 <= hour < 5:
        return

    is_peak = (7 <= hour < 9) or (17 <= hour < 19)
    if not is_peak:
        redis = await get_redis()
        last_raw = await redis.get("subway:realtime:last_fetch")
        if last_raw:
            elapsed = _time.time() - float(last_raw)
            if elapsed < 90:
                return

    from app.services.subway_realtime import fetch_and_cache_realtime
    try:
        await fetch_and_cache_realtime()
    except Exception:
        logger.exception("지하철 실시간 폴링 실패")
```

- [ ] **Step 2: setup_scheduler()에 job 등록**

`setup_scheduler()` 함수 내 마지막 `logger.info` 전에 추가:

```python
    # ── 지하철 실시간 폴링 (30초 간격, 내부에서 비피크/새벽 스킵) ──
    # 피크(07~09, 17~19): 30초 주기로 실제 호출
    # 비피크: 90초 미만이면 스킵 → 실질적 90초 주기
    # 새벽(01~05): 스킵
    # 예상 일 호출: 피크 4h×120 + 비피크 17h×40 ≈ 480 + 680 = 960회
    scheduler.add_job(
        _subway_realtime_poll_job,
        IntervalTrigger(seconds=30),
        id="subway_realtime_poll",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=15,
    )
    logger.info("Subway realtime polling scheduler configured (every 30s, adaptive skip for off-peak)")
```

- [ ] **Step 3: get_redis import 확인**

파일 상단 import에 `get_redis`가 없으면 추가:

```python
from app.core.cache import get_cached_json, get_redis, set_cached_json
```

scheduler.py에서 `get_redis`를 직접 사용하므로 확인. 없으면:

```python
# scheduler.py 상단에 추가
from app.core.cache import get_redis
```

- [ ] **Step 4: 재시작 후 로그 확인**

```bash
docker compose restart backend
docker compose logs backend --tail=20
```

Expected 로그에 포함:
```
Subway realtime polling scheduler configured (every 30s, adaptive skip for off-peak)
```

- [ ] **Step 5: 커밋**

```bash
git add backend/app/core/scheduler.py
git commit -m "feat(subway): APScheduler 실시간 폴링 job 추가 (피크 30s, 비피크 90s)"
```

---

## Task 5: 프론트엔드 — useSubwayRealtime 훅

**Files:**
- Modify: `frontend/src/hooks/useSubway.js`

- [ ] **Step 1: useSubwayRealtime 훅 추가**

`frontend/src/hooks/useSubway.js` 하단에 추가:

```js
export function useSubwayRealtime() {
  return useApi('/subway/realtime', { interval: 30_000 })
}
```

- [ ] **Step 2: 동작 확인 (브라우저 콘솔)**

```bash
cd /home/rivermoon/Documents/Github/tal-jungwang/frontend && npm run dev
```

브라우저에서 개발자 도구 → Network 탭 → `/api/v1/subway/realtime` 요청이 30초마다 발생하는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/hooks/useSubway.js
git commit -m "feat(subway): useSubwayRealtime 훅 추가"
```

---

## Task 6: 프론트엔드 — SubwayRealtimeBoard 컴포넌트

승강장 안내판 스타일 — 좌: 노선 dot + 목적지(크게) + 현재위치, 우: 도착 시간.

**Files:**
- Create: `frontend/src/components/subway/SubwayRealtimeBoard.jsx`

- [ ] **Step 1: 컴포넌트 구현**

`frontend/src/components/subway/SubwayRealtimeBoard.jsx` 생성:

```jsx
import useAppStore from '../../stores/useAppStore'

// arvlCd 0,1,5 → 임박 (빨간색)
function isImminent(statusCode) {
  return [0, 1, 5].includes(statusCode)
}

function formatStatusMsg(item) {
  const { status_code, status_msg, current_station } = item
  if (status_code === 0) return `${current_station} 진입 중`
  if (status_code === 1) return `${current_station} 도착`
  if (status_code === 5) return `전역 도착 (${current_station})`
  return status_msg  // "[N]번째 전역 (역명)" 등 그대로 표시
}

function ArrivalTime({ item }) {
  const imminent = isImminent(item.status_code)
  const color = imminent ? '#dc2626' : item.color

  return (
    <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
      <span
        className="text-2xl font-black leading-none tabular-nums tracking-tight"
        style={{ color }}
      >
        {imminent ? '곧' : '?'}
      </span>
      <span className="text-[10px] text-slate-400 mt-0.5">
        {imminent ? '도착' : '운행중'}
      </span>
    </div>
  )
}

function RealtimeRow({ item, onClick }) {
  const imminent = isImminent(item.status_code)
  const darkMode = useAppStore((s) => s.darkMode)

  const rowBg = imminent
    ? (darkMode ? 'bg-red-950/30' : 'bg-red-50')
    : 'bg-white dark:bg-surface-dark'

  const destColor = imminent ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors ${rowBg}`}
      onClick={() => onClick?.(item)}
    >
      {/* 좌: 노선 dot + 목적지 + 현재위치 */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: item.color }}
          />
          <span className="text-[9px] text-slate-400 font-medium leading-none whitespace-nowrap">
            {item.direction}
          </span>
        </div>
        <div className="min-w-0">
          {/* 목적지 — 가장 크고 굵게 */}
          <div className={`text-xl font-extrabold leading-tight tracking-tight ${destColor}`}>
            {item.destination}
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 ml-1">행</span>
          </div>
          {/* 현재위치 — 작게 */}
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {formatStatusMsg(item)}
          </div>
        </div>
      </div>

      {/* 우: 도착 시간 */}
      <ArrivalTime item={item} />
    </div>
  )
}

export default function SubwayRealtimeBoard({ arrivals, onRowClick }) {
  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        현재 운행 중인 열차 정보가 없습니다
      </div>
    )
  }

  // 호선별로 그룹핑 (4호선 먼저, 수인분당선 다음)
  const line4 = arrivals.filter((a) => a.line === '4호선')
  const suinbundang = arrivals.filter((a) => a.line === '수인분당선')

  function Section({ lineName, color, items }) {
    if (items.length === 0) return null
    return (
      <div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{lineName}</span>
        </div>
        {items.map((item) => (
          <RealtimeRow key={item.train_no} item={item} onClick={onRowClick} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <Section lineName="4호선" color="#1B5FAD" items={line4} />
      <Section lineName="수인분당선" color="#F5A623" items={suinbundang} />
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/subway/SubwayRealtimeBoard.jsx
git commit -m "feat(subway): SubwayRealtimeBoard 승강장 안내판 스타일 컴포넌트"
```

---

## Task 7: 프론트엔드 — SubwayLineMap 컴포넌트

**Files:**
- Create: `frontend/src/components/subway/SubwayLineMap.jsx`

- [ ] **Step 1: 역 목록 상수 + 컴포넌트 구현**

`frontend/src/components/subway/SubwayLineMap.jsx` 생성:

```jsx
import useAppStore from '../../stores/useAppStore'

// 방향별 역 목록 (열차 진행 방향 순서)
// 각 배열에서 정왕이 중심 참조점
const STATION_SEQUENCES = {
  '4호선': {
    상행: ['오이도', '정왕', '신길온천', '안산', '초지', '고잔', '중앙', '한대앞', '상록수', '반월', '대야미', '수리산', '산본', '금정'],
    하행: ['금정', '산본', '수리산', '대야미', '반월', '상록수', '한대앞', '중앙', '고잔', '초지', '안산', '신길온천', '정왕', '오이도'],
  },
  '수인분당선': {
    상행: ['오이도', '정왕', '거모', '거모동', '안산', '초지', '고잔', '중앙', '한대앞', '사리', '야목', '어천', '오목천', '고색', '수원'],
    하행: ['수원', '고색', '오목천', '어천', '야목', '사리', '한대앞', '중앙', '고잔', '초지', '안산', '거모동', '거모', '정왕', '오이도', '달월', '월곶', '소래포구'],
  },
}

const JEONGWANG = '정왕'

// 현재역이 정왕 기준으로 앞/뒤인지: 정왕 이전이면 true (열차가 아직 도착 전)
function isBeforeJeongwang(stations, currentStation) {
  const jeongwangIdx = stations.indexOf(JEONGWANG)
  const currentIdx = stations.indexOf(currentStation)
  if (currentIdx === -1 || jeongwangIdx === -1) return false
  return currentIdx < jeongwangIdx
}

export default function SubwayLineMap({ line, direction, currentStation, color }) {
  const darkMode = useAppStore((s) => s.darkMode)
  const stations = STATION_SEQUENCES[line]?.[direction] ?? []

  if (stations.length === 0) return null

  const jeongwangIdx = stations.indexOf(JEONGWANG)
  const currentIdx = stations.indexOf(currentStation)
  const trainApproaching = currentIdx !== -1 && currentIdx < jeongwangIdx

  // 표시할 역 범위: 현재역 또는 정왕 기준 앞 2개 ~ 정왕 뒤 5개
  const startIdx = Math.max(0, Math.min(currentIdx !== -1 ? currentIdx : jeongwangIdx, jeongwangIdx) - 1)
  const endIdx = Math.min(stations.length - 1, jeongwangIdx + 6)
  const visible = stations.slice(startIdx, endIdx + 1)
  const visibleStart = startIdx

  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl mx-4 mb-4 border border-slate-100 dark:border-border-dark overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">노선도</span>
      </div>
      <div className="px-4 pb-3">
        {visible.map((stationName, i) => {
          const absoluteIdx = visibleStart + i
          const isJeongwang = stationName === JEONGWANG
          const isTrain = stationName === currentStation && trainApproaching
          const isPast = absoluteIdx < (currentIdx !== -1 ? currentIdx : jeongwangIdx)

          return (
            <div key={stationName} className="flex items-center gap-0">
              {/* 세로 선 + 역 dot */}
              <div className="flex flex-col items-center w-5 flex-shrink-0">
                {/* 위 선 */}
                {i > 0 && (
                  <div
                    className="w-0.5 h-3"
                    style={{ background: isPast ? (darkMode ? '#334155' : '#e2e8f0') : color, opacity: isPast ? 0.4 : 1 }}
                  />
                )}
                {/* 역 dot */}
                <div
                  className="rounded-full flex-shrink-0 border-2 border-white dark:border-surface-dark"
                  style={{
                    width: isJeongwang ? 14 : isTrain ? 12 : 9,
                    height: isJeongwang ? 14 : isTrain ? 12 : 9,
                    background: isJeongwang
                      ? color
                      : isTrain
                        ? '#f59e0b'
                        : isPast
                          ? (darkMode ? '#334155' : '#e2e8f0')
                          : (darkMode ? '#475569' : '#cbd5e1'),
                    outline: isJeongwang ? `2px solid ${color}` : isTrain ? '2px solid #f59e0b' : 'none',
                    outlineOffset: 1,
                    opacity: isPast ? 0.35 : 1,
                  }}
                />
                {/* 아래 선 */}
                {i < visible.length - 1 && (
                  <div
                    className="w-0.5 h-3"
                    style={{
                      background: isJeongwang || absoluteIdx >= jeongwangIdx
                        ? (darkMode ? '#334155' : '#e2e8f0')
                        : color,
                      opacity: isPast ? 0.4 : 1,
                    }}
                  />
                )}
              </div>

              {/* 역명 + 뱃지 */}
              <div className={`flex items-center gap-2 ml-3 py-0.5 ${i > 0 || i < visible.length - 1 ? '' : ''}`}>
                <span
                  className={`leading-none ${
                    isJeongwang
                      ? 'text-sm font-extrabold'
                      : isTrain
                        ? 'text-sm font-bold'
                        : 'text-xs'
                  } ${
                    isJeongwang
                      ? 'text-slate-900 dark:text-slate-100'
                      : isTrain
                        ? 'text-amber-600 dark:text-amber-400'
                        : isPast
                          ? 'text-slate-300 dark:text-slate-700'
                          : 'text-slate-500 dark:text-slate-400'
                  }`}
                  style={isJeongwang ? { color } : {}}
                >
                  {stationName}
                </span>
                {isJeongwang && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: color }}>
                    여기
                  </span>
                )}
                {isTrain && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    🚇 접근 중
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/components/subway/SubwayLineMap.jsx
git commit -m "feat(subway): SubwayLineMap 세로 노선도 컴포넌트"
```

---

## Task 8: 프론트엔드 — SubwayTab 통합

실시간/시간표 탭 전환 + 실시간 탭 클릭 시 상세 뷰(노선도)까지.

**Files:**
- Modify: `frontend/src/components/subway/SubwayTab.jsx`

- [ ] **Step 1: SubwayTab.jsx 전체 교체**

`frontend/src/components/subway/SubwayTab.jsx`를 아래로 교체:

```jsx
import { useState } from 'react'
import { TrainFront, ChevronLeft } from 'lucide-react'
import { useSubwayTimetable } from '../../hooks/useSubway'
import { useSubwayRealtime } from '../../hooks/useSubway'
import SubwayLineCard from './SubwayLineCard'
import SubwayCountdown from './SubwayCountdown'
import SubwayTimetable from './SubwayTimetable'
import SubwayRealtimeBoard from './SubwayRealtimeBoard'
import SubwayLineMap from './SubwayLineMap'
import { getLastTrainStatus, getSpecialTrainIndices } from '../../utils/trainTime'

// ── 기존 상수들 유지 ─────────────────────────────────────────
function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function getNextDestination(trains) {
  if (!trains?.length) return null
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  return trains.find((t) => timeToMinutes(t.depart_at) > nowMin)?.destination ?? null
}

const STATION_GROUPS = [
  {
    stationName: '정왕역',
    cards: [
      { key: 'line4_up',   lineName: '4호선',    upDown: '상행', fallback: '당고개', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
      { key: 'line4_down', lineName: '4호선',    upDown: '하행', fallback: '오이도', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
      { key: 'up',         lineName: '수인분당선', upDown: '상행', fallback: '왕십리', color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
      { key: 'down',       lineName: '수인분당선', upDown: '하행', fallback: '인천',   color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
    ],
  },
  {
    stationName: '초지역',
    cards: [
      { key: 'choji_up', lineName: '서해선', upDown: '상행', fallback: '대곡/일산', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
      { key: 'choji_dn', lineName: '서해선', upDown: '하행', fallback: '원시', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
    ],
  },
  {
    stationName: '시흥시청역',
    cards: [
      { key: 'siheung_up', lineName: '서해선', upDown: '상행', fallback: '대곡/일산', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
      { key: 'siheung_dn', lineName: '서해선', upDown: '하행', fallback: '원시', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
    ],
  },
]
const ALL_CARD_DEFS = STATION_GROUPS.flatMap((g) => g.cards)
const STATION_TABS = STATION_GROUPS.map((g) => g.stationName)

// ── 막차 경고 (기존 로직 유지) ───────────────────────────────
function useLastTrainWarnings(timetable) {
  if (!timetable) return []
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  return ALL_CARD_DEFS.flatMap((def) => {
    const trains = timetable[def.key] ?? []
    const status = getLastTrainStatus(trains, nowMin)
    if (!status?.isLast) return []
    const [hh, mm] = status.nextTrain.depart_at.split(':').map(Number)
    let rawMin = hh * 60 + mm
    if (rawMin < 3 * 60 && nowMin > 22 * 60) rawMin += 1440
    const diffMin = rawMin - nowMin
    if (diffMin > 30) return []
    return [{ lineName: def.lineName, upDown: def.upDown, destination: status.nextTrain.destination, diffMin }]
  })
}

function LastTrainBanner({ warnings }) {
  if (warnings.length === 0) return null
  return (
    <div className="mx-4 mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3">
      <p className="text-xs font-extrabold text-red-500 uppercase tracking-wide mb-1.5">막차 임박</p>
      <div className="flex flex-col gap-1">
        {warnings.map((w, i) => (
          <p key={i} className="text-sm text-red-700 dark:text-red-400">
            <span className="font-bold">{w.lineName} {w.upDown}</span>
            {' · '}{w.destination} 방면 — <span className="font-bold tabular-nums">{w.diffMin}분 후</span> 막차
          </p>
        ))}
      </div>
    </div>
  )
}

// ── 실시간 상세 뷰 (노선도 + 시간표) ────────────────────────
function RealtimeDetailView({ realtimeItem, timetable, onBack }) {
  // 실시간 item의 line·direction으로 시간표 키 매핑
  const timetableKey = (() => {
    const { line, direction } = realtimeItem
    if (line === '4호선' && direction === '상행') return 'line4_up'
    if (line === '4호선' && direction === '하행') return 'line4_down'
    if (line === '수인분당선' && direction === '상행') return 'up'
    if (line === '수인분당선' && direction === '하행') return 'down'
    return null
  })()

  const trains = timetableKey ? (timetable?.[timetableKey] ?? []) : []
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

  return (
    <div className="flex flex-col h-full animate-slide-in-right">
      {/* 헤더 */}
      <div
        className="flex items-center gap-2 text-white px-4 py-4"
        style={{ backgroundColor: realtimeItem.color }}
      >
        <button onClick={onBack} className="p-0.5 -ml-1 rounded">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <TrainFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">
          {realtimeItem.line} · {realtimeItem.destination} 방면
        </h2>
        <span className="ml-auto text-xs text-white/70 font-semibold">● LIVE</span>
      </div>

      {/* 현재 위치 */}
      <div className="px-4 py-3 bg-white dark:bg-surface-dark border-b border-slate-100 dark:border-border-dark">
        <p className="text-xs text-slate-400 mb-1">현재 위치</p>
        <p className="text-base font-bold text-slate-800 dark:text-slate-200">
          {realtimeItem.status_msg || `${realtimeItem.current_station} 운행 중`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
        {/* 세로 노선도 */}
        <div className="pt-3">
          <SubwayLineMap
            line={realtimeItem.line}
            direction={realtimeItem.direction}
            currentStation={realtimeItem.current_station}
            color={realtimeItem.color}
          />
        </div>

        {/* 오늘 이후 시간표 */}
        {trains.length > 0 && (
          <>
            <div className="px-4 pb-2 pt-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">오늘 이후 시간표</p>
            </div>
            <SubwayTimetable
              entries={trains}
              nextIndex={nextIndex}
              lastIdx={lastIdx ?? null}
              firstIdx={firstIdx ?? null}
              lineColor={realtimeItem.color}
              lineDarkColor={realtimeItem.color}
              lineLightColor={realtimeItem.color + '22'}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── 메인 SubwayTab ────────────────────────────────────────
export default function SubwayTab() {
  const [stationTab, setStationTab] = useState(STATION_TABS[0])
  const [modeTab, setModeTab] = useState('realtime')   // 'realtime' | 'timetable'
  const [selectedKey, setSelectedKey] = useState(null)           // 시간표 상세
  const [selectedRealtimeItem, setSelectedRealtimeItem] = useState(null) // 실시간 상세

  const { data: timetable, loading: ttLoading } = useSubwayTimetable()
  const { data: arrivals, loading: rtLoading } = useSubwayRealtime()
  const lastTrainWarnings = useLastTrainWarnings(timetable)

  const isJeongwang = stationTab === '정왕역'

  // 실시간 데이터 없으면 시간표로 폴백
  const effectiveModeTab = (isJeongwang && arrivals && arrivals.length > 0)
    ? modeTab
    : 'timetable'

  // ── 실시간 상세 뷰 ──────────────────────────────────────
  if (selectedRealtimeItem) {
    return (
      <RealtimeDetailView
        realtimeItem={selectedRealtimeItem}
        timetable={timetable}
        onBack={() => setSelectedRealtimeItem(null)}
      />
    )
  }

  // ── 시간표 상세 뷰 (기존) ──────────────────────────────
  const selected = selectedKey ? ALL_CARD_DEFS.find((c) => c.key === selectedKey) : null
  if (selected) {
    const trains = timetable?.[selected.key] ?? []
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
    const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
    const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

    return (
      <div className="flex flex-col h-full animate-slide-in-right">
        <div
          className="flex items-center gap-2 text-white px-4 py-4"
          style={{ backgroundColor: selected.color }}
        >
          <button onClick={() => setSelectedKey(null)} className="p-0.5 -ml-1 rounded">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <TrainFront size={20} strokeWidth={2} />
          <h2 className="text-lg font-bold">
            {selected.lineName} · {getNextDestination(timetable?.[selected.key]) ?? selected.fallback} 방면
          </h2>
        </div>
        <SubwayCountdown nextTrain={nextTrain} lineColor={selected.color} lineDarkColor={selected.darkColor} />
        {ttLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <SubwayTimetable
            entries={trains}
            nextIndex={nextIndex}
            lastIdx={lastIdx ?? null}
            firstIdx={firstIdx ?? null}
            lineColor={selected.color}
            lineDarkColor={selected.darkColor}
            lineLightColor={selected.lightColor}
          />
        )}
      </div>
    )
  }

  // ── 카드 목록 뷰 ────────────────────────────────────────
  const activeGroup = STATION_GROUPS.find((g) => g.stationName === stationTab) ?? STATION_GROUPS[0]

  return (
    <div className="flex flex-col h-full">
      {/* 공통 헤더 */}
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <TrainFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">지하철</h2>
      </div>

      {/* 역 탭 */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        {STATION_TABS.map((name) => (
          <button
            key={name}
            onClick={() => { setStationTab(name); setModeTab('realtime') }}
            className={`pressable px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              stationTab === name
                ? 'bg-navy text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* 실시간/시간표 탭 — 정왕역만 표시 */}
      {isJeongwang && (
        <div className="flex gap-0 px-4 pt-2 pb-0 border-b border-slate-100 dark:border-slate-800">
          {['realtime', 'timetable'].map((tab) => (
            <button
              key={tab}
              onClick={() => setModeTab(tab)}
              className={`mr-4 pb-2 text-[13px] font-bold transition-colors border-b-2 ${
                effectiveModeTab === tab
                  ? 'text-navy dark:text-white border-navy dark:border-white'
                  : 'text-slate-400 border-transparent'
              }`}
            >
              {tab === 'realtime' ? '실시간' : '시간표'}
            </button>
          ))}
          {/* 실시간 데이터 없을 때 안내 */}
          {isJeongwang && (!arrivals || arrivals.length === 0) && !rtLoading && (
            <span className="ml-auto self-center text-[10px] text-slate-400 pb-2">운행 정보 없음</span>
          )}
        </div>
      )}

      {/* 콘텐츠 */}
      {effectiveModeTab === 'realtime' && isJeongwang ? (
        rtLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <SubwayRealtimeBoard
            arrivals={arrivals ?? []}
            onRowClick={(item) => setSelectedRealtimeItem(item)}
          />
        )
      ) : (
        ttLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
            <LastTrainBanner warnings={lastTrainWarnings} />
            <div className="p-4 flex flex-col gap-3">
              {activeGroup.cards.map((card) => {
                const dest = getNextDestination(timetable?.[card.key]) ?? card.fallback
                return (
                  <SubwayLineCard
                    key={card.key}
                    lineName={card.lineName}
                    dirLabel={`${card.upDown} · ${dest} 방면`}
                    color={card.color}
                    darkColor={card.darkColor}
                    lightColor={card.lightColor}
                    trains={timetable?.[card.key] ?? []}
                    onClick={() => setSelectedKey(card.key)}
                  />
                )
              })}
            </div>
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: import 누락 확인**

`useSubwayRealtime`이 `useSubway.js`에서 named export로 나오는지 확인:

```bash
grep "useSubwayRealtime" /home/rivermoon/Documents/Github/tal-jungwang/frontend/src/hooks/useSubway.js
```

Expected: `export function useSubwayRealtime() {`

- [ ] **Step 3: 브라우저에서 전체 흐름 확인**

```bash
cd /home/rivermoon/Documents/Github/tal-jungwang/frontend && npm run dev
```

확인 항목:
1. 지하철 탭 → 정왕역 선택 → "실시간 | 시간표" 탭 표시
2. 실시간 탭: 승강장 안내판 스타일 목록 (호선 섹션 → 목적지 크게 → 시간 우측)
3. 임박 열차: 배경 빨간 tint, 목적지·시간 빨간색
4. 행 클릭 → 상세 뷰: 현재위치 + 세로 노선도 + 시간표
5. 시간표 탭 전환 → 기존 SubwayLineCard 카드 목록
6. 초지역/시흥시청역 선택 → 실시간/시간표 탭 미표시, 시간표만
7. 다크모드 토글 → 색상 깨짐 없는지

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/subway/SubwayTab.jsx
git commit -m "feat(subway): 실시간/시간표 탭 전환 + 노선도 상세 뷰 통합"
```

---

## 스펙 커버리지 체크

| 요구사항 | 구현 Task |
|---|---|
| GET /subway/realtime 엔드포인트 | Task 3 |
| APScheduler 피크/비피크 폴링 | Task 4 |
| 실시간/시간표 탭 전환 (정왕역만) | Task 8 |
| 승강장 안내판 디자인 C (목적지 크게) | Task 6 |
| 임박 열차 빨간색 강조 | Task 6 |
| 상세 뷰 세로 노선도 + 열차 위치 | Task 7 + Task 8 |
| 실시간 없을 때 시간표 자동 폴백 | Task 8 (effectiveModeTab 로직) |
| 다크모드 대응 | Task 6, 7, 8 전반 |
| btrainNo 기준 중복 제거 | Task 2 |
| 일 1,000회 한도 | Task 4 (피크 30s, 비피크 90s skip) |
