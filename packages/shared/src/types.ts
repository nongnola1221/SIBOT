export type SibotMode = "clean" | "taunt" | "mixed" | "abuse-lite";
export type OverlayMode = "app-overlay" | "obs-browser" | "both";
export type OverlayStyle = "bubble" | "chat" | "subtitle";
export type OverlayPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

export type AppStatus =
  | "idle"
  | "detecting"
  | "ready"
  | "analyzing"
  | "conversing"
  | "error";

export type AnalysisStatus = "stopped" | "starting" | "running" | "error";
export type OverlayStatus = "hidden" | "visible";
export type SpeechStatus =
  | "sleeping"
  | "idle-listening"
  | "open-listen-window"
  | "followup-listen-window";

export type MicrophoneStatus = "unknown" | "ready" | "disabled";
export type TtsStatus = "off" | "ready" | "mock-speaking";

export type GameId = "overwatch2" | "valorant" | "pubg" | "league";

export type AnalysisEventType =
  | "death"
  | "lowAccuracyBurst"
  | "missedEasyKill"
  | "soloOverextend"
  | "abilityUnusedDeath"
  | "idleAdlibWindow"
  | "followupConversationWindowOpen"
  | "ultUnusedOnDeath"
  | "isolatedDive"
  | "failedCloseRangeDuel"
  | "ignoredCover"
  | "poorUltTiming"
  | "whiffBurst"
  | "dryPeekFailure"
  | "utilHeldOnDeath"
  | "lostAdvantageDuel";

export type UtteranceType =
  | "instant-taunt"
  | "instant-abuse"
  | "adlib"
  | "answer"
  | "summary"
  | "debug";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogScope =
  | "app"
  | "config"
  | "detector"
  | "analysis"
  | "utterance"
  | "speech"
  | "overlay"
  | "ipc"
  | "error";

export interface GameProfile {
  id: GameId;
  name: string;
  shortName: string;
  processNames: string[];
  windowTitleHints: string[];
  supportedEvents: AnalysisEventType[];
  detectorNotes: string;
  primaryColor: string;
}

export interface RunningGameInfo {
  profile: GameProfile;
  processName: string;
  pid?: number;
}

export interface GameDetection {
  profile: GameProfile | null;
  processName: string | null;
  activeWindowTitle: string | null;
  detectedAt: number;
  source: "process" | "mock" | "inactive";
  runningGames: RunningGameInfo[];
}

export interface AnalysisEvent {
  id: string;
  type: AnalysisEventType;
  timestamp: number;
  game: GameId;
  severity: number;
  tags: string[];
  snapshotMetadata: Record<string, string | number | boolean>;
  confidence: number;
  contextSummary: string;
  cooldownGroup: string;
  priorityScore: number;
}

export interface Utterance {
  id: string;
  type: UtteranceType;
  text: string;
  mode: SibotMode;
  createdAt: number;
  eventId?: string;
  profanityUsed: boolean;
  priority: number;
  tags: string[];
  source: "template" | "answer" | "debug";
}

export interface ConversationTurn {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
  eventId?: string;
}

export interface ListenWindowState {
  type: "auto" | "followup";
  until: number;
  remainingMs: number;
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  scope: LogScope;
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface UserSettings {
  aiName: string;
  wakeWords: string[];
  mode: SibotMode;
  profanityEnabled: boolean;
  profanityLevel: number;
  profanityCooldownSec: number;
  adlibEnabled: boolean;
  adlibFrequency: number;
  overlayEnabled: boolean;
  overlayMode: OverlayMode;
  overlayStyle: OverlayStyle;
  overlayPosition: OverlayPosition;
  overlayDurationMs: number;
  overlayHistoryCount: number;
  overlayFontScale: number;
  overlayOpacity: number;
  overlayShowNickname: boolean;
  ttsEnabled: boolean;
  ttsVolume: number;
  ttsRate: number;
  microphoneDeviceId: string;
  wakeWordEnabled: boolean;
  autoListenAfterSpeak: boolean;
  autoListenDurationMs: number;
  followupListenDurationMs: number;
  maxConversationTurns: number;
  backgroundNoiseSensitivity: number;
  autoStartOnGameDetected: boolean;
  selectedGameProfile: GameId;
  eventCooldownMs: number;
  profanityMinimumIntervalMs: number;
  developerMode: boolean;
  debugMode: boolean;
  eventSensitivity: number;
  priorityConflictMode: "highest" | "latest" | "queue";
}

export interface RuntimeSnapshot {
  settings: UserSettings;
  appStatus: AppStatus;
  analysisStatus: AnalysisStatus;
  detectedGame: GameDetection | null;
  overlayStatus: OverlayStatus;
  speechStatus: SpeechStatus;
  activeListenWindow: ListenWindowState | null;
  recentEvents: AnalysisEvent[];
  recentUtterances: Utterance[];
  recentTurns: ConversationTurn[];
  logs: LogEntry[];
  microphoneStatus: MicrophoneStatus;
  ttsStatus: TtsStatus;
  currentMode: SibotMode;
  isOverlayVisible: boolean;
  autoListenOpen: boolean;
  runtimeFlags: {
    autoStartEligible: boolean;
    mockMode: boolean;
    developerMode: boolean;
  };
}

export type RuntimeCommand =
  | { type: "analysis/start" }
  | { type: "analysis/stop" }
  | { type: "detection/refresh" }
  | { type: "event/inject"; eventType?: AnalysisEventType }
  | { type: "utterance/test"; eventType?: AnalysisEventType }
  | { type: "speech/simulate-wake-word"; word?: string }
  | { type: "speech/submit-query"; text: string };

