# 탈것:정왕 — Play Store(및 앱 마켓) 배포 가이드

PWA를 **TWA(Trusted Web Activity)** 로 패키징해 Google Play에 올리는 절차와 체크리스트.
이 저장소에는 코드로 미리 해둘 수 있는 "사전 작업"이 적용돼 있다(아래 §완료됨 참고).
나머지는 개발자 계정·서명 키·스토어 자료 등 **사람이 직접 해야 하는 단계**다.

---

## ✅ 사전 작업 — 코드에 이미 반영됨

- **manifest 보강** (`frontend/public/manifest.json`): `id`, `scope`, `categories`,
  `dir`, `shortcuts`(시간표/학식/더보기) 추가. 기존 icons(192·512·maskable-512) 유지.
- **개인정보처리방침 페이지**: `/privacy` 라우트 + 더보기 화면 링크.
  - 컴포넌트: `frontend/src/components/more/PrivacyPolicyPage.jsx`, 라우트 래퍼
    `frontend/src/pages/PrivacyPage.jsx`, 분기 `frontend/src/App.jsx`.
  - ⚠️ 방침 내 `[운영자 연락처 이메일]`, `[시행일]` 플레이스홀더를 **제출 전 채울 것**.
- **Digital Asset Links 자리**: `frontend/public/.well-known/assetlinks.json`
  (placeholder). 빌드 후 실제 패키지명·서명 지문으로 교체(아래 §3).
- **광고 정책 정리**: AdSense 자동광고를 `frontend/src/utils/ads.js`에서 **조건부 로드**.
  - 브라우저 탭 → 기존대로 게재 / 설치형 PWA·TWA → 미게재 / `VITE_DISABLE_WEB_ADS=1` 빌드 → 완전 비활성.
  - 인앱 광고가 필요하면 AdSense가 아니라 **AdMob**(앱용 SDK)을 써야 정책 위반이 아니다.

---

## 1. 사전 점검 (PWA 설치 가능성)

- HTTPS 서빙(Vercel) ✅, Service Worker(`sw.js`) ✅, manifest+아이콘 ✅.
- 확인: Chrome DevTools → Lighthouse → "Installable", 또는 https://www.pwabuilder.com 에
  배포 URL 입력 시 PWA 점수/누락 항목 확인.

## 2. TWA 패키지 생성 (둘 중 택1)

- **PWABuilder**(가장 쉬움): pwabuilder.com → URL 입력 → Android 패키지 다운로드.
  서명 키 생성과 `assetlinks.json` 값까지 함께 안내해 준다.
- **Bubblewrap CLI**:
  ```bash
  npm i -g @bubblewrap/cli
  bubblewrap init --manifest https://<도메인>/manifest.json
  bubblewrap build       # → app-release-signed.aab + 서명 키
  ```
  - 패키지명 예: `kr.ac.tukorea.taljungwang` (역도메인, 고정값. 변경 불가하니 신중히).

## 3. Digital Asset Links 채우기 (주소창 제거·도메인 검증)

1. Play Console에 .aab 업로드 후 **앱 서명** 등록 → "앱 서명 키 인증서"의
   **SHA-256 지문** 복사. (Bubblewrap 자체 키를 쓰면 그 키의 SHA-256)
2. `frontend/public/.well-known/assetlinks.json`의 플레이스홀더 교체:
   - `REPLACE_WITH_ANDROID_PACKAGE_NAME` → 실제 패키지명
   - `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` → SHA-256 지문(콜론 포함 대문자)
3. 배포 후 `https://<도메인>/.well-known/assetlinks.json` 가 그대로(JSON) 응답하는지 확인.
   - Vercel은 `public/` 정적 파일을 SPA rewrite보다 우선 서빙하므로 정상 응답된다.
   - 검증: https://developers.google.com/digital-asset-links/tools/generator

## 4. Play Console 등록 자료 (직접 준비)

- [ ] Google Play 개발자 계정($25, 본인 확인)
- [ ] 앱 아이콘 512×512 PNG — `frontend/public/icons/icon-512.png` 재사용 가능
- [ ] 피처 그래픽 1024×500 PNG — **신규 제작 필요**
- [ ] 폰 스크린샷 최소 2장 — **신규 캡처 필요** (manifest `screenshots`에도 추가하면 설치 UI 향상)
- [ ] 개인정보처리방침 URL → `https://<도메인>/privacy`
- [ ] 데이터 보안(Data safety) 양식 — 위치(GPS)·광고/분석 수집 항목 신고
- [ ] 콘텐츠 등급 설문
- [ ] 광고 포함 여부 표시(인앱 광고 사용 시)

## 5. 출시

- 내부 테스트 트랙 → 비공개 테스트 → 프로덕션 순으로 승급 권장.
- 업데이트 시 Android `versionCode` 증가(웹 버전 `__APP_VERSION__`과 별개로 관리).

---

## (선택) iOS App Store

TWA 불가. **Capacitor**(WKWebView 래퍼)로 별도 앱을 만들고 Apple Developer 계정($99/년) 필요.
별도 트랙으로 진행.

## 남은 결정 사항(채워야 할 값)

| 항목 | 위치 | 값 |
|---|---|---|
| Android 패키지명 | Bubblewrap/PWABuilder | (예) `kr.ac.tukorea.taljungwang` |
| 서명 SHA-256 | Play 앱 서명 | assetlinks.json에 반영 |
| 개인정보 연락처/시행일 | `PrivacyPolicyPage.jsx` | `[운영자 연락처 이메일]`, `[시행일]` |
| 피처 그래픽·스크린샷 | Play Console | 디자인 제작 |
