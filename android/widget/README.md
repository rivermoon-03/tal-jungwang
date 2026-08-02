# 탈것:정왕 — 안드로이드 홈 위젯 (v2)

TWA(Bubblewrap/PWABuilder)로 생성한 안드로이드 프로젝트에 **그대로 복사해 넣는**
홈 화면 위젯 소스다. 이 저장소에서는 빌드하지 않는다. 위젯은 웹뷰를 띄우지 않고
`GET /api/v1/widget` 한 번만 호출해 텍스트를 그린다.

**v1과 달라진 점**

- 위젯 1종 → **3종**(교통 / 학식 / 학사일정). 홈에 필요한 것만 골라 놓는다.
- 한 위젯 안에서 **사용자가 자기 동선을 고른다**(칩 탭 → 위젯 인스턴스별 저장).
- **버스는 뺐다.** GBIS 실시간은 노선·정류장별 편차가 크고 시간표 폴백이 섞이는데,
  위젯에는 "실시간인지 시간표인지"를 밝힐 자리가 없다. 확인 없이 믿는 자리에는
  근거를 함께 보여줄 수 있는 데이터만 올린다(버스는 앱 홈에서 근거와 함께 본다).

---

## 위젯 3종

### 1) 교통 (4×2) — `?type=transit&mode=shuttle|subway&campus=…&station=…`

```
┌───────────────────────────────────────────────┐
│ 셔틀 · 여름방학 단축근무          (1캠)(2캠)  │  ← 제목 + 헤더 세그
│ ───────────────────────────────────────────── │
│ ↑ 정왕역 → 학교      │  ↓ 학교 → 정왕역       │
│ 4분                  │  18분                  │  ← 26sp, ≤5분이면 accent
│ 08:41 출발 · 다음 08:59 │ 09:00 출발 · 막차    │
│ ───────────────────────────────────────────── │
│ [    셔틀    ][   지하철   ]                   │  ← 모드 칩(가로 반반)
└───────────────────────────────────────────────┘
```

- 헤더 세그: 셔틀이면 `1캠 / 2캠`, 지하철이면 `정왕 / 초지 / 시흥시청`.
  **칩 3개를 깔아두고 셔틀일 때 세 번째를 GONE** 한다(레이아웃 파일을 안 늘린다).
- 지하철은 라벨 아래 방면(`dest`)이 한 줄 더 붙는다.
- 한 방향이 끊기면 그 열만 값 대신 `sub`("오늘 운행 종료")를 남긴다(열 단위 저하).
- 전부 끝났으면 2열 대신 `empty_text` 한 줄.

### 2) 학식 (2×2) — `?type=cafeteria&view=menu|venues&place=tip|edong`

```
┌───────────────────────┐   ┌───────────────────────┐
│ (TIP)(E동)     [중식] │   │ 지금 영업 중    [5곳] │
│ 돈까스                │   │ • 맘스터치   21:00 마감│
│ 미역국                │   │ • 카페 드림  20:00 마감│
│ 쌀밥 · 배추김치 · …   │   │ • CU        24:00 마감 │
│ [ 식단 ][ 운영정보 ]  │   │ [ 식단 ][ 운영정보 ]  │
└───────────────────────┘   └───────────────────────┘
```

- 2×2는 좁아서 식당명을 제목으로 놓을 자리가 없다 — **선택 칩이 곧 제목**이다.
- 운영정보 탭에서는 식당 세그를 숨긴다(식당 선택은 식단에만 해당).
- 학식이 없는 주말·방학에도 운영정보 탭이 답을 준다.

### 3) 학사일정 (4×2, 4×1까지 축소 가능) — `?type=calendar`

```
┌───────────────────────────────────────────────┐
│ 학사일정                                   ↻  │
│ ───────────────────────────────────────────── │
│ (D-2) 2학기 수강신청              8/4 ~ 8/6   │  ← D-3 이내/진행 중이면 빨간 알약
│ (D-9) 개강                        9/1         │
└───────────────────────────────────────────────┘
```

---

## 서버 계약 — 클라이언트는 재가공하지 않는다

```
{success, data:{type, mode, view, title, sub, meal, updated_at,
                selector:{kind,value,options},
                columns:[{kind,badge,label,dest,value,sub,empty}],
                items:[{kind,badge,label,value,sub}], empty_text}}
```

분 반올림·막차 표기·끼니 선택·영업 판정은 **전부 서버가 끝낸 문자열**이다. 위젯이
스스로 판단하는 건 두 가지뿐:

1. **임박 색** — `value` 가 "곧" 이거나 `N분`에서 N ≤ 5면 accent (`WidgetCommon.isImminent`)
2. **D-day 알약 색** — `D-0`~`D-3`·`D-DAY`·"진행 중"이면 `tj_delayed`, 아니면 `tj_accent`

표기 규칙이 앱과 위젯에서 갈라지면 어느 쪽이 맞는지 사용자가 확인할 방법이 없다.

## 디자인

앱 디자인 시스템(`frontend/DESIGN.md`)의 semantic 토큰을 색 리소스로 1:1 옮겼다.
위젯만의 새 색을 만들지 않는다.

| 역할 | 라이트 | 다크 |
|---|---|---|
| 배경 `tj_bg` | `#FBFDFC` | `#101211` |
| 선 `tj_line` | `#DDE5E1` | `#2A322E` |
| 본문 `tj_ink` | `#17211D` | `#E8EEEB` |
| 보조 `tj_mute` | `#5F7570` | `#93A8A1` |
| 강조 `tj_accent` | `#12A594` | `#0BD8B6` |
| 칩(비선택) `tj_chip` | `#EDF2EF` | `#202623` |
| 칩(선택) `tj_chip_on` | `#DCF3EE` | `#12302A` |
| 칩 글자(선택) `tj_chip_on_ink` | `#0C7C6B` | `#4FE0C6` |
| 임박·마감 `tj_delayed` | `#E5484D` | `#E5484D` |

