import type { AnalysisEvent, AnalysisEventType, GameProfile } from "@sibot/shared";
import { createId, pickRandom, randomInt } from "@sibot/shared";

const DEFAULT_CONTEXTS: Record<AnalysisEventType, string> = {
  death: "무빙 꼬이다가 그대로 잘림",
  lowAccuracyBurst: "가까운 거리에서 탄만 열심히 뿌림",
  missedEasyKill: "거의 공짜 킬인데 마무리를 못 함",
  soloOverextend: "백업 없이 혼자 깊게 들어갔다가 터짐",
  abilityUnusedDeath: "쓸 수 있는 스킬 들고 있다가 그대로 누움",
  idleAdlibWindow: "잠깐 텐션 흔들리는 구간",
  followupConversationWindowOpen: "시봇 발화 직후 추가 대화 가능",
  ultUnusedOnDeath: "궁극기 끝까지 아끼다가 리스폰 감",
  isolatedDive: "들어가는 각은 봤는데 나오는 각은 못 봄",
  failedCloseRangeDuel: "붙은 교전인데도 반응이 늦음",
  ignoredCover: "옆에 엄폐 있는데 굳이 맨몸 교전",
  poorUltTiming: "궁 타이밍이 판을 살리기보다 더 꼬임",
  whiffBurst: "마우스만 격하게 흔들고 탄은 비움",
  dryPeekFailure: "정보 없이 피크했다가 바로 눕힘",
  utilHeldOnDeath: "유틸 들고 있다가 끝까지 못 씀",
  lostAdvantageDuel: "유리한 교전인데도 정리가 안 됨"
};

const EVENT_SEVERITY: Partial<Record<AnalysisEventType, number>> = {
  death: 0.7,
  lowAccuracyBurst: 0.52,
  missedEasyKill: 0.63,
  soloOverextend: 0.76,
  abilityUnusedDeath: 0.74,
  idleAdlibWindow: 0.2,
  followupConversationWindowOpen: 0.1,
  ultUnusedOnDeath: 0.88,
  isolatedDive: 0.81,
  failedCloseRangeDuel: 0.68,
  ignoredCover: 0.65,
  poorUltTiming: 0.79,
  whiffBurst: 0.64,
  dryPeekFailure: 0.67,
  utilHeldOnDeath: 0.73,
  lostAdvantageDuel: 0.61
};

export class MockAnalysisEngine {
  private timer: NodeJS.Timeout | null = null;
  private currentProfile: GameProfile | null = null;
  private currentHandler: ((event: AnalysisEvent) => void) | null = null;

  start(profile: GameProfile, onEvent: (event: AnalysisEvent) => void) {
    this.stop();
    this.currentProfile = profile;
    this.currentHandler = onEvent;
    this.scheduleNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  inject(profile: GameProfile, eventType?: AnalysisEventType) {
    const type = eventType ?? pickRandom(profile.supportedEvents) ?? "death";
    return this.buildEvent(profile, type);
  }

  private scheduleNext() {
    if (!this.currentProfile || !this.currentHandler) {
      return;
    }

    this.timer = setTimeout(() => {
      if (!this.currentProfile || !this.currentHandler) {
        return;
      }

      const eventType = pickRandom(this.currentProfile.supportedEvents) ?? "death";
      this.currentHandler(this.buildEvent(this.currentProfile, eventType));
      this.scheduleNext();
    }, randomInt(10000, 18000));
  }

  private buildEvent(profile: GameProfile, type: AnalysisEventType): AnalysisEvent {
    const now = Date.now();
    const severity = EVENT_SEVERITY[type] ?? 0.55;

    return {
      id: createId("evt"),
      type,
      timestamp: now,
      game: profile.id,
      severity,
      tags: [profile.id, type],
      snapshotMetadata: {
        simulated: true,
        detector: "mock-analysis-engine",
        severityBucket: severity > 0.75 ? "high" : severity > 0.5 ? "mid" : "low"
      },
      confidence: Number((0.65 + Math.random() * 0.3).toFixed(2)),
      contextSummary: DEFAULT_CONTEXTS[type],
      cooldownGroup: type,
      priorityScore: Math.round((severity * 100 + Math.random() * 18) * 10) / 10
    };
  }
}

