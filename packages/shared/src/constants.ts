import type {
  AnalysisEventType,
  GameId,
  LogScope,
  SibotMode,
  SpeechStatus
} from "./types";

export const APP_NAME = "SIBOT";
export const APP_NAME_KO = "시봇";

export const DEFAULT_LOG_LIMIT = 200;
export const DEFAULT_MEMORY_LIMIT = 20;
export const DEFAULT_UTTERANCE_LIMIT = 8;

export const GAME_IDS: GameId[] = [
  "overwatch2",
  "valorant",
  "pubg",
  "league"
];

export const ANALYSIS_EVENT_TYPES: AnalysisEventType[] = [
  "death",
  "lowAccuracyBurst",
  "missedEasyKill",
  "soloOverextend",
  "abilityUnusedDeath",
  "idleAdlibWindow",
  "followupConversationWindowOpen",
  "ultUnusedOnDeath",
  "isolatedDive",
  "failedCloseRangeDuel",
  "ignoredCover",
  "poorUltTiming",
  "whiffBurst",
  "dryPeekFailure",
  "utilHeldOnDeath",
  "lostAdvantageDuel"
];

export const EVENT_LABELS: Record<AnalysisEventType, string> = {
  death: "데스",
  lowAccuracyBurst: "근거리 난사 미스",
  missedEasyKill: "쉬운 킬 놓침",
  soloOverextend: "무리한 단독 진입",
  abilityUnusedDeath: "스킬 안 쓰고 사망",
  idleAdlibWindow: "애드리브 창",
  followupConversationWindowOpen: "후속 대화 창",
  ultUnusedOnDeath: "궁 안 쓰고 사망",
  isolatedDive: "고립 다이브",
  failedCloseRangeDuel: "근거리 1:1 패배",
  ignoredCover: "엄폐 무시",
  poorUltTiming: "궁 타이밍 미스",
  whiffBurst: "벌스팅 허공샷",
  dryPeekFailure: "드라이 피크 실패",
  utilHeldOnDeath: "유틸 들고 사망",
  lostAdvantageDuel: "유리한 교전 패배"
};

export const MODE_LABELS: Record<SibotMode, string> = {
  clean: "클린",
  taunt: "시비",
  mixed: "혼합",
  "abuse-lite": "비방 라이트"
};

export const SPEECH_STATUS_LABELS: Record<SpeechStatus, string> = {
  sleeping: "비활성",
  "idle-listening": "웨이크워드 대기",
  "open-listen-window": "자동 청취",
  "followup-listen-window": "후속 청취"
};

export const LOG_SCOPES: LogScope[] = [
  "app",
  "config",
  "detector",
  "analysis",
  "utterance",
  "speech",
  "overlay",
  "ipc",
  "error"
];

