# 탈것:정왕 — 안드로이드 홈 위젯

TWA(Bubblewrap/PWABuilder)로 생성한 안드로이드 프로젝트에 **그대로 복사해 넣는**
홈 화면 위젯 소스다. 위젯은 웹뷰를 띄우지 않고 `GET /api/v1/widget` 한 번만
호출해 텍스트를 그린다 — 앱을 열지 않고도 "다음 셔틀 몇 분"을 본다.

---

## 디자인

앱 디자인 시스템(`frontend/DESIGN.md`)의 semantic 토큰을 안드로이드 색 리소스로
1:1 옮겼다. 위젯만의 새 색을 만들지 않는다.

| 역할 | 라이트 | 다크 | 앱 토큰 |
|---|---|---|---|
| 배경 | `#FBFDFC` | `#101211` | `--tj-bg` |
| 카드/구분선 | `#DDE5E1` | `#2A322E` | `--tj-line` |
| 본문 | `#17211D` | `#E8EEEB` | `--tj-ink` |
| 보조 | `#5F7570` | `#93A8A1` | `--tj-mute` |
| 강조(임박) | `#12A594` | `#0BD8B6` | `--tj-accent` |

### 레이아웃

```
┌─ 4×1 (compact) ───────────────────────────────┐
│  셔      셔틀 등교              4분           │   ← 배지 + 라벨 + 값(우측 정렬)
│          08:41 · 막차           22:31 갱신    │
└───────────────────────────────────────────────┘

┌─ 4×2 (full) ──────────────────────────────────┐
│  탈것:정왕 · 등교                  ↻          │   ← 헤더(방향 + 새로고침)
│  ─────────────────────────────────────────    │
│  셔  셔틀 등교        08:41 · 막차     4분    │
│  버  20-1             아이파크아파트   7분    │
│  철  정왕역           왕십리 방면      9분    │
│                                   22:31 갱신  │
└───────────────────────────────────────────────┘
```

- 값(분)은 `tabular-nums` 대응으로 우측 정렬 고정폭. 5분 이하는 accent 색.
- 행은 최대 3줄. 데이터가 없는 줄은 서버가 아예 안 보내므로 위젯은 있는 것만 그린다.
- 전체가 비면 `empty_text`("지금은 운행 정보가 없어요") 한 줄.
- 탭: 행 아무 곳 → 앱 열기(`?commute=up|down` 딥링크로 방향 유지), ↻ → 즉시 갱신.

### 갱신 주기

- `updatePeriodMillis`는 안드로이드 최소값이 30분이라 그걸 기본으로 둔다.
- 화면을 켜고 위젯을 볼 때가 진짜 필요한 순간이므로, `ACTION_USER_PRESENT`
  브로드캐스트와 수동 ↻ 탭에서도 갱신한다(배터리 영향 없이 체감 신선도 확보).

---

## 프로젝트에 넣는 법

1. Bubblewrap으로 안드로이드 프로젝트 생성(`PLAY_STORE_DEPLOY.md` §2).
2. 이 디렉터리의 파일을 대응 경로로 복사:

   | 이 저장소 | 안드로이드 프로젝트 |
   |---|---|
   | `src/TalWidgetProvider.kt` | `app/src/main/java/<패키지경로>/TalWidgetProvider.kt` |
   | `res/layout/*.xml` | `app/src/main/res/layout/` |
   | `res/xml/*.xml` | `app/src/main/res/xml/` |
   | `res/values/*.xml` | `app/src/main/res/values/` |
   | `res/values-night/colors.xml` | `app/src/main/res/values-night/` |
   | `res/drawable/*.xml` | `app/src/main/res/drawable/` |

3. `TalWidgetProvider.kt` 첫 줄의 `package` 를 실제 패키지명으로 바꾼다
   (예: `kr.ac.tukorea.taljungwang`).
4. `AndroidManifest.xml`의 `<application>` 안에 `manifest-snippet.xml` 내용을 붙인다.
5. 빌드 후 홈 화면 길게 누르기 → 위젯 → "탈것:정왕".

## 주의

- 위젯은 크래시해도 사용자에게 원인이 안 보인다. 그래서 파싱은 방어적으로 짜고
  (`optString`/`optJSONArray`), 실패 시 마지막 성공 값을 그대로 남긴다.
- 네트워크는 `INTERNET` 권한만 필요하다(TWA에 이미 있음).
