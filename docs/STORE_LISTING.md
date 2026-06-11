# Chrome Web Store — 제출 가이드 & 리스팅 자료 (RoutineTabs v1.0.0)

> 업로드 패키지: `routinetabs-v1.0.0.zip` (프로젝트 루트, `npm run build` 후 `dist/` 내용물 압축. manifest.json이 zip 루트).
> 재생성: `npm run build && (cd dist && zip -rX ../routinetabs-v1.0.0.zip . -x '*.DS_Store')`

---

## 0. 제출 전 체크리스트 (블로커 우선)

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | **개발자 등록 $5**(1회) | ⬜ 사용자 | [Developer Dashboard](https://chrome.google.com/webstore/devconsole)에서 결제 |
| 2 | **이름 "RoutineTabs" 중복/상표 확인** | ⬜ 사용자 | 겹치면 대체명 1~2개 준비 |
| 3 | **개인정보처리방침 공개 URL** | ⬜ 사용자 | `PRIVACY.md`를 공개 Gist/Pages로 호스팅 (아래 §4) |
| 4 | **스크린샷 1~5장** (1280×800 또는 640×400) | ⬜ 사용자 | 실제 브라우저 캡처 필요 |
| 5 | **아이콘 128×128** | ✅ 포함(플레이스홀더) | 실제 아트워크 교체 권장(필수 아님) |
| 6 | (권장) **GitHub Sponsors 활성화** | ⬜ 사용자 | ❤️ 버튼이 404 안 나도록. 핸들 다르면 `SPONSOR_URL` 수정 후 재빌드·재zip |
| 7 | 업로드 zip | ✅ `routinetabs-v1.0.0.zip` | manifest/권한/버전 검증 완료 |

---

## 1. 리스팅 텍스트 (복사용)

**Item name (≤45자)**
```
RoutineTabs
```

**Summary / 짧은 설명 (≤132자)**
```
Open your daily tab sets automatically on a weekly schedule. Reliable and DST-safe, completely free, with minimal permissions.
```

**Detailed description**
```
RoutineTabs opens the tabs you use every day — automatically, on the schedule you set.

Set up a routine once (e.g. "Mon–Fri at 9:00 AM: Gmail + Calendar + your dashboard")
and RoutineTabs opens that exact tab set for you at the right time, every time.

Why RoutineTabs
• Reliable by design — correct around Daylight Saving Time, and "off" really means off.
• Catch-up — if your browser was closed at the scheduled time, it can open the missed
  routine when you reopen Chrome (within a grace window you control).
• Minimal permissions — only "alarms" and "storage". It never reads your browsing data.
• Completely free — every feature is unlocked. No subscription, no paywall.
• English / 한국어 — switch the language anytime with one click.
• Private — your routines stay on your device. No accounts, no tracking, no servers.

Great for remote workers and anyone who starts the day with the same set of tools.

RoutineTabs is free. If it saves you time, you can optionally support development via
GitHub Sponsors — but nothing is locked behind it.
```

**Category**: `Workflow & Planning` (대안: Productivity)
**Language**: English (기본). 한국어 UI 내장 토글 있음.

---

## 2. Privacy practices 탭 (대시보드 입력값)

**Single purpose (단일 목적)**
```
RoutineTabs automatically opens a user-defined set of tabs at scheduled days and times.
```

**Permission justifications**
- `alarms`:
  ```
  Used to trigger the user's routines at the day and time they scheduled.
  ```
- `storage`:
  ```
  Used to save the user's routines and settings locally on their device.
  ```
- Host permissions: **없음** (요청 안 함)

**Are you using remote code?** → **No** (모든 코드가 패키지에 포함, 원격 실행 없음)

**Data usage (데이터 수집/사용 신고)**
- 수집·전송하는 사용자 데이터: **없음**. (루틴/설정은 `chrome.storage.local`에만 저장, 외부 전송 없음)
- 판매·제3자 공유: 없음. / 신용 목적 외 사용: 없음.
- 세 가지 인증 체크박스(데이터를 승인된 용도 외 사용 안 함 / 판매 안 함 / 신용도 판단에 사용 안 함) **모두 체크**.

**Privacy policy URL**: (아래 §4에서 호스팅한 공개 URL 입력)

---

## 3. 권한이 적어 심사가 단순함
- 요청 권한: `alarms`, `storage` 뿐. `tabs`/host permission 없음 → 민감 권한 검토 대상 아님.
- 원격 코드 없음, 데이터 수집 없음 → 심사 리스크 낮음(보통 수 시간~수일).

---

## 4. 개인정보처리방침 공개 URL 만들기 (repo가 비공개라 별도 호스팅 필요)
택1:
- **GitHub Gist(가장 빠름)**: `PRIVACY.md` 내용을 public Gist로 붙여넣고 그 URL 사용.
- **GitHub Pages**: 공개 repo/Pages에 올려 URL 사용.
- ⚠️ 게시 전 `PRIVACY.md`의 `<your-contact-email>`를 실제 연락 이메일로 교체.

---

## 5. 제출 단계 (순서대로)
1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole) 접속 → **개발자 등록 $5** 결제(최초 1회).
2. (권장) <https://github.com/sponsors>에서 Sponsors 활성화. 핸들이 `zzaisang`이 아니면 `src/lib/sponsor.ts`의 `SPONSOR_URL` 수정 → `npm run build` → zip 재생성.
3. `PRIVACY.md` 공개 URL 준비(§4).
4. 대시보드 → **New item** → `routinetabs-v1.0.0.zip` 업로드.
5. **Store listing** 탭: 위 §1의 이름/요약/설명/카테고리/언어 입력 + **스크린샷 1~5장** + 128 아이콘 확인.
6. **Privacy practices** 탭: §2 값 입력(단일목적/권한사유/원격코드 No/데이터 신고/정책 URL).
7. **Distribution**: 공개 범위(Public 또는 Unlisted) 선택.
8. **Submit for review** 제출 → 심사 대기.

---

## 6. 출시 후/선택 개선
- 플레이스홀더 아이콘 → 실제 아트워크 교체(`public/icons/` 16/32/48/128 동일 파일명) 후 버전 올려 재업로드.
- 데모 GIF/프로모 타일(440×280) 추가로 전환율↑.
- 1위 경쟁자 부정 리뷰층(구독 반발·DST 버그) 타깃으로 r/productivity 등에 공유.
