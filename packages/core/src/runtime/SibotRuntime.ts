import { EventEmitter } from "node:events";
import { mergeSettings } from "@sibot/config";
import { CooldownController, PriorityEventQueue } from "@sibot/event-engine";
import { GameDetectionService } from "@sibot/game-detectors";
import {
  APP_NAME,
  DEFAULT_LOG_LIMIT,
  createId,
  relativeMs,
  type AnalysisEvent,
  type AnalysisEventType,
  type ConversationTurn,
  type GameDetection,
  type LogEntry,
  type LogLevel,
  type LogScope,
  type RuntimeCommand,
  type RuntimeSnapshot,
  type UserSettings,
  type Utterance
} from "@sibot/shared";
import {
  MockSTTProvider,
  MockWakeWordProvider,
  type STTProvider,
  type TTSProvider,
  type WakeWordProvider,
  SystemTTSProvider
} from "@sibot/speech";
import { MockAnalysisEngine } from "../analysis/mockAnalyzer";
import { ConversationMemory } from "./memory";
import { UtteranceEngine } from "../utterance/engine";

interface RuntimeDependencies {
  detector?: GameDetectionService;
  tts?: TTSProvider;
  stt?: STTProvider;
  wakeWord?: WakeWordProvider;
  persistSettings?: (settings: UserSettings) => Promise<void>;
}

export class SibotRuntime {
  private readonly emitter = new EventEmitter();
  private readonly memory = new ConversationMemory();
  private readonly queue = new PriorityEventQueue();
  private readonly eventCooldowns = new CooldownController();
  private readonly utteranceEngine = new UtteranceEngine(this.memory);
  private readonly analyzer = new MockAnalysisEngine();
  private readonly detector: GameDetectionService;
  private readonly tts: TTSProvider;
  private readonly stt: STTProvider;
  private readonly wakeWord: WakeWordProvider;

  private detectionTimer: NodeJS.Timeout | null = null;
  private adlibTimer: NodeJS.Timeout | null = null;
  private listenTimer: NodeJS.Timeout | null = null;
  private listenTick: NodeJS.Timeout | null = null;
  private activeListenUntil: number | null = null;
  private activeListenType: "auto" | "followup" | null = null;
  private conversationTurns = 0;
  private lastEventAt = 0;
  private persistSettings?: (settings: UserSettings) => Promise<void>;

  private snapshot: RuntimeSnapshot;

  constructor(initialSettings: UserSettings, dependencies: RuntimeDependencies = {}) {
    this.detector = dependencies.detector ?? new GameDetectionService();
    this.tts = dependencies.tts ?? new SystemTTSProvider();
    this.stt = dependencies.stt ?? new MockSTTProvider();
    this.wakeWord = dependencies.wakeWord ?? new MockWakeWordProvider();
    this.persistSettings = dependencies.persistSettings;

    this.snapshot = this.createInitialSnapshot(initialSettings);
  }

  async initialize() {
    this.stt.setTranscriptHandler((transcript) => {
      if (transcript.final) {
        void this.processTranscript(transcript.text);
      }
    });

    this.wakeWord.setWakeWordHandler((word) => {
      void this.onWakeWord(word);
    });

    await this.stt.start();
    await this.wakeWord.configure(this.snapshot.settings.wakeWords);
    await this.wakeWord.start();

    this.setSpeechBaseline();
    this.startDetectionPolling();
    await this.refreshDetection();

    this.log("info", "app", `${APP_NAME} runtime initialized`);
    this.emitSnapshot();
  }

