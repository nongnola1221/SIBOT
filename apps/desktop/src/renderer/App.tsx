import { useEffect, useMemo, useState } from "react";
import { GAME_PROFILES } from "@sibot/game-profiles";
import {
  EVENT_LABELS,
  MODE_LABELS,
  SPEECH_STATUS_LABELS,
  formatClockTime,
  type RuntimeSnapshot,
  type UpdateStatus,
  type UserSettings
} from "@sibot/shared";
import { OverlayPreview } from "./components/OverlayPreview";
import { SectionCard } from "./components/SectionCard";
import { StatusPill } from "./components/StatusPill";
import { useCaptureAnalysis } from "./useCaptureAnalysis";
import { useLiveVoice } from "./useLiveVoice";
import { useSibotRuntime } from "./useSibotRuntime";

type TabId = "dashboard" | "character" | "overlay" | "speech" | "game" | "logs";

const tabs: Array<{ id: TabId; label: string; hint: string }> = [
  { id: "dashboard", label: "대시보드", hint: "실시간 상태와 테스트 액션" },
  { id: "character", label: "캐릭터", hint: "이름, 말투, 웨이크워드" },
  { id: "overlay", label: "오버레이", hint: "위치, 스타일, 미리보기" },
  { id: "speech", label: "음성/청취", hint: "TTS, 청취 윈도우, 대화 턴" },
  { id: "game", label: "게임/감지", hint: "감지 대상과 분석 민감도" },
  { id: "logs", label: "로그/디버그", hint: "최근 로그와 상태 JSON" }
];

