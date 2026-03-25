# SIBOT

시봇(SIBOT)은 Windows 스트리머를 위한 실시간 방송 보조 데스크톱 앱 MVP다.  
목표는 "진지한 코칭 툴"이 아니라, 게임 장면을 보고 짧고 빠르게 긁고, 필요하면 약하게 비방하고, 발화 직후엔 짧게 대화를 받아치는 AI 캐릭터 런타임을 만드는 것이다.

현재 버전은 Electron + React + TypeScript 기반 초기 구현이며, 다음 흐름이 실제로 동작한다.

- Electron 앱 실행
- 설정 JSON 저장 / 복원
- 실행 중인 프로세스 + 활성 창 제목 기반 게임 감지
- debug/mock fallback 게임 감지
- 분석 시작 / 중지
- mock 이벤트 주기 발생
- 화면 캡처 기반 간이 실시간 분석 베타
- 이벤트 기반 시비 멘트 생성
- 앱 오버레이 창 출력
- OBS Browser Source용 로컬 overlay URL 제공
- 시스템 TTS 출력
- Web Speech API 기반 라이브 음성 인식 베타
- 자동 청취 윈도우 상태 머신
- 테스트 질문 입력 기반 짧은 답변 생성
- GitHub Release 기반 업데이트 확인
- 로그 패널과 상태 JSON 확인

고정밀 STT/CV/OCR과 상용급 자동 업데이트 설치는 아직 아니지만, 실제 시스템 기능을 일부 사용하는 베타 기능까지 포함한 형태다.

## 왜 이런 구조인가

SIBOT은 UI와 로직이 강하게 분리되어야 한다.

- Electron main: 앱 생명주기, 설정 저장, IPC, 오버레이 윈도우, 런타임 인스턴스 관리
- Renderer: 설정 화면, 로그 패널, 테스트 액션, 상태 시각화
- Core runtime: 감지, 이벤트 버스, 발화 엔진, 대화 메모리, 청취 상태 머신
- Package layers: 설정 스키마, 게임 프로필, 감지기, 이벤트 큐, 음성 인터페이스를 독립 모듈로 유지

이 구조를 택한 이유는 다음과 같다.

- macOS에서 개발하면서도 Windows 런타임 중심 기능을 깔끔하게 분리할 수 있다.
- MVP는 mock 기반으로 빨리 형태를 만들고, 이후 Windows 전용 구현을 부분 교체하기 쉽다.
- 게임별 룰셋, STT/TTS provider, OCR/CV 엔진을 교체해도 UI를 거의 안 건드릴 수 있다.

## 현재 구현 상태

### 실제 구현됨

- Electron main/preload/renderer/overlay 4계층 연결
- React 대시보드와 탭 기반 설정 UI
- `zod` 기반 설정 스키마와 JSON persistence
- `systeminformation` + OS별 활성 창 조회 기반 게임 감지 구조
- `SibotRuntime` 상태 머신
- 이벤트 큐 / 이벤트 쿨다운 / 발화 중복 회피
- 캐릭터별 템플릿 세트
- 비방 라이트 모드와 욕설 간격 제어
- 자동 청취 / 후속 청취 창 관리
- 최근 이벤트 / 최근 발화 / 최근 질문 메모리
- 투명 Electron 오버레이 창
- OBS Browser Source용 로컬 HTTP overlay endpoint
- Windows `System.Speech` / macOS `say` 기반 시스템 TTS
- Web Speech API 기반 라이브 음성 인식 베타
- Electron `desktopCapturer` 기반 화면 소스 선택 및 간이 분석 베타
- GitHub Release 최신 버전 확인 및 exe 다운로드 링크 오픈

### mock / stub 상태

- 전용 로컬 웨이크워드 엔진
- 게임별 HUD 정밀 OCR/CV 분석
- 상용급 STT provider 교체
- 자동 업데이트 설치/패치 적용
- OBS WebSocket 고도화

