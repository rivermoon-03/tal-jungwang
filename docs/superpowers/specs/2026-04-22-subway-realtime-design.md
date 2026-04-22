# 지하철 실시간 도착정보 통합 설계

**날짜**: 2026-04-22  
**범위**: 정왕역 지하철 실시간 도착정보 API 연동 + SubwayTab UI 개편  

---

## 1. 목표

서울시 지하철 실시간 도착정보 API(SEOUL_SUBWAY_KEY)를 연동해  
기존 시간표 기반 SubwayTab에 **실시간 탭**을 추가한다.  
정왕역 4호선·수인분당선만 실시간 지원하며, 일 1,000회 API 호출 한도를 지킨다.

---

## 2. 외부 API

```
GET http://swopenAPI.seoul.go.kr/api/subway/{KEY}/xml/realtimeStationArrival/0/10/정왕
```

### 응답 필드

| 필드 | 설명 |
|---|---|
| `updnLine` | `상행` / `하행` |
| `trainLineNm` | `"불암산행 - 신길온천방면"` 형식 |
| `subwayId` | `1004`=4호선, `1075`=수인분당선 |
| `btrainNo` | 열차 번호 (중복 제거 기준) |
| `bstatnNm` | 종착역 이름 |
| `arvlMsg2` | 위치 메시지: `"정왕 도착"`, `"전역 도착"`, `"[N]번째 전역 (역명)"`, `"정왕 진입"` |
| `arvlMsg3` | 현재 위치 역명 |
| `arvlCd` | `0`=진입, `1`=도착, `2`=출발, `5`=전역도착, `99`=운행중 |
| `barvlDt` | 남은 초 (참고용, 0이면 곧 도착) |

### 열차 분류 로직

- `subwayId=1004` → 4호선 / `subwayId=1075` → 수인분당선
- 동일 `btrainNo`가 두 `subwayId`로 중복 등장 → **`btrainNo` 기준 dedup**, 먼저 나온 것 사용
- `updnLine` 그대로 사용: `상행` / `하행`

### 표시 상태 매핑