const ToggleField = ({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="field field--toggle">
    <div className="field__meta">
      <span className="field__label">{label}</span>
      <span className="field__description">{description}</span>
    </div>
    <input
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      type="checkbox"
    />
  </label>
);

const RangeField = ({
  label,
  description,
  min,
  max,
  step,
  value,
  formatValue,
  onChange
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
}) => (
  <label className="field">
    <div className="field__meta">
      <span className="field__label">{label}</span>
      <span className="field__description">{description}</span>
    </div>
    <div className="range-field">
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <span className="range-field__value">
        {formatValue ? formatValue(value) : value.toString()}
      </span>
    </div>
  </label>
);

const TextField = ({
  label,
  description,
  value,
  onChange
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="field">
    <div className="field__meta">
      <span className="field__label">{label}</span>
      <span className="field__description">{description}</span>
    </div>
    <input value={value} onChange={(event) => onChange(event.target.value)} type="text" />
  </label>
);

const SelectField = <T extends string>({
  label,
  description,
  value,
  options,
  onChange
}: {
  label: string;
  description: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) => (
  <label className="field">
    <div className="field__meta">
      <span className="field__label">{label}</span>
      <span className="field__description">{description}</span>
    </div>
    <select value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const StatusGrid = ({ snapshot }: { snapshot: RuntimeSnapshot }) => {
  const activeGame = snapshot.detectedGame?.profile?.name ?? "없음";
  const detectionSource = snapshot.detectedGame?.source ?? "inactive";
  const lastEvent = snapshot.recentEvents[0];
  const lastUtterance = snapshot.recentUtterances[0];

  return (
    <div className="status-grid">
      <div className="status-grid__item">
        <span className="status-grid__label">감지된 게임</span>
        <strong>{activeGame}</strong>
        <small>{detectionSource}</small>
      </div>
      <div className="status-grid__item">
        <span className="status-grid__label">앱 상태</span>
        <strong>{snapshot.appStatus}</strong>
        <small>{snapshot.analysisStatus}</small>
      </div>
      <div className="status-grid__item">
        <span className="status-grid__label">AI 이름</span>
        <strong>{snapshot.settings.aiName}</strong>
        <small>{MODE_LABELS[snapshot.settings.mode]}</small>
      </div>
      <div className="status-grid__item">
        <span className="status-grid__label">청취 상태</span>
        <strong>{SPEECH_STATUS_LABELS[snapshot.speechStatus]}</strong>
        <small>
          {snapshot.activeListenWindow
            ? `${Math.ceil(snapshot.activeListenWindow.remainingMs / 1000)}초 남음`
            : "웨이크워드 대기"}
        </small>
      </div>
      <div className="status-grid__item">
        <span className="status-grid__label">오버레이</span>
        <strong>{snapshot.isOverlayVisible ? "ON" : "OFF"}</strong>
        <small>{snapshot.settings.overlayMode}</small>
      </div>
      <div className="status-grid__item">
        <span className="status-grid__label">TTS 상태</span>
        <strong>{snapshot.ttsStatus}</strong>
        <small>{snapshot.settings.ttsEnabled ? "활성" : "비활성"}</small>
      </div>
      <div className="status-grid__item">
        <span className="status-grid__label">마이크 상태</span>
        <strong>{snapshot.microphoneStatus}</strong>
        <small>{snapshot.settings.microphoneDeviceId}</small>
      </div>
      <div className="status-grid__item">
        <span className="status-grid__label">웨이크워드</span>
        <strong>{snapshot.settings.wakeWordEnabled ? "ON" : "OFF"}</strong>
        <small>{snapshot.settings.wakeWords[0] ?? "없음"}</small>
      </div>
      <div className="status-grid__item status-grid__item--wide">
        <span className="status-grid__label">마지막 이벤트</span>
        <strong>{lastEvent ? EVENT_LABELS[lastEvent.type] : "아직 없음"}</strong>
        <small>{lastEvent?.contextSummary ?? "분석 시작 후 이벤트 대기"}</small>
      </div>
      <div className="status-grid__item status-grid__item--wide">
        <span className="status-grid__label">마지막 발화</span>
        <strong>{lastUtterance ? lastUtterance.text : "아직 없음"}</strong>
        <small>
          {lastUtterance ? `${lastUtterance.type} · ${lastUtterance.mode}` : "멘트 대기"}
        </small>
      </div>
    </div>
  );
};

const formatBytes = (value?: number) => {
  if (!value) {
    return "0MB";
  }

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)}MB`;
  }

  return `${Math.round(value / 1024)}KB`;
};

const RuntimeFallback = ({
  bridgeAvailable,
  connectionPhase,
  connectionMessage,
  updateStatus,
  retryConnection,
  checkForUpdates,
  downloadUpdate,
  installUpdate
}: {
  bridgeAvailable: boolean;
  connectionPhase: string;
  connectionMessage: string;
  updateStatus: UpdateStatus | null;
  retryConnection: () => Promise<RuntimeSnapshot | null>;
  checkForUpdates: () => Promise<UpdateStatus | null>;
  downloadUpdate: () => Promise<UpdateStatus | null>;
  installUpdate: () => Promise<boolean>;
}) => (
  <div className="fatal-shell">
    <div className="fatal-shell__card">
      <p className="brand-block__eyebrow">STARTUP DIAGNOSTICS</p>
      <h1>SIBOT 화면 연결 상태를 확인 중입니다.</h1>
      <p className="field__description">{connectionMessage}</p>

      <div className="detail-grid">
        <div>
          <span>브리지 상태</span>
          <strong>{bridgeAvailable ? "연결됨" : "없음"}</strong>
        </div>
        <div>
          <span>연결 단계</span>
          <strong>{connectionPhase}</strong>
        </div>
        <div>
          <span>업데이트 상태</span>
          <strong>{updateStatus?.phase ?? "idle"}</strong>
        </div>
        <div>
          <span>설치 준비</span>
          <strong>{updateStatus?.latestVersion ?? "없음"}</strong>
        </div>
      </div>

      <div className="button-row">
        <button className="button button--primary" onClick={() => void retryConnection()} type="button">
          다시 연결
        </button>
        <button className="button" onClick={() => void checkForUpdates()} type="button">
          업데이트 확인
        </button>
        {updateStatus?.phase === "update-available" ? (
          <button className="button" onClick={() => void downloadUpdate()} type="button">
            업데이트 다운로드
          </button>
        ) : null}
        {updateStatus?.phase === "downloaded" ? (
          <button className="button" onClick={() => void installUpdate()} type="button">
            설치 파일 실행
          </button>
        ) : null}
      </div>

      <div className="info-panel">
        <p className="info-panel__primary">첫 실행 체크 포인트</p>
        <p className="field__description">
          앱 창이 비어 보이면 preload 브리지나 런타임 초기화가 늦은 경우가 많습니다.
          위의 재연결 버튼으로 다시 붙고, 업데이트가 있으면 앱 안에서 바로 설치 파일을 받을 수 있습니다.
        </p>
      </div>
    </div>
  </div>
);

export const App = () => {
  const {
    bridgeAvailable,
    connectionPhase,
    connectionMessage,
    snapshot,
    updateStatus,
    retryConnection,
    sendCommand,
    updateSettings,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    openExternal
  } = useSibotRuntime();
  const liveVoice = useLiveVoice();
  const captureAnalysis = useCaptureAnalysis();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [questionInput, setQuestionInput] = useState("");
  const [wakeWordDraft, setWakeWordDraft] = useState("");
  const [obsCopied, setObsCopied] = useState(false);

  const selectedProfile = useMemo(
    () => GAME_PROFILES.find((profile) => profile.id === snapshot?.settings.selectedGameProfile),
    [snapshot?.settings.selectedGameProfile]
  );

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const settings = snapshot.settings;

    if (
      settings.captureAnalysisEnabled &&
      settings.captureSourceId &&
      !captureAnalysis.active
    ) {
      void captureAnalysis.start(settings.captureSourceId, settings.captureSampleIntervalMs);
    }

    if (!settings.captureAnalysisEnabled && captureAnalysis.active) {
      captureAnalysis.stop();
    }
  }, [
    captureAnalysis,
    snapshot?.settings.captureAnalysisEnabled,
    snapshot?.settings.captureSampleIntervalMs,
    snapshot?.settings.captureSourceId,
    snapshot
  ]);

  if (!snapshot) {
    return (
      <RuntimeFallback
        bridgeAvailable={bridgeAvailable}
        checkForUpdates={checkForUpdates}
        connectionMessage={connectionMessage}
        connectionPhase={connectionPhase}
        downloadUpdate={downloadUpdate}
        installUpdate={installUpdate}
        retryConnection={retryConnection}
        updateStatus={updateStatus}
      />
    );
  }

  const settings = snapshot.settings;
  const obsOverlayUrl = `http://127.0.0.1:${settings.obsOverlayPort}/overlay`;
  const showUpdateBanner = ["update-available", "downloading", "downloaded", "installing"].includes(
    updateStatus?.phase ?? ""
  );
  const primaryUpdateAction =
    updateStatus?.phase === "update-available"
      ? {
          label: "업데이트 다운로드",
          disabled: false,
          onClick: () => void downloadUpdate()
        }
      : updateStatus?.phase === "downloading"
        ? {
            label: `다운로드 중 ${updateStatus.downloadProgress ?? 0}%`,
            disabled: true,
            onClick: () => undefined
          }
        : updateStatus?.phase === "downloaded"
          ? {
              label: "지금 설치",
              disabled: false,
              onClick: () => void installUpdate()
            }
          : updateStatus?.phase === "installing"
            ? {
                label: "설치 파일 실행 중",
                disabled: true,
                onClick: () => undefined
              }
            : null;
  const setSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    void updateSettings({ [key]: value } as Pick<UserSettings, K>);
  };

  const addWakeWord = () => {
    const next = wakeWordDraft.trim();
    if (!next || settings.wakeWords.includes(next)) {
      return;
    }

    void updateSettings({ wakeWords: [...settings.wakeWords, next] });
    setWakeWordDraft("");
  };

  const removeWakeWord = (word: string) => {
    const nextWords = settings.wakeWords.filter((item) => item !== word);
    if (nextWords.length === 0) {
      return;
    }
    void updateSettings({ wakeWords: nextWords });
  };

  const submitQuestion = () => {
    const trimmed = questionInput.trim();
    if (!trimmed) {
      return;
    }
    void sendCommand({ type: "speech/submit-query", text: trimmed });
    setQuestionInput("");
  };

  const startCaptureAnalysis = () => {
    if (!settings.captureSourceId) {
      return;
    }

    void captureAnalysis.start(settings.captureSourceId, settings.captureSampleIntervalMs);
    void updateSettings({ captureAnalysisEnabled: true });
  };

  const stopCaptureAnalysis = () => {
    captureAnalysis.stop();
    void updateSettings({ captureAnalysisEnabled: false });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-block__eyebrow">STREAM TAUNT RUNTIME</p>
          <h1>SIBOT</h1>
          <p className="brand-block__subtitle">
            게임 화면을 보고 짧고 빠르게 긁는 실시간 방송 보조 캐릭터.
          </p>
        </div>

        <div className="sidebar__status">
          <StatusPill tone={snapshot.analysisStatus === "running" ? "accent" : "neutral"}>
            {snapshot.analysisStatus === "running" ? "분석 중" : "대기"}
          </StatusPill>
          <StatusPill tone={snapshot.settings.ttsEnabled ? "warning" : "neutral"}>
            {snapshot.settings.ttsEnabled ? "TTS ON" : "TTS OFF"}
          </StatusPill>
          <StatusPill tone={snapshot.autoListenOpen ? "accent" : "neutral"}>
            {snapshot.autoListenOpen ? "자동 청취" : "청취 대기"}
          </StatusPill>
          {updateStatus?.phase === "update-available" ? (
            <StatusPill tone="warning">업데이트 있음</StatusPill>
          ) : null}
          {updateStatus?.phase === "downloaded" ? (
            <StatusPill tone="accent">설치 준비</StatusPill>
          ) : null}
        </div>

        <nav className="tab-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? "tab-nav__item is-active" : "tab-nav__item"}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span>{tab.label}</span>
              <small>{tab.hint}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="hero-panel">
          <div>
            <p className="hero-panel__eyebrow">REAL-TIME GAME SHADOW</p>
            <h2>
              {snapshot.detectedGame?.profile?.name ?? "지원 게임 없음"}
              <span>{snapshot.detectedGame?.activeWindowTitle ?? "활성 창 감지 대기"}</span>
            </h2>
          </div>

          <div className="hero-panel__actions">
            <button
              className="button button--primary"
              onClick={() =>
                void sendCommand({
                  type: snapshot.analysisStatus === "running" ? "analysis/stop" : "analysis/start"
                })
              }
              type="button"
            >
              {snapshot.analysisStatus === "running" ? "분석 중지" : "분석 시작"}
            </button>
            <button
              className="button"
              onClick={() => void sendCommand({ type: "detection/refresh" })}
              type="button"
            >
              감지 새로고침
            </button>
            <button
              className="button"
              onClick={() => void sendCommand({ type: "event/inject" })}
              type="button"
            >
              Mock 이벤트
            </button>
          </div>
        </header>

        <StatusGrid snapshot={snapshot} />

        {showUpdateBanner ? (
          <section className="update-banner">
            <div>
              <p className="brand-block__eyebrow">IN-APP UPDATE</p>
              <h3>{updateStatus?.message ?? "새 업데이트가 준비되었습니다."}</h3>
              <p className="field__description">
                현재 {updateStatus?.currentVersion ?? "알 수 없음"}
                {updateStatus?.latestVersion ? ` · 최신 ${updateStatus.latestVersion}` : ""}
                {updateStatus?.phase === "downloading"
                  ? ` · ${formatBytes(updateStatus.downloadedBytes)} / ${formatBytes(updateStatus.totalBytes)}`
                  : ""}
              </p>
              {typeof updateStatus?.downloadProgress === "number" ? (
                <div className="progress-bar">
                  <span style={{ width: `${updateStatus.downloadProgress}%` }} />
                </div>
              ) : null}
            </div>
            <div className="hero-panel__actions">
              {primaryUpdateAction ? (
                <button
                  className="button button--primary"
                  disabled={primaryUpdateAction.disabled}
                  onClick={primaryUpdateAction.onClick}
                  type="button"
                >
                  {primaryUpdateAction.label}
                </button>
              ) : null}
              {updateStatus?.releaseUrl ? (
                <button
                  className="button"
                  onClick={() => void openExternal(updateStatus.releaseUrl ?? "")}
                  type="button"
                >
                  릴리즈 보기
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "dashboard" ? (
          <div className="section-grid section-grid--dashboard">
            <SectionCard title="빠른 토글" eyebrow="Quick Control">
              <div className="quick-toggle-grid">
                <button
                  className={settings.overlayEnabled ? "button is-active" : "button"}
                  onClick={() => setSetting("overlayEnabled", !settings.overlayEnabled)}
                  type="button"
                >
                  오버레이 {settings.overlayEnabled ? "ON" : "OFF"}
                </button>
                <button
                  className={settings.ttsEnabled ? "button is-active" : "button"}
                  onClick={() => setSetting("ttsEnabled", !settings.ttsEnabled)}
                  type="button"
                >
                  TTS {settings.ttsEnabled ? "ON" : "OFF"}
                </button>
                <button
                  className={settings.wakeWordEnabled ? "button is-active" : "button"}
                  onClick={() => setSetting("wakeWordEnabled", !settings.wakeWordEnabled)}
                  type="button"
                >
                  웨이크워드 {settings.wakeWordEnabled ? "ON" : "OFF"}
                </button>
                <button
                  className={settings.autoListenAfterSpeak ? "button is-active" : "button"}
                  onClick={() =>
                    setSetting("autoListenAfterSpeak", !settings.autoListenAfterSpeak)
                  }
                  type="button"
                >
                  자동 청취 {settings.autoListenAfterSpeak ? "ON" : "OFF"}
                </button>
                <button
                  className={settings.autoStartOnGameDetected ? "button is-active" : "button"}
                  onClick={() =>
                    setSetting("autoStartOnGameDetected", !settings.autoStartOnGameDetected)
                  }
                  type="button"
                >
                  자동 시작 {settings.autoStartOnGameDetected ? "ON" : "OFF"}
                </button>
                <button
                  className={settings.profanityEnabled ? "button is-active" : "button"}
                  onClick={() => setSetting("profanityEnabled", !settings.profanityEnabled)}
                  type="button"
                >
                  비방 모드 {settings.profanityEnabled ? "ON" : "OFF"}
                </button>
              </div>
            </SectionCard>

            <SectionCard title="실시간 제어" eyebrow="Runtime Control">
              <div className="button-row">
                <button
                  className="button"
                  onClick={() => void sendCommand({ type: "utterance/test", eventType: "death" })}
                  type="button"
                >
                  데스 멘트 테스트
                </button>
                <button
                  className="button"
                  onClick={() =>
                    void sendCommand({ type: "speech/simulate-wake-word", word: settings.wakeWords[0] })
                  }
                  type="button"
                >
                  웨이크워드 시뮬레이션
                </button>
                <button
                  className="button"
                  onClick={() => void sendCommand({ type: "event/inject", eventType: "soloOverextend" })}
                  type="button"
                >
                  무리 진입 이벤트
                </button>
                <button
                  className="button"
                  onClick={() =>
                    void sendCommand({ type: "event/inject", eventType: "missedEasyKill" })
                  }
                  type="button"
                >
                  킬 놓침 이벤트
                </button>
              </div>
              <div className="query-box">
                <input
                  onChange={(event) => setQuestionInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitQuestion();
                    }
                  }}
                  placeholder="테스트 질문 입력: 예) 왜 내 잘못인데"
                  type="text"
                  value={questionInput}
                />
                <button className="button button--primary" onClick={submitQuestion} type="button">
                  질문 보내기
                </button>
              </div>
            </SectionCard>

            <SectionCard title="업데이트" eyebrow="Release Channel">
              <div className="info-panel">
                <p className="info-panel__primary">
                  {updateStatus?.message ?? "업데이트 상태 대기"}
                </p>
                <p className="field__description">
                  현재 버전 {updateStatus?.currentVersion ?? "알 수 없음"}
                  {updateStatus?.latestVersion
                    ? ` · 최신 ${updateStatus.latestVersion}`
                    : ""}
                </p>
              </div>
              <div className="button-row">
                <button className="button" onClick={() => void checkForUpdates()} type="button">
                  업데이트 확인
                </button>
                {primaryUpdateAction ? (
                  <button
                    className="button button--primary"
                    disabled={primaryUpdateAction.disabled}
                    onClick={primaryUpdateAction.onClick}
                    type="button"
                  >
                    {primaryUpdateAction.label}
                  </button>
                ) : null}
                {updateStatus?.releaseUrl ? (
                  <button
                    className="button"
                    onClick={() => void openExternal(updateStatus.releaseUrl ?? "")}
                    type="button"
                  >
                    릴리즈 페이지
                  </button>
                ) : null}
              </div>
              {typeof updateStatus?.downloadProgress === "number" ? (
                <div className="progress-bar">
                  <span style={{ width: `${updateStatus.downloadProgress}%` }} />
                </div>
              ) : null}
              {updateStatus?.downloadedBytes ? (
                <p className="muted">
                  {formatBytes(updateStatus.downloadedBytes)}
                  {updateStatus.totalBytes ? ` / ${formatBytes(updateStatus.totalBytes)}` : ""}
                </p>
              ) : null}
            </SectionCard>

            <SectionCard title="최근 발화" eyebrow="Last Utterances">
              <div className="list-stack">
                {snapshot.recentUtterances.slice(0, 3).map((utterance) => (
                  <article key={utterance.id} className="message-card">
                    <header>
                      <StatusPill tone={utterance.profanityUsed ? "danger" : "accent"}>
                        {utterance.type}
                      </StatusPill>
                      <small>{formatClockTime(utterance.createdAt)}</small>
                    </header>
                    <p>{utterance.text}</p>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="최근 이벤트" eyebrow="Analysis Feed">
              <div className="list-stack">
                {snapshot.recentEvents.length === 0 ? (
                  <p className="muted">아직 이벤트가 없습니다. 분석을 시작하거나 Mock 이벤트를 넣어보세요.</p>
                ) : (
                  snapshot.recentEvents.slice(0, 4).map((event) => (
                    <article key={event.id} className="feed-card">
                      <header>
                        <strong>{EVENT_LABELS[event.type]}</strong>
                        <small>{Math.round(event.confidence * 100)}%</small>
                      </header>
                      <p>{event.contextSummary}</p>
                    </article>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard title="최근 대화 턴" eyebrow="Short Context">
              <div className="list-stack">
                {snapshot.recentTurns.length === 0 ? (
                  <p className="muted">아직 질문/응답 기록이 없습니다.</p>
                ) : (
                  snapshot.recentTurns.slice(0, 3).map((turn) => (
                    <article key={turn.id} className="feed-card">
                      <p>
                        <strong>Q.</strong> {turn.question}
                      </p>
                      <p>
                        <strong>A.</strong> {turn.answer}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "character" ? (
          <div className="section-grid">
            <SectionCard title="캐릭터 기본값" eyebrow="Persona Core">
              <div className="field-grid">
                <TextField
                  description="오버레이와 로그에 표시할 AI 이름"
                  label="AI 이름"
                  onChange={(value) => setSetting("aiName", value)}
                  value={settings.aiName}
                />
                <SelectField
                  description="발화 기본 모드"
                  label="말투 모드"
                  onChange={(value) => setSetting("mode", value)}
                  options={Object.entries(MODE_LABELS).map(([value, label]) => ({
                    value: value as UserSettings["mode"],
                    label
                  }))}
                  value={settings.mode}
                />
                <ToggleField
                  checked={settings.profanityEnabled}
                  description="약한 욕설 사용 허용"
                  label="비방 모드 사용"
                  onChange={(checked) => setSetting("profanityEnabled", checked)}
                />
                <RangeField
                  description="높을수록 abuse-lite 선택 확률 증가"
                  label="비방 강도"
                  max={3}
                  min={0}
                  onChange={(value) => setSetting("profanityLevel", value)}
                  step={1}
                  value={settings.profanityLevel}
                />
                <ToggleField
                  checked={settings.adlibEnabled}
                  description="큰 이벤트가 없을 때 짧은 멘트 허용"
                  label="애드리브 허용"
                  onChange={(checked) => setSetting("adlibEnabled", checked)}
                />
                <RangeField
                  description="idle 상황에서 애드리브 발생 비율"
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label="애드리브 빈도"
                  max={1}
                  min={0}
                  onChange={(value) => setSetting("adlibFrequency", value)}
                  step={0.05}
                  value={settings.adlibFrequency}
                />
              </div>
            </SectionCard>

            <SectionCard title="웨이크워드" eyebrow="Wake Words">
              <div className="wakeword-manager">
                <div className="wakeword-list">
                  {settings.wakeWords.map((word) => (
                    <button
                      key={word}
                      className="chip-button"
                      onClick={() => removeWakeWord(word)}
                      type="button"
                    >
                      {word}
                    </button>
                  ))}
                </div>
                <div className="query-box">
                  <input
                    onChange={(event) => setWakeWordDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addWakeWord();
                      }
                    }}
                    placeholder="새 웨이크워드 추가"
                    type="text"
                    value={wakeWordDraft}
                  />
                  <button className="button" onClick={addWakeWord} type="button">
                    추가
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "overlay" ? (
          <div className="section-grid">
            <SectionCard title="오버레이 미리보기" eyebrow="App Overlay Preview">
              <OverlayPreview snapshot={snapshot} />
            </SectionCard>

            <SectionCard title="오버레이 설정" eyebrow="Visual Output">
              <div className="field-grid">
                <ToggleField
                  checked={settings.overlayEnabled}
                  description="앱 오버레이 출력"
                  label="오버레이 사용"
                  onChange={(checked) => setSetting("overlayEnabled", checked)}
                />
                <SelectField
                  description="브라우저 소스 구조 확장용"
                  label="표시 모드"
                  onChange={(value) => setSetting("overlayMode", value)}
                  options={[
                    { value: "app-overlay", label: "앱 오버레이" },
                    { value: "obs-browser", label: "OBS 브라우저 소스" },
                    { value: "both", label: "둘 다" }
                  ]}
                  value={settings.overlayMode}
                />
                <SelectField
                  description="말풍선 스타일"
                  label="표시 스타일"
                  onChange={(value) => setSetting("overlayStyle", value)}
                  options={[
                    { value: "bubble", label: "말풍선" },
                    { value: "chat", label: "채팅형" },
                    { value: "subtitle", label: "한 줄 자막형" }
                  ]}
                  value={settings.overlayStyle}
                />
                <SelectField
                  description="앱 오버레이 위치"
                  label="위치"
                  onChange={(value) => setSetting("overlayPosition", value)}
                  options={[
                    { value: "top-left", label: "좌상단" },
                    { value: "top-right", label: "우상단" },
                    { value: "bottom-left", label: "좌하단" },
                    { value: "bottom-right", label: "우하단" },
                    { value: "bottom-center", label: "하단 중앙" }
                  ]}
                  value={settings.overlayPosition}
                />
                <RangeField
                  description="자동 사라지는 시간"
                  formatValue={(value) => `${Math.round(value / 1000)}초`}
                  label="표시 시간"
                  max={10000}
                  min={1200}
                  onChange={(value) => setSetting("overlayDurationMs", value)}
                  step={100}
                  value={settings.overlayDurationMs}
                />
                <RangeField
                  description="최근 발화 유지 개수"
                  label="히스토리 개수"
                  max={8}
                  min={1}
                  onChange={(value) => setSetting("overlayHistoryCount", value)}
                  step={1}
                  value={settings.overlayHistoryCount}
                />
                <RangeField
                  description="글꼴 배율"
                  formatValue={(value) => `${value.toFixed(1)}x`}
                  label="글꼴 크기"
                  max={1.6}
                  min={0.8}
                  onChange={(value) => setSetting("overlayFontScale", value)}
                  step={0.1}
                  value={settings.overlayFontScale}
                />
                <RangeField
                  description="배경 불투명도"
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label="배경 투명도"
                  max={1}
                  min={0.1}
                  onChange={(value) => setSetting("overlayOpacity", value)}
                  step={0.05}
                  value={settings.overlayOpacity}
                />
                <ToggleField
                  checked={settings.overlayShowNickname}
                  description="발화자 이름 표시"
                  label="닉네임 표시"
                  onChange={(checked) => setSetting("overlayShowNickname", checked)}
                />
                <label className="field">
                  <div className="field__meta">
                    <span className="field__label">OBS 포트</span>
                    <span className="field__description">
                      브라우저 소스가 붙는 로컬 HTTP 포트
                    </span>
                  </div>
                  <input
                    inputMode="numeric"
                    onChange={(event) => {
                      const nextPort = Number(event.target.value);
                      if (Number.isFinite(nextPort)) {
                        setSetting("obsOverlayPort", nextPort);
                      }
                    }}
                    type="text"
                    value={String(settings.obsOverlayPort)}
                  />
                </label>
              </div>
            </SectionCard>

            <SectionCard title="OBS 브라우저 소스" eyebrow="Browser Source">
              <div className="info-panel">
                <p className="info-panel__primary">{obsOverlayUrl}</p>
                <p className="field__description">
                  OBS Browser Source URL에 이 주소를 넣으면 시봇 발화를 로컬 웹 오버레이로
                  띄울 수 있습니다.
                </p>
              </div>
              <div className="button-row">
                <button
                  className="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(obsOverlayUrl);
                    setObsCopied(true);
                    window.setTimeout(() => setObsCopied(false), 1500);
                  }}
                  type="button"
                >
                  URL 복사
                </button>
                <button
                  className="button"
                  onClick={() => void openExternal(obsOverlayUrl)}
                  type="button"
                >
                  브라우저 열기
                </button>
              </div>
              {obsCopied ? <p className="muted">복사됨</p> : null}
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "speech" ? (
          <div className="section-grid">
            <SectionCard title="음성 설정" eyebrow="Speech Runtime">
              <div className="field-grid">
                {liveVoice.devices.length > 0 ? (
                  <SelectField
                    description="Web Speech API는 기본 시스템 마이크를 우선 사용합니다."
                    label="마이크 장치"
                    onChange={(value) => setSetting("microphoneDeviceId", value)}
                    options={[
                      { value: "default", label: "기본 시스템 마이크" },
                      ...liveVoice.devices.map((device) => ({
                        value: device.deviceId,
                        label: device.label
                      }))
                    ]}
                    value={settings.microphoneDeviceId}
                  />
                ) : (
                  <TextField
                    description="장치 라벨이 안 보이면 브라우저 권한 후 다시 새로고침"
                    label="마이크 장치 ID"
                    onChange={(value) => setSetting("microphoneDeviceId", value)}
                    value={settings.microphoneDeviceId}
                  />
                )}
                <ToggleField
                  checked={settings.ttsEnabled}
                  description="Windows는 System.Speech, macOS는 say 사용"
                  label="TTS 사용"
                  onChange={(checked) => setSetting("ttsEnabled", checked)}
                />
                <RangeField
                  description="TTS 음량"
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label="음량"
                  max={1}
                  min={0}
                  onChange={(value) => setSetting("ttsVolume", value)}
                  step={0.05}
                  value={settings.ttsVolume}
                />
                <RangeField
                  description="TTS 속도"
                  formatValue={(value) => `${value.toFixed(2)}x`}
                  label="속도"
                  max={1.6}
                  min={0.5}
                  onChange={(value) => setSetting("ttsRate", value)}
                  step={0.05}
                  value={settings.ttsRate}
                />
                <ToggleField
                  checked={settings.wakeWordEnabled}
                  description="평소엔 웨이크워드만 청취"
                  label="웨이크워드 사용"
                  onChange={(checked) => setSetting("wakeWordEnabled", checked)}
                />
                <ToggleField
                  checked={settings.autoListenAfterSpeak}
                  description="발화 직후 자유 질문 창 오픈"
                  label="자동 청취 사용"
                  onChange={(checked) => setSetting("autoListenAfterSpeak", checked)}
                />
                <RangeField
                  description="시봇 발화 직후 열리는 청취 시간"
                  formatValue={(value) => `${Math.round(value / 1000)}초`}
                  label="자동 청취 시간"
                  max={6000}
                  min={3000}
                  onChange={(value) => setSetting("autoListenDurationMs", value)}
                  step={100}
                  value={settings.autoListenDurationMs}
                />
                <RangeField
                  description="응답 후 후속 질문 허용 시간"
                  formatValue={(value) => `${Math.round(value / 1000)}초`}
                  label="후속 청취 시간"
                  max={5000}
                  min={2000}
                  onChange={(value) => setSetting("followupListenDurationMs", value)}
                  step={100}
                  value={settings.followupListenDurationMs}
                />
                <RangeField
                  description="대화가 길어지지 않도록 제한"
                  label="최대 대화 턴"
                  max={5}
                  min={1}
                  onChange={(value) => setSetting("maxConversationTurns", value)}
                  step={1}
                  value={settings.maxConversationTurns}
                />
                <RangeField
                  description="배경 소음 민감도"
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label="소음 감도"
                  max={1}
                  min={0}
                  onChange={(value) => setSetting("backgroundNoiseSensitivity", value)}
                  step={0.05}
                  value={settings.backgroundNoiseSensitivity}
                />
              </div>
            </SectionCard>

            <SectionCard title="라이브 음성 인식 베타" eyebrow="Web Speech Beta">
              <div className="info-panel">
                <p className="info-panel__primary">
                  {liveVoice.supported ? "사용 가능" : "이 환경에서는 지원 안 됨"}
                </p>
                <p className="field__description">
                  실제 음성 인식 결과를 바로 런타임으로 보내며, 웨이크워드가 앞에 붙으면 자동
                  청취 창을 엽니다.
                </p>
              </div>
              <div className="button-row">
                <button
                  className={liveVoice.listening ? "button is-active" : "button"}
                  disabled={!liveVoice.supported}
                  onClick={() => void liveVoice.startListening()}
                  type="button"
                >
                  라이브 음성 시작
                </button>
                <button className="button" onClick={liveVoice.stopListening} type="button">
                  중지
                </button>
                <button className="button" onClick={() => void liveVoice.refreshDevices()} type="button">
                  장치 새로고침
                </button>
              </div>
              <div className="detail-grid">
                <div>
                  <span>상태</span>
                  <strong>{liveVoice.listening ? "청취 중" : "대기"}</strong>
                </div>
                <div>
                  <span>최근 transcript</span>
                  <strong>{liveVoice.lastTranscript || "아직 없음"}</strong>
                </div>
              </div>
              {liveVoice.error ? <p className="muted">{liveVoice.error}</p> : null}
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "game" ? (
          <div className="section-grid">
            <SectionCard title="게임 감지" eyebrow="Detection & Rule Target">
              <div className="field-grid">
                <SelectField
                  description="debug/mock fallback 대상"
                  label="선택 게임 프로필"
                  onChange={(value) => setSetting("selectedGameProfile", value)}
                  options={GAME_PROFILES.map((profile) => ({
                    value: profile.id,
                    label: profile.name
                  }))}
                  value={settings.selectedGameProfile}
                />
                <ToggleField
                  checked={settings.autoStartOnGameDetected}
                  description="지원 게임 감지 직후 자동 분석"
                  label="자동 시작"
                  onChange={(checked) => setSetting("autoStartOnGameDetected", checked)}
                />
                <ToggleField
                  checked={settings.debugMode}
                  description="실게임이 없어도 mock 감지 허용"
                  label="디버그 감지"
                  onChange={(checked) => setSetting("debugMode", checked)}
                />
                <ToggleField
                  checked={settings.developerMode}
                  description="테스트 액션과 JSON 패널 노출"
                  label="개발자 모드"
                  onChange={(checked) => setSetting("developerMode", checked)}
                />
                <RangeField
                  description="이벤트 추론 감도"
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label="이벤트 민감도"
                  max={1}
                  min={0}
                  onChange={(value) => setSetting("eventSensitivity", value)}
                  step={0.05}
                  value={settings.eventSensitivity}
                />
                <RangeField
                  description="실시간 화면 분석 샘플 간격"
                  formatValue={(value) => `${value}ms`}
                  label="캡처 샘플 간격"
                  max={2000}
                  min={200}
                  onChange={(value) => setSetting("captureSampleIntervalMs", value)}
                  step={50}
                  value={settings.captureSampleIntervalMs}
                />
                <RangeField
                  description="전체 발화 최소 간격"
                  formatValue={(value) => `${(value / 1000).toFixed(1)}초`}
                  label="이벤트 최소 간격"
                  max={18000}
                  min={2000}
                  onChange={(value) => setSetting("eventCooldownMs", value)}
                  step={500}
                  value={settings.eventCooldownMs}
                />
                <RangeField
                  description="욕설 멘트 최소 간격"
                  formatValue={(value) => `${(value / 1000).toFixed(1)}초`}
                  label="욕설 최소 간격"
                  max={60000}
                  min={5000}
                  onChange={(value) => setSetting("profanityMinimumIntervalMs", value)}
                  step={1000}
                  value={settings.profanityMinimumIntervalMs}
                />
                <SelectField
                  description="동시 후보 충돌 시 처리 방식"
                  label="우선순위 충돌"
                  onChange={(value) => setSetting("priorityConflictMode", value)}
                  options={[
                    { value: "highest", label: "가장 높은 우선순위" },
                    { value: "latest", label: "가장 최근 이벤트" },
                    { value: "queue", label: "큐에 보관" }
                  ]}
                  value={settings.priorityConflictMode}
                />
              </div>
            </SectionCard>

            <SectionCard title="지원 게임 프로필" eyebrow="Profiles">
              <div className="profile-list">
                {GAME_PROFILES.map((profile) => (
                  <article
                    key={profile.id}
                    className={
                      profile.id === settings.selectedGameProfile
                        ? "profile-card is-active"
                        : "profile-card"
                    }
                  >
                    <header style={{ borderColor: profile.primaryColor }}>
                      <strong>{profile.name}</strong>
                      <small>{profile.processNames.join(", ")}</small>
                    </header>
                    <p>{profile.detectorNotes}</p>
                    <div className="profile-card__tags">
                      {profile.supportedEvents.slice(0, 5).map((event) => (
                        <span key={event}>{EVENT_LABELS[event]}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="현재 감지 상세" eyebrow="Active Detection">
              <div className="detail-grid">
                <div>
                  <span>활성 프로세스</span>
                  <strong>{snapshot.detectedGame?.processName ?? "없음"}</strong>
                </div>
                <div>
                  <span>활성 창 제목</span>
                  <strong>{snapshot.detectedGame?.activeWindowTitle ?? "없음"}</strong>
                </div>
                <div>
                  <span>실행 중 지원 게임</span>
                  <strong>{snapshot.detectedGame?.runningGames.length ?? 0}개</strong>
                </div>
                <div>
                  <span>선택 프로필</span>
                  <strong>{selectedProfile?.name ?? "없음"}</strong>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="실시간 화면 캡처 분석 베타" eyebrow="Desktop Capture Heuristics">
              <div className="button-row">
                <button className="button" onClick={() => void captureAnalysis.refreshSources()} type="button">
                  소스 새로고침
                </button>
                <button
                  className={captureAnalysis.active ? "button is-active" : "button"}
                  onClick={startCaptureAnalysis}
                  type="button"
                >
                  캡처 분석 시작
                </button>
                <button className="button" onClick={stopCaptureAnalysis} type="button">
                  분석 중지
                </button>
              </div>

              <div className="field-grid">
                <SelectField
                  description="화면 또는 게임 창을 선택"
                  label="캡처 소스"
                  onChange={(value) => setSetting("captureSourceId", value)}
                  options={[
                    { value: "", label: "선택 안 함" },
                    ...captureAnalysis.sources.map((source) => ({
                      value: source.id,
                      label: source.name
                    }))
                  ]}
                  value={settings.captureSourceId}
                />
                <ToggleField
                  checked={settings.captureAnalysisEnabled}
                  description="선택한 소스에서 실시간 간이 분석 수행"
                  label="캡처 분석 사용"
                  onChange={(checked) => setSetting("captureAnalysisEnabled", checked)}
                />
              </div>

              <div className="detail-grid">
                <div>
                  <span>분석 상태</span>
                  <strong>{captureAnalysis.active ? "실행 중" : "중지"}</strong>
                </div>
                <div>
                  <span>최근 신호</span>
                  <strong>{captureAnalysis.lastSignal || "아직 없음"}</strong>
                </div>
              </div>

              <video className="capture-preview" muted playsInline ref={captureAnalysis.previewRef} />
              {captureAnalysis.error ? <p className="muted">{captureAnalysis.error}</p> : null}
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "logs" ? (
          <div className="section-grid">
            <SectionCard title="시스템 상태" eyebrow="System Runtime">
              <div className="detail-grid">
                <div>
                  <span>OBS Overlay URL</span>
                  <strong>{obsOverlayUrl}</strong>
                </div>
                <div>
                  <span>업데이트 상태</span>
                  <strong>{updateStatus?.phase ?? "idle"}</strong>
                </div>
                <div>
                  <span>캡처 분석</span>
                  <strong>{captureAnalysis.active ? "실행 중" : "중지"}</strong>
                </div>
                <div>
                  <span>라이브 음성</span>
                  <strong>{liveVoice.listening ? "청취 중" : "중지"}</strong>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="최근 로그" eyebrow="Runtime Log Feed">
              <div className="log-list">
                {snapshot.logs.slice(0, 30).map((log) => (
                  <article key={log.id} className={`log-entry log-entry--${log.level}`}>
                    <header>
                      <strong>{log.scope}</strong>
                      <small>{formatClockTime(log.timestamp)}</small>
                    </header>
                    <p>{log.message}</p>
                    {log.data ? <pre>{JSON.stringify(log.data, null, 2)}</pre> : null}
                  </article>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="상태 JSON" eyebrow="Debug Snapshot">
              <pre className="json-panel">
                {JSON.stringify(
                  {
                    appStatus: snapshot.appStatus,
                    analysisStatus: snapshot.analysisStatus,
                    detectedGame: snapshot.detectedGame,
                    speechStatus: snapshot.speechStatus,
                    recentEvents: snapshot.recentEvents.slice(0, 5),
                    recentUtterances: snapshot.recentUtterances.slice(0, 5)
                  },
                  null,
                  2
                )}
              </pre>
            </SectionCard>
          </div>
        ) : null}
      </main>
    </div>
  );
};