- 12sp 미만 폰트는 쓰지 않는다(앱 규칙과 동일).
- D-day 알약 글자색은 `@color/tj_bg` — 라이트에선 흰색, 다크에선 검정이 되어
  밝은 accent 채움 위에서도 읽힌다.

## RemoteViews 제약 (여기 코드가 이상해 보이면 대개 이 탓이다)

- 지원 뷰만 쓴다. `ConstraintLayout`·커스텀 뷰·`merge`·`include` 를 못 써서
  세 레이아웃이 각각 자기 줄을 통째로 갖고 있다(공통 행 레이아웃을 뽑을 수 없다).
- 구분선을 `<View>` 가 아니라 `ImageView` 로 그린다. RemoteViews 가 인플레이트를
  허용하는 클래스는 `@RemoteView` 가 붙은 것뿐이고 `android.view.View` 는 없다.
- 런타임에 바꿀 수 있는 건 텍스트·가시성·색·배경 리소스·클릭뿐이다. **폰트 크기·마진·
  패딩은 못 바꾼다.** 그래서 "굵은 메뉴 줄"과 "흐린 나머지 줄"을 TextView 두 개로
  깔아두고 하나만 켠다. 알약 색도 drawable 두 벌을 `setBackgroundResource` 로 교체한다.
- `partiallyUpdateAppWidget` 은 **전체 갱신을 한 번이라도 받은 뒤**에만 먹는다.
  칩 탭의 즉시 반영이 이 API 를 쓰므로, `onUpdate` 는 항상 전체 갱신을 먼저 한다.

## 갱신과 상태

- `updatePeriodMillis=1800000` — 안드로이드가 30분 미만을 무시한다.
- `ACTION_USER_PRESENT`(잠금 해제) — 오레오 이후 암시적 브로드캐스트 제한 탓에
  기기에 따라 안 올 수 있어 보너스로만 기대한다.
- 칩 탭은 늘 재조회를 돌린다 → **같은 칩을 다시 누르면 그게 수동 새로고침**이다.
  학사일정 위젯만 고를 게 없어 ↻ 를 따로 둔다.
- **네트워크가 실패하면 화면을 건드리지 않는다.** 마지막 성공 응답을
  `SharedPreferences("tal_widget")` 에 `payload_<id>` 로 저장해 두고 갱신 시작 시
  그걸로 먼저 그린다(프로세스가 죽었다 살아나도 빈 위젯이 되지 않는다).
- 선택 상태는 위젯 인스턴스별로 `mode_<id>` / `campus_<id>` / `station_<id>` /
  `view_<id>` / `place_<id>`. `onDeleted` 에서 해당 id 의 키를 전부 지운다.
- 칩 탭 PendingIntent 는 `(widgetId, 칩)` 마다 **유일한 requestCode**를 쓴다
  (`WidgetCommon.rc`). PendingIntent 동등성은 extra 를 보지 않아서, requestCode 가
  겹치면 나중 것이 앞의 것을 덮어써 엉뚱한 칩이 눌린 것처럼 동작한다.
- 본문 탭 → 앱 딥링크(교통 `/`, 학식 `/cafeteria`, 학사일정 `/more`). 칩 탭은 앱을
  열지 않는다.

---

## 프로젝트에 넣는 법

1. Bubblewrap으로 안드로이드 프로젝트 생성(`PLAY_STORE_DEPLOY.md` §2).
2. 이 디렉터리의 파일을 대응 경로로 복사:

   | 이 저장소 | 안드로이드 프로젝트 |
   |---|---|
   | `src/*.kt` (4개) | `app/src/main/java/<패키지경로>/` |
   | `res/layout/*.xml` | `app/src/main/res/layout/` |
   | `res/xml/*.xml` | `app/src/main/res/xml/` |
   | `res/values/*.xml` | `app/src/main/res/values/` |
   | `res/values-night/colors.xml` | `app/src/main/res/values-night/` |
   | `res/drawable/*.xml` | `app/src/main/res/drawable/` |

3. **`.kt` 4개의 첫 줄 `package` 를 실제 패키지명으로 바꾼다**
   (예: `kr.ac.tukorea.taljungwang`).
4. 액션 문자열 상수(`WIDGET_SELECT_TRANSIT` / `WIDGET_SELECT_CAFETERIA` /
   `WIDGET_REFRESH_CALENDAR`)의 앞부분도 같은 패키지명으로 맞춘다 —
   **`.kt` 안의 상수와 `manifest-snippet.xml` 의 `<action>` 이 글자 하나까지 같아야**
   칩 탭이 동작한다.
5. `AndroidManifest.xml` 의 `<application>` 안에 `manifest-snippet.xml` 내용을 붙인다.
6. 빌드 후 홈 화면 길게 누르기 → 위젯 → "탈것:정왕 교통/학식/학사일정".

### 확인할 것

- `ContextCompat` 를 쓰므로 `androidx.core` 가 의존성에 있어야 한다
  (Bubblewrap 프로젝트는 `androidx.browser` 를 통해 이미 들어와 있다).
- 딥링크는 `setPackage(packageName)` 으로 우리 앱을 못 박는다. TWA LauncherActivity 에
  `https://www.taljungwang.kr` VIEW 필터가 있어야 본문 탭이 동작한다(Bubblewrap 기본값).
- 도메인을 바꾸면 `WidgetCommon.BASE` 를 함께 고친다.