| `arvlCd` | 표시 | 색상 |
|---|---|---|
| 0, 1 | `진입 중` / `도착` | 빨간색 (#dc2626) |
| 5 | `전역 도착` (곧 도착) | 빨간색 (#dc2626) |
| 99 | `[N]번째 전역 (역명)` | 호선 컬러 |

---

## 3. 폴링 전략

일 1,000회 한도 내에서 최대 활용:

| 시간대 | 간격 | 분당 호출 |
|---|---|---|
| 01:00~05:00 | OFF (첫차 없음) | 0 |
| 05:00~07:00 | 90초 | 0.67 |
| 07:00~09:00 (피크) | 30초 | 2.0 |
| 09:00~17:00 | 90초 | 0.67 |
| 17:00~19:00 (피크) | 30초 | 2.0 |
| 19:00~01:00 | 90초 | 0.67 |

**하루 예상 호출 수**: 피크 4h×2 + 비피크 17h×0.67 ≒ 240 + 683 = **약 923회** ✓

---

## 4. 백엔드 변경

### 4-1. `backend/app/core/config.py`

`SEOUL_SUBWAY_KEY: str = ""` 필드 추가.

### 4-2. `backend/app/services/subway_realtime.py` (신규)

```python
# 역할: 서울 실시간 API 호출 → 파싱 → Redis 캐싱
# 캐시 키: subway:realtime:정왕
# TTL: 35초 (폴링 간격보다 약간 길게)

async def fetch_realtime() -> list[dict]:
    """서울 실시간 API에서 정왕역 도착정보를 가져와 파싱 반환."""

async def get_realtime_cached() -> list[dict]:
    """Redis 캐시 hit → 반환, miss → fetch_realtime() 호출 후 저장."""
```

파싱 결과 dict 구조:
```json
{
  "line": "4호선",           // "4호선" | "수인분당선"
  "direction": "상행",       // "상행" | "하행"
  "destination": "불암산",   // bstatnNm
  "status_code": 5,          // arvlCd int
  "status_msg": "전역 도착", // arvlMsg2 가공
  "current_station": "오이도", // arvlMsg3
  "train_no": "4590",         // btrainNo
  "color": "#1B5FAD"          // 호선 컬러
}
```

### 4-3. `backend/app/api/subway.py`

새 엔드포인트 추가:
```
GET /api/v1/subway/realtime
응답: ApiResponse[list[SubwayRealtimeItem]]
```

### 4-4. `backend/app/schemas/subway.py`

`SubwayRealtimeItem` Pydantic 모델 추가.

### 4-5. `backend/app/core/scheduler.py`

`_subway_realtime_poll_job()` 추가 및 등록:
- 피크(07~09, 17~19): 30초 IntervalTrigger 2개
- 비피크(05~07, 09~17, 19~01): 90초 IntervalTrigger 1개
- 01~05시: job 내부에서 시간 체크 후 return

---

## 5. 프론트엔드 변경

### 5-1. `frontend/src/hooks/useSubway.js`

```js
export function useSubwayRealtime() {
  // 폴링 interval: 30초 (피크/비피크 구분은 백엔드가 담당)
  return useApi('/subway/realtime', { interval: 30_000 })
}
```

### 5-2. `frontend/src/components/subway/SubwayRealtimeBoard.jsx` (신규)

**디자인 C — 승강장 안내판 구조**

```
[ 호선 dot + 노선명 상행/하행 ]    [ 도착시간  ]
[ 목적지명 (크게, 굵게)        ]    [ 분 후     ]
[ 현재위치 (작게, 회색)        ]
```

레이아웃 규칙:
- 각 row: `display: flex`, 왼쪽 flex-grow, 오른쪽 fixed width ~64px, 세로 구분선
- **목적지**: `text-xl font-extrabold` (20px, 900weight) — 가장 크고 굵은 텍스트
- **도착 시간**: `text-2xl font-black` — 목적지와 동등하게 강조, 우측 정렬
- 임박(arvlCd 0,1,5): 행 전체 배경 `#fff7f7`, 목적지+시간 모두 `#dc2626`
- 현재 위치 메시지: `text-xs text-slate-400`
- 다음 열차(두 번째 항목): 살짝 흐리게 표시

컴포넌트 props:
```js
// arrivals: SubwayRealtimeItem[] (백엔드 응답 그대로)
<SubwayRealtimeBoard arrivals={arrivals} onCardClick={(item) => ...} />
```

각 row를 클릭하면 해당 방면의 시간표 상세 뷰로 진입.

### 5-3. `frontend/src/components/subway/SubwayLineMap.jsx` (신규)

상세 뷰에 표시되는 **세로 노선도**.  
열차 현재 위치를 역 목록에서 강조.

```js
// props
{
  line: "4호선" | "수인분당선",
  direction: "상행" | "하행",
  currentStation: "오이도",   // arvlMsg3
  terminalStation: "불암산",  // bstatnNm
  color: "#1B5FAD"
}
```

역 목록 상수 (파일 내 정의):

**4호선 상행 (정왕 기준 ±7역)**:  
`["신길온천", "정왕", "금정", "범계", "평촌", "인덕원", "대야미", "반월", "상록수", "한대앞"]`  
(정왕은 거의 종점이므로 하행은 `["오이도", "정왕"]`으로 짧게)

**수인분당선 상행 (정왕 기준 ±7역)**:  
`["오이도", "정왕", "어천", "오목천", "고색", "수원", "매교", "수원시청", "매탄권선", "망포"]`

**수인분당선 하행**:  
`["거모", "거모동", "안산", "초지", "고잔", "중앙", "한대앞", "사리", "야목", "어천", ...역방향으로 인천까지]`  
→ 실제로는 `["정왕", "오이도", "달월", "월곶", "소래포구", "인천논현", "호구포"]` 등 최대 8역

렌더 구조:
```
  ┌──[선]──  오이도  ── 🚇 접근 중 ──
  │
  ●  정왕  ← 여기  (현재역, 파란 굵은 점)
  │
  ──  금정
  ──  범계
     ...
```

- 현재역: 큰 점 + `← 현재역` 라벨 + 호선 배경 tint
- 열차 위치역: 작은 주황 점 + 🚇 이모지 + "접근 중" 라벨
- 이미 지나간 역(terminal 방향 반대쪽): 흐리게

### 5-4. `frontend/src/components/subway/SubwayTab.jsx` 수정

- `정왕역` 선택 시: 상단에 `실시간 | 시간표` 탭 추가
- 초지역/시흥시청역: 탭 없이 기존 시간표 카드만 표시
- 실시간 탭 활성: `<SubwayRealtimeBoard>` 렌더
- 시간표 탭 활성: 기존 `SubwayLineCard` 목록 렌더 (변경 없음)
- 실시간 데이터 없을 때(새벽 등): "현재 운행 정보가 없습니다" 안내 + 시간표 탭으로 자동 전환

### 5-5. `frontend/src/components/subway/SubwayLineCard.jsx` 상세 뷰 수정

상세 뷰(`selectedKey` 상태)에서:
- 실시간 탭에서 진입 시: 카운트다운 대신 **현재 위치 메시지** + `SubwayLineMap` 표시
- 시간표 탭에서 진입 시: 기존 `SubwayCountdown` + `SubwayTimetable` 유지

실제로는 SubwayTab에서 `selectedKey` + `isRealtimeMode` 를 같이 관리하여  
상세 뷰 컴포넌트에 `realtimeItem` prop을 내려주는 방식.

---

## 6. 데이터 흐름

```
[서울 실시간 API]
      ↓ (APScheduler 30s/90s 폴링)
[subway_realtime.py fetch_realtime()]
      ↓
[Redis subway:realtime:정왕 TTL 35s]
      ↓ (GET /api/v1/subway/realtime)
[useSubwayRealtime() 30s interval]
      ↓
[SubwayRealtimeBoard] ← 실시간 탭
[SubwayLineMap]       ← 상세 뷰 클릭 후
```

---

## 7. 역할 경계

| 파일 | 담당 에이전트 |
|---|---|
| `backend/app/services/subway_realtime.py` | backend |
| `backend/app/api/subway.py` (엔드포인트 추가) | backend |
| `backend/app/schemas/subway.py` (모델 추가) | backend |
| `backend/app/core/config.py` (키 추가) | backend |
| `backend/app/core/scheduler.py` (job 추가) | backend |
| `frontend/src/hooks/useSubway.js` | frontend |
| `frontend/src/components/subway/SubwayRealtimeBoard.jsx` | frontend |
| `frontend/src/components/subway/SubwayLineMap.jsx` | frontend |
| `frontend/src/components/subway/SubwayTab.jsx` | frontend |
| `frontend/src/components/subway/SubwayLineCard.jsx` (상세뷰) | frontend |

---

## 8. 완료 기준

- [ ] `GET /api/v1/subway/realtime` 호출 시 정왕역 실시간 도착 정보 반환
- [ ] APScheduler가 피크/비피크 폴링 간격을 정확히 지킴
- [ ] SubwayTab 정왕역 선택 시 실시간/시간표 탭 전환 가능
- [ ] 실시간 탭: 승강장 안내판 디자인(C) — 목적지 크게, 시간 우측
- [ ] 임박 열차(arvlCd 0,1,5): 빨간색으로 강조
- [ ] 카드 클릭 → 상세 뷰에서 세로 노선도 + 열차 위치 표시
- [ ] 실시간 없을 때 자동으로 시간표 탭 활성
- [ ] 다크모드 대응 (기존 패턴 준수)