현재는 이 부분들을 provider interface와 구조로 열어 두고, mock implementation으로 UI와 상태 흐름을 먼저 검증한다.

## 폴더 구조

```text
SIBOT/
├─ apps/
│  └─ desktop/
│     ├─ index.html
│     ├─ overlay.html
│     └─ src/
│        ├─ main/
│        │  ├─ index.ts
│        │  ├─ obsOverlayServer.ts
│        │  └─ settingsStore.ts
│        │  └─ updateManager.ts
│        ├─ preload/
│        │  └─ index.ts
│        ├─ renderer/
│        │  ├─ App.tsx
│        │  ├─ main.tsx
│        │  ├─ sibot.d.ts
│        │  ├─ useCaptureAnalysis.ts
│        │  ├─ useLiveVoice.ts
│        │  ├─ useSibotRuntime.ts
│        │  ├─ components/
│        │  │  ├─ OverlayPreview.tsx
│        │  │  ├─ SectionCard.tsx
│        │  │  └─ StatusPill.tsx
│        │  └─ styles/
│        │     └─ app.css
│        └─ overlay/
│           ├─ App.tsx
│           ├─ main.tsx
│           └─ overlay.css
├─ packages/
│  ├─ config/
│  │  └─ src/
│  │     ├─ defaults.ts
│  │     ├─ index.ts
│  │     └─ schema.ts
│  ├─ core/
│  │  └─ src/
│  │     ├─ analysis/mockAnalyzer.ts
│  │     ├─ runtime/
│  │     │  ├─ memory.ts
│  │     │  └─ SibotRuntime.ts
│  │     └─ utterance/
│  │        ├─ engine.ts
│  │        └─ templates.ts
│  ├─ event-engine/
│  │  └─ src/
│  │     ├─ cooldown.ts
│  │     ├─ index.ts
│  │     └─ priorityQueue.ts
│  ├─ game-detectors/
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ profiles.ts
│  │     └─ service.ts
│  ├─ shared/
│  │  └─ src/
│  │     ├─ constants.ts
│  │     ├─ index.ts
│  │     ├─ types.ts
│  │     └─ utils.ts
│  └─ speech/
│     └─ src/
│        ├─ index.ts
│        ├─ types.ts
│        └─ providers/
│           ├─ mockSTT.ts
│           ├─ mockTTS.ts
│           └─ mockWakeWord.ts
│           └─ systemTTS.ts
├─ examples/
│  └─ sibot.settings.example.json
├─ electron.vite.config.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

## 아키텍처 개요

### 1. Electron Main

`apps/desktop/src/main/index.ts`

- BrowserWindow 생성
- overlay window 생성 / 위치 제어
- OBS browser source용 로컬 overlay 서버 구동
- GitHub Release 업데이트 상태 조회
- 설정 파일 로드
- `SibotRuntime` 인스턴스 생성
- IPC 핸들러 등록
- runtime snapshot을 renderer와 overlay로 브로드캐스트

### 2. Renderer

`apps/desktop/src/renderer/App.tsx`

- 메인 대시보드
- 캐릭터 / 오버레이 / 음성 / 게임 / 로그 탭
- mock 이벤트 주입
- 웨이크워드 시뮬레이션
- 질문 입력 테스트
- 라이브 음성 인식 시작 / 중지
- 화면 캡처 분석 시작 / 중지
- OBS 브라우저 소스 URL 복사
- 업데이트 확인 및 최신 exe 링크 열기
- 상태 JSON 시각화

### 3. Core Runtime

`packages/core/src/runtime/SibotRuntime.ts`

- 게임 감지 polling
- 분석 시작 / 중지
- mock analyzer 이벤트 처리
- 발화 생성
- 최근 메모리 관리
- 자동 청취 / 후속 청취 상태 관리
- 로그 적재

### 4. Event Analysis Layer

현재는 `MockAnalysisEngine`과 renderer 기반 `desktopCapturer` 휴리스틱 분석을 함께 사용한다.

- 10~18초 간격으로 mock 이벤트 발생
- 수동 inject 버튼으로 특정 이벤트 강제 발생 가능
- 실시간 화면 프레임 변화량 기반 간이 이벤트 주입 가능
- 이벤트 메타데이터 / severity / cooldownGroup / priorityScore 생성

향후 이 레이어를 실제 화면 캡처 기반 분석기로 교체하면 된다.

### 5. Utterance Engine

`packages/core/src/utterance/engine.ts`

- 이벤트 카테고리별 템플릿 선택
- 모드별 템플릿 분기
- 최근 발화 중복 회피
- 욕설 연속 발화 방지
- 욕설 최소 간격 제어
- 질문 유형 분류 후 짧은 답변 생성

### 6. Speech Layer

`packages/speech/src/types.ts`

- `STTProvider`
- `TTSProvider`
- `WakeWordProvider`

현재 TTS는 시스템 provider를 사용하고, STT는 renderer의 Web Speech API 베타를 쓴다.  
전용 Windows용 STT/TTS/wakeword 엔진으로 교체할 때 runtime 코어를 갈아엎을 필요가 없도록 인터페이스를 먼저 고정했다.

## 설정 스키마

설정은 Electron userData 경로 아래 JSON 파일로 저장된다.

- Windows 예시: `%APPDATA%/SIBOT/...`
- macOS dev 예시: `~/Library/Application Support/SIBOT/...`

주요 필드:

- `aiName`
- `wakeWords`
- `mode`
- `profanityEnabled`
- `profanityLevel`
- `profanityMinimumIntervalMs`
- `adlibEnabled`
- `adlibFrequency`
- `overlayEnabled`
- `overlayMode`
- `overlayStyle`
- `overlayPosition`
- `overlayDurationMs`
- `overlayHistoryCount`
- `obsOverlayPort`
- `ttsEnabled`
- `ttsVolume`
- `ttsRate`
- `microphoneDeviceId`
- `wakeWordEnabled`
- `autoListenAfterSpeak`
- `autoListenDurationMs`
- `followupListenDurationMs`
- `maxConversationTurns`
- `autoStartOnGameDetected`
- `selectedGameProfile`
- `captureSourceId`
- `captureAnalysisEnabled`
- `captureSampleIntervalMs`
- `eventCooldownMs`
- `debugMode`

예시 파일은 [examples/sibot.settings.example.json](examples/sibot.settings.example.json)에 있다.

## 지원 게임 감지

현재 프로필:

- Overwatch 2
- VALORANT
- PUBG
- League of Legends

감지 방식:

1. `systeminformation.processes()`로 실행 중 프로세스 조회
2. Windows는 PowerShell, macOS는 `osascript`로 활성 창 제목 + foreground process 확인
3. `processNames` / `windowTitleHints` 매칭
4. 실제 감지가 없고 `debugMode = true`면 선택된 프로필로 mock fallback

즉, macOS에서도 디버그 모드로 UI와 런타임 흐름을 볼 수 있고, Windows에선 실제 프로세스 감지 구조를 그대로 사용한다.

## 오버레이 구조

현재 구현된 오버레이는 Electron transparent window 기반이다.

- 항상 위(always-on-top)
- 클릭 스루(ignore mouse events)
- 최근 발화만 표시
- `overlayDurationMs`가 지나면 자동 숨김
- `bubble`, `chat`, `subtitle` 3가지 스타일

OBS Browser Source 모드는 현재 로컬 HTTP endpoint로 동작한다.  
기본 주소는 다음 형태다.

```text
http://127.0.0.1:43115/overlay
```

포트는 설정에서 변경할 수 있다.

이후 고도화 방향은 다음과 같다.

- Electron 내부 로컬 HTTP 서버 추가
- WebSocket + 별도 overlay 웹앱 제공
- `overlay.html`을 standalone local web bundle로 호스팅

## macOS 개발 방법

### 요구사항

- Node.js 20+ 권장
- npm 10+ 또는 pnpm
- VSCode

### 설치

```bash
npm install
```

### 타입 체크

```bash
npm run typecheck
```

### 빌드 검증

```bash
npm run build
```

### 개발 실행

```bash
npm run dev
```

주의:

- macOS에서 `osascript` 기반 활성 창 조회는 접근성 권한이 필요할 수 있다.
- 화면 캡처 분석을 쓰려면 시스템 화면 녹화 권한이 필요할 수 있다.
- 라이브 음성 인식을 쓰려면 마이크 권한이 필요할 수 있다.
- 권한이 없거나 지원 게임이 없으면 `debugMode` fallback으로 mock 게임이 감지된다.
- 이 저장소에서는 GUI 세션이 없는 환경에서 `npm run dev`를 실제 실행하진 않았다. 대신 `typecheck`와 `build`는 성공 확인했다.

## Windows 실행 / 빌드 방법

실제 exe 패키징은 Windows에서 수행하는 것을 권장한다.

### 1. 저장소 가져오기

```bash
git clone <repo>
cd SIBOT
npm install
```

### 2. 개발 실행

```bash
npm run dev
```

### 3. 프로덕션 번들 검증

```bash
npm run build
```

### 4. Windows 설치 파일 생성

```bash
npm run package:win
```

생성 결과물:

- `release/SIBOT-<version>-setup.exe`

설명:

- macOS에서도 renderer/main/preload 번들은 빌드할 수 있다.
- 하지만 Windows용 NSIS 설치 파일은 Windows에서 만드는 흐름이 가장 단순하고 안정적이다.

## GitHub Release로 exe 배포하기

이 저장소에는 [`.github/workflows/release-windows.yml`](/Users/macbookairm4/Library/Mobile%20Documents/com~apple~CloudDocs/Desktop/01_Project/SIBOT/.github/workflows/release-windows.yml) 워크플로가 포함되어 있다.

동작 방식:

- `v*` 형식 태그를 푸시하면 GitHub Actions가 `windows-latest`에서 빌드
- `npm ci` -> `npm run typecheck` -> `npm run package:win`
- 생성된 `release/*.exe`를 GitHub Release asset으로 업로드

권장 흐름:

1. 원하는 커밋 메시지로 커밋
2. `v0.1.0` 같은 태그 생성
3. 태그 푸시
4. GitHub Releases에서 `.exe` 다운로드

예시:

```bash
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

또는 GitHub Actions 탭에서 `Release Windows Build`를 수동 실행하고 `release_tag`를 넣어도 된다.

앱 내부에서도 GitHub Release 최신 버전을 확인하고, 최신 `.exe` 다운로드 링크를 열 수 있다.

## Mock 모드 데모 시나리오

앱을 처음 띄운 뒤 아래 순서로 테스트하면 된다.

1. 앱 실행
2. `게임/감지` 탭에서 원하는 `선택 게임 프로필` 선택
3. `디버그 감지`가 켜져 있는지 확인
4. `대시보드`에서 `분석 시작` 클릭
5. 10~18초마다 mock 이벤트가 들어오고 발화가 생성되는지 확인
6. `Mock 이벤트` 버튼으로 즉시 이벤트 주입
7. `웨이크워드 시뮬레이션` 버튼으로 자동 청취 창 열기
8. 질문 입력창에 `왜 내 잘못인데`, `어떻게 해야 돼` 같은 테스트 질문 입력
9. `음성/청취` 탭에서 라이브 음성 인식 시작
10. `게임/감지` 탭에서 캡처 소스 선택 후 캡처 분석 시작
11. `오버레이` 탭에서 OBS URL 복사 후 브라우저나 OBS에 붙이기
12. 앱 재실행 후 설정 유지 확인

## 실제 게임 감지 구조 설명

현재는 룰 기반 감지 구조만 마련되어 있다.

- `GameDetectionService.resolveGameProfile()`
- `GameDetectionService.detectRunningGames()`
- `GameDetectionService.getActiveGame()`

추후 Windows 전용 고도화 방향:

- `tasklist` / Win32 window enumeration 추가
- 활성 창 핸들 기반 더 정확한 exe/title 매칭
- 관리자 권한 상황 처리
- DirectX capture / desktop duplication API 연동

## 실제 이벤트 분석 확장 방법

현재 `MockAnalysisEngine`은 다음 역할을 대신한다.

- 이벤트 발생 타이밍
- severity
- contextSummary
- priorityScore
- cooldownGroup

이후 다음 레이어를 순서대로 붙이면 된다.

1. 화면 캡처 provider
2. ROI(HUD/킬로그/체력바/궁극기/크로스헤어) 추출
3. OCR 또는 pixel/rule detector
4. 게임별 ruleset
5. 이벤트 추론 결과를 `AnalysisEvent`로 변환

바꿔야 할 핵심 포인트는 사실상 `packages/core/src/analysis/` 쪽뿐이다.

## 실제 STT / TTS / Wake Word 확장 방법

현재 인터페이스:

- `STTProvider`
- `TTSProvider`
- `WakeWordProvider`

추천 확장 방향:

- STT: Whisper.cpp / faster-whisper sidecar / Azure / Deepgram / Google
- TTS: 현재는 Windows SAPI 계열(System.Speech) / macOS `say`, 이후 Azure / ElevenLabs / Edge TTS
- Wake Word: Porcupine / openWakeWord / local keyword spotter

교체 방식:

1. `packages/speech/src/providers/`에 실제 provider 추가
2. `SibotRuntime` 생성 시 mock provider 대신 실제 provider 주입
3. renderer 설정값으로 provider-specific config 전달

## 게임별 룰셋 확장

현재 프로필 데이터는 [packages/game-detectors/src/profiles.ts](packages/game-detectors/src/profiles.ts)에 있다.

게임을 추가하려면:

1. `GameId` union 확장
2. `GAME_PROFILES`에 프로세스명 / 창 제목 힌트 추가
3. 해당 게임 전용 이벤트 타입 추가
4. 발화 템플릿 추가
5. 실제 분석 ruleset 추가

## Auto Update 현황과 확장 포인트

현재는 다음 수준까지 구현했다.

- GitHub Releases 최신 버전 확인
- 최신 버전/현재 버전 비교
- 최신 `.exe` 다운로드 링크 열기
- renderer에 업데이트 상태 브리지

아직 자동 설치형은 아니다.  
완전한 auto update로 가려면 다음 순서가 필요하다.

1. `electron-updater` 추가
2. NSIS differential update metadata 연결
3. 다운로드 진행률 및 재시작 설치 흐름 추가
4. stable/beta 채널 분기

## 주요 스크립트

```bash
npm install
npm run typecheck
npm run build
npm run dev
npm run package:dir
npm run package:win
```

## 검증 상태

이 저장소에서 직접 확인한 항목:

- `npm install` 성공
- `npm run typecheck` 성공
- `npm run build` 성공

아직 이 환경에서 확인하지 못한 항목:

- GUI 세션에서 `npm run dev`
- Windows에서 실제 exe 설치 후 실행
- 실제 STT/TTS 출력
- 실제 오버워치 2 / 발로란트 프로세스 감지

## 다음 추천 작업

우선순위 높은 다음 단계는 이렇다.

1. Windows에서 `npm run dev`로 실제 창 / 오버레이 확인
2. `say` 또는 Windows SAPI 기반 실제 TTS provider 연결
3. 간단한 화면 캡처 + ROI detector 추가
4. Overwatch 2 전용 ruleset 1차 구현
5. OBS browser source용 local overlay server 추가