  dispose() {
    this.stopAnalysis();
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = null;
    }
    this.clearListenWindow();
    void this.stt.stop();
    void this.wakeWord.stop();
    void this.tts.stop();
  }

  subscribe(listener: (snapshot: RuntimeSnapshot) => void) {
    this.emitter.on("snapshot", listener);
    listener(this.getSnapshot());

    return () => {
      this.emitter.off("snapshot", listener);
    };
  }

  getSnapshot() {
    const now = Date.now();
    const activeListenWindow =
      this.activeListenUntil && this.activeListenType
        ? {
            type: this.activeListenType,
            until: this.activeListenUntil,
            remainingMs: relativeMs(this.activeListenUntil, now)
          }
        : null;

    return {
      ...this.snapshot,
      activeListenWindow,
      autoListenOpen: Boolean(activeListenWindow)
    } satisfies RuntimeSnapshot;
  }

  async updateSettings(patch: Partial<UserSettings>) {
    const nextSettings = mergeSettings({
      ...this.snapshot.settings,
      ...patch
    });

    this.snapshot = {
      ...this.snapshot,
      settings: nextSettings,
      currentMode: nextSettings.mode,
      overlayStatus: nextSettings.overlayEnabled ? "visible" : "hidden",
      isOverlayVisible: nextSettings.overlayEnabled,
      ttsStatus: nextSettings.ttsEnabled ? "ready" : "off",
      runtimeFlags: {
        ...this.snapshot.runtimeFlags,
        developerMode: nextSettings.developerMode
      }
    };

    await this.wakeWord.configure(nextSettings.wakeWords);
    this.setSpeechBaseline();
    await this.persistSettings?.(nextSettings);

    this.log("info", "config", "Settings updated", {
      mode: nextSettings.mode,
      overlayEnabled: nextSettings.overlayEnabled,
      ttsEnabled: nextSettings.ttsEnabled
    });
    this.emitSnapshot();
  }

  async runCommand(command: RuntimeCommand) {
    switch (command.type) {
      case "analysis/start":
        return this.startAnalysis();
      case "analysis/stop":
        return this.stopAnalysis();
      case "detection/refresh":
        return this.refreshDetection();
      case "event/inject":
        return this.injectMockEvent(command.eventType);
      case "utterance/test":
        return this.testUtterance(command.eventType);
      case "speech/simulate-wake-word":
        return this.onWakeWord(command.word ?? this.snapshot.settings.wakeWords[0]);
      case "speech/process-transcript":
        return this.processTranscript(command.text);
      case "speech/submit-query":
        return this.submitTextQuery(command.text);
      default:
        return null;
    }
  }

  async refreshDetection() {
    this.snapshot = {
      ...this.snapshot,
      appStatus: "detecting"
    };
    this.emitSnapshot();

    const detection = await this.detector.getActiveGame(this.snapshot.settings);
    this.setDetection(detection);

    if (
      detection?.profile &&
      this.snapshot.settings.autoStartOnGameDetected &&
      this.snapshot.analysisStatus !== "running"
    ) {
      await this.startAnalysis();
    }

    return detection;
  }

  async startAnalysis() {
    const detectedProfile =
      this.snapshot.detectedGame?.profile ??
      (await this.refreshDetection())?.profile ??
      null;

    if (!detectedProfile) {
      this.log("warn", "analysis", "No supported game detected for analysis start");
      this.snapshot = {
        ...this.snapshot,
        appStatus: "ready",
        analysisStatus: "stopped"
      };
      this.emitSnapshot();
      return null;
    }

    this.snapshot = {
      ...this.snapshot,
      appStatus: "analyzing",
      analysisStatus: "running"
    };
    this.emitSnapshot();

    this.analyzer.start(detectedProfile, (event) => {
      void this.handleIncomingEvent(event);
    });
    this.startAdlibLoop();
    this.log("info", "analysis", "Analysis started", {
      game: detectedProfile.id
    });

    return this.getSnapshot();
  }

  stopAnalysis() {
    this.analyzer.stop();

    if (this.adlibTimer) {
      clearInterval(this.adlibTimer);
      this.adlibTimer = null;
    }

    this.snapshot = {
      ...this.snapshot,
      appStatus: this.snapshot.detectedGame?.profile ? "ready" : "idle",
      analysisStatus: "stopped"
    };
    this.emitSnapshot();
    this.log("info", "analysis", "Analysis stopped");
    return this.getSnapshot();
  }

  async submitTextQuery(text: string, options?: { skipGate?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const canRespond = options?.skipGate ? true : this.canAcceptSpeech(trimmed);
    if (!canRespond) {
      this.log("debug", "speech", "Ignored query outside wake/listen window", { text: trimmed });
      return null;
    }

    const answer = this.utteranceEngine.buildAnswerUtterance(trimmed, this.snapshot.settings);
    if (!answer) {
      return null;
    }

    const latestEvent = this.memory.getLatestEvent();
    const turn: ConversationTurn = {
      id: createId("turn"),
      question: trimmed,
      answer: answer.text,
      createdAt: Date.now(),
      eventId: latestEvent?.id
    };

    this.memory.addTurn(turn);
    this.snapshot = {
      ...this.snapshot,
      recentTurns: this.memory.getTurns(),
      appStatus: "conversing"
    };

    await this.publishUtterance(answer);

    this.conversationTurns += 1;
    if (
      this.snapshot.settings.autoListenAfterSpeak &&
      this.conversationTurns < this.snapshot.settings.maxConversationTurns
    ) {
      this.openListenWindow("followup", this.snapshot.settings.followupListenDurationMs);
    } else {
      this.clearListenWindow();
      this.conversationTurns = 0;
      this.restoreStatus();
    }

    this.log("info", "speech", "Question answered", {
      question: trimmed
    });
    this.emitSnapshot();
    return turn;
  }

  async processTranscript(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    this.log("debug", "speech", "Transcript received", {
      text: trimmed
    });

    const matchedWakeWord = this.matchWakeWord(trimmed);

    if (matchedWakeWord) {
      await this.onWakeWord(matchedWakeWord);

      const remainder = this.stripWakeWord(trimmed, matchedWakeWord);
      if (!remainder) {
        return null;
      }

      return this.submitTextQuery(remainder, { skipGate: true });
    }

    return this.submitTextQuery(trimmed);
  }

  async injectMockEvent(eventType?: AnalysisEventType) {
    const profile = this.snapshot.detectedGame?.profile;
    if (!profile) {
      await this.refreshDetection();
    }

    const activeProfile = this.snapshot.detectedGame?.profile;
    if (!activeProfile) {
      return null;
    }

    const event = this.analyzer.inject(activeProfile, eventType);
    await this.handleIncomingEvent(event);
    return event;
  }

  async testUtterance(eventType?: AnalysisEventType) {
    const event = await this.injectMockEvent(eventType);
    return event;
  }

  private createInitialSnapshot(settings: UserSettings): RuntimeSnapshot {
    return {
      settings,
      appStatus: "idle",
      analysisStatus: "stopped",
      detectedGame: null,
      overlayStatus: settings.overlayEnabled ? "visible" : "hidden",
      speechStatus: settings.wakeWordEnabled ? "idle-listening" : "sleeping",
      activeListenWindow: null,
      recentEvents: [],
      recentUtterances: [],
      recentTurns: [],
      logs: [],
      microphoneStatus: "ready",
      ttsStatus: settings.ttsEnabled ? "ready" : "off",
      currentMode: settings.mode,
      isOverlayVisible: settings.overlayEnabled,
      autoListenOpen: false,
      runtimeFlags: {
        autoStartEligible: false,
        mockMode: settings.debugMode,
        developerMode: settings.developerMode
      }
    };
  }

  private startDetectionPolling() {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
    }

    this.detectionTimer = setInterval(() => {
      void this.refreshDetection();
    }, 4000);
  }

  private startAdlibLoop() {
    if (this.adlibTimer) {
      clearInterval(this.adlibTimer);
    }

    this.adlibTimer = setInterval(() => {
      if (this.snapshot.analysisStatus !== "running") {
        return;
      }

      const now = Date.now();
      const settings = this.snapshot.settings;
      const quietEnough = now - this.lastEventAt > 12000;
      const allowRandomAdlib = Math.random() < settings.adlibFrequency * 0.35;

      if (!settings.adlibEnabled || !quietEnough || !allowRandomAdlib) {
        return;
      }

      const utterance = this.utteranceEngine.buildAdlibUtterance(settings);
      if (!utterance) {
        return;
      }

      void this.publishUtterance(utterance);
    }, 7000);
  }

  private async handleIncomingEvent(event: AnalysisEvent) {
    if (
      !this.eventCooldowns.canTrigger(
        event.cooldownGroup,
        Math.max(2500, this.snapshot.settings.eventCooldownMs / 2),
        event.timestamp
      )
    ) {
      return;
    }

    this.eventCooldowns.markTriggered(event.cooldownGroup, event.timestamp);
    this.queue.push(event);
    this.memory.addEvent(event);
    this.lastEventAt = event.timestamp;
    this.snapshot = {
      ...this.snapshot,
      recentEvents: this.memory.getEvents()
    };

    this.log("info", "analysis", `Event detected: ${event.type}`, {
      game: event.game,
      severity: event.severity
    });

    const nextEvent = this.queue.shift();
    if (!nextEvent) {
      return;
    }

    const utterance = this.utteranceEngine.buildEventUtterance(
      nextEvent,
      this.snapshot.settings
    );

    if (!utterance) {
      this.emitSnapshot();
      return;
    }

    await this.publishUtterance(utterance);
    this.emitSnapshot();
  }

  private async publishUtterance(utterance: Utterance) {
    this.memory.addUtterance(utterance);

    this.snapshot = {
      ...this.snapshot,
      recentUtterances: this.memory.getUtterances(),
      overlayStatus: this.snapshot.settings.overlayEnabled ? "visible" : "hidden",
      isOverlayVisible: this.snapshot.settings.overlayEnabled,
      ttsStatus: this.snapshot.settings.ttsEnabled ? "speaking" : "off"
    };

    if (this.snapshot.settings.ttsEnabled) {
      void this.tts.speak(utterance, {
        volume: this.snapshot.settings.ttsVolume,
        rate: this.snapshot.settings.ttsRate,
        mode: utterance.mode
      }).finally(() => {
        this.snapshot = {
          ...this.snapshot,
          ttsStatus: this.snapshot.settings.ttsEnabled ? "ready" : "off"
        };
        this.emitSnapshot();
      });
    }

    if (this.snapshot.settings.autoListenAfterSpeak) {
      this.openListenWindow("auto", this.snapshot.settings.autoListenDurationMs);
    }

    this.restoreStatus();
    this.log("info", "utterance", utterance.text, {
      mode: utterance.mode,
      type: utterance.type
    });
    this.emitSnapshot();
  }

  private setDetection(detection: GameDetection | null) {
    const appStatus =
      this.snapshot.analysisStatus === "running"
        ? "analyzing"
        : detection?.profile
          ? "ready"
          : "idle";

    this.snapshot = {
      ...this.snapshot,
      detectedGame: detection,
      appStatus,
      runtimeFlags: {
        ...this.snapshot.runtimeFlags,
        autoStartEligible: Boolean(detection?.profile),
        mockMode: detection?.source === "mock" || this.snapshot.settings.debugMode
      }
    };

    this.log(
      "debug",
      "detector",
      detection?.profile
        ? `Detected ${detection.profile.name}`
        : "No supported game in focus"
    );
    this.emitSnapshot();
  }

  private setSpeechBaseline() {
    if (!this.snapshot.settings.wakeWordEnabled) {
      this.snapshot = {
        ...this.snapshot,
        speechStatus: "sleeping"
      };
      return;
    }

    if (!this.activeListenUntil) {
      this.snapshot = {
        ...this.snapshot,
        speechStatus: "idle-listening"
      };
    }
  }

  private async onWakeWord(word: string) {
    this.conversationTurns = 0;
    this.openListenWindow("auto", this.snapshot.settings.autoListenDurationMs);
    this.log("info", "speech", "Wake word detected", { word });
    this.emitSnapshot();
  }

  private openListenWindow(type: "auto" | "followup", durationMs: number) {
    this.clearListenWindow();

    this.activeListenType = type;
    this.activeListenUntil = Date.now() + durationMs;
    this.snapshot = {
      ...this.snapshot,
      speechStatus: type === "auto" ? "open-listen-window" : "followup-listen-window"
    };

    this.listenTimer = setTimeout(() => {
      this.clearListenWindow();
      this.conversationTurns = 0;
      this.restoreStatus();
      this.emitSnapshot();
    }, durationMs);

    this.listenTick = setInterval(() => {
      this.emitSnapshot();
    }, 250);
  }

  private clearListenWindow() {
    if (this.listenTimer) {
      clearTimeout(this.listenTimer);
      this.listenTimer = null;
    }

    if (this.listenTick) {
      clearInterval(this.listenTick);
      this.listenTick = null;
    }

    this.activeListenUntil = null;
    this.activeListenType = null;
    this.setSpeechBaseline();
  }

  private canAcceptSpeech(text: string) {
    if (!this.snapshot.settings.wakeWordEnabled) {
      return true;
    }

    if (this.activeListenUntil && this.activeListenUntil > Date.now()) {
      return true;
    }

    const normalized = text.toLowerCase();
    return this.snapshot.settings.wakeWords.some((word) =>
      normalized.startsWith(word.toLowerCase())
    );
  }

  private matchWakeWord(text: string) {
    if (!this.snapshot.settings.wakeWordEnabled) {
      return null;
    }

    const normalized = text.toLowerCase().trim();

    return (
      this.snapshot.settings.wakeWords.find((word) =>
        normalized.startsWith(word.toLowerCase())
      ) ?? null
    );
  }

  private stripWakeWord(text: string, wakeWord: string) {
    return text
      .slice(wakeWord.length)
      .replace(/^[,\s.!?~\-:]+/, "")
      .trim();
  }

  private restoreStatus() {
    if (this.snapshot.analysisStatus === "running") {
      this.snapshot = {
        ...this.snapshot,
        appStatus: "analyzing"
      };
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      appStatus: this.snapshot.detectedGame?.profile ? "ready" : "idle"
    };
  }

  private log(level: LogLevel, scope: LogScope, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      id: createId("log"),
      level,
      scope,
      message,
      timestamp: Date.now(),
      data
    };

    this.snapshot = {
      ...this.snapshot,
      logs: [entry, ...this.snapshot.logs].slice(0, DEFAULT_LOG_LIMIT)
    };
  }

  private emitSnapshot() {
    this.emitter.emit("snapshot", this.getSnapshot());
  }
}
