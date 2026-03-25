import { CooldownController } from "@sibot/event-engine";
import type {
  AnalysisEvent,
  AnalysisEventType,
  SibotMode,
  UserSettings,
  Utterance
} from "@sibot/shared";
import { createId, sampleWithoutRecent } from "@sibot/shared";
import type { ConversationMemory } from "../runtime/memory";
import { templateCatalogue, type TemplateCategory } from "./templates";

const PROFANITY_MARKERS = ["병신", "새끼", "개망", "미친", "처", "개무", "개아픈"];

const answerCategoryFromQuestion = (question: string): TemplateCategory => {
  const normalized = question.toLowerCase();

  if (
    /내 잘못|내탓|내 탓|누구 잘못|my fault|blame|왜 내가/.test(normalized)
  ) {
    return "answer_blame";
  }

  if (/어떻게|어케|전략|뭐해야|should|how/.test(normalized)) {
    return "answer_strategy";
  }

  if (/억울|억까|아니|내가\?|정말\?|why me/.test(normalized)) {
    return "answer_selfdefense";
  }

  return "answer_reaction";
};

const eventCategory = (type: AnalysisEventType): TemplateCategory => type;

const hasProfanity = (text: string) => PROFANITY_MARKERS.some((marker) => text.includes(marker));

const interpolate = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");

export class UtteranceEngine {
  private readonly profanityCooldown = new CooldownController();
  private profanityStreak = 0;
  private lastSpokenAt = 0;

  constructor(private readonly memory: ConversationMemory) {}

  buildEventUtterance(event: AnalysisEvent, settings: UserSettings): Utterance | null {
    const now = Date.now();
    if (now - this.lastSpokenAt < settings.eventCooldownMs) {
      return null;
    }

    const mode = this.resolveModeForEvent(event, settings);
    const text = this.pickTemplate(eventCategory(event.type), mode, event.contextSummary);

    if (!text || !this.canUseText(text, settings)) {
      return null;
    }

    return this.finalizeUtterance(
      text,
      event,
      event.severity >= 0.7 && mode === "abuse-lite" ? "instant-abuse" : "instant-taunt",
      mode
    );
  }

  buildAdlibUtterance(settings: UserSettings): Utterance | null {
    const mode = this.resolveModeForAdlib(settings);
    const text = this.pickTemplate("idleAdlibWindow", mode, "분위기가 쎄하다");

    if (!text || !this.canUseText(text, settings)) {
      return null;
    }

    return this.finalizeUtterance(text, null, "adlib", mode);
  }

  buildAnswerUtterance(question: string, settings: UserSettings): Utterance | null {
    const latestEvent = this.memory.getLatestEvent();
    const category = answerCategoryFromQuestion(question);
    const mode = this.resolveAnswerMode(settings);
    const eventHint = latestEvent?.contextSummary ?? "방금 장면";
    const text = this.pickTemplate(category, mode, eventHint);

    if (!text || !this.canUseText(text, settings)) {
      return null;
    }

    return this.finalizeUtterance(text, latestEvent, "answer", mode, {
      source: "answer",
      tags: ["answer", category]
    });
  }

  private resolveModeForEvent(event: AnalysisEvent, settings: UserSettings): SibotMode {
    if (settings.mode === "mixed") {
      if (
        settings.profanityEnabled &&
        settings.profanityLevel > 0 &&
        event.severity >= 0.75 &&
        this.profanityCooldown.canTrigger(
          "profanity",
          settings.profanityMinimumIntervalMs,
          Date.now()
        )
      ) {
        return "abuse-lite";
      }

      return "taunt";
    }

    if (settings.mode === "abuse-lite" && !settings.profanityEnabled) {
      return "taunt";
    }

    return settings.mode;
  }

  private resolveModeForAdlib(settings: UserSettings): SibotMode {
    if (settings.mode === "abuse-lite" && settings.profanityEnabled && settings.profanityLevel > 1) {
      return "mixed";
    }

    return settings.mode === "clean" ? "clean" : "taunt";
  }

  private resolveAnswerMode(settings: UserSettings): SibotMode {
    if (settings.mode === "mixed") {
      return settings.profanityEnabled ? "taunt" : "clean";
    }

    if (settings.mode === "abuse-lite" && !settings.profanityEnabled) {
      return "taunt";
    }

    return settings.mode;
  }

  private pickTemplate(category: TemplateCategory, mode: SibotMode, eventHint: string) {
    const modeTemplates = templateCatalogue[category]?.[mode];
    const fallbackTemplates = templateCatalogue[category]?.taunt ?? [];
    const selected = sampleWithoutRecent(
      modeTemplates && modeTemplates.length > 0 ? modeTemplates : fallbackTemplates,
      this.memory.getUtterances()
    );

    if (!selected) {
      return null;
    }

    return interpolate(selected, { eventHint });
  }

  private canUseText(text: string, settings: UserSettings) {
    const profanityUsed = hasProfanity(text);

    if (!profanityUsed) {
      return true;
    }

    if (!settings.profanityEnabled) {
      return false;
    }

    if (this.profanityStreak >= 1) {
      return false;
    }

    return this.profanityCooldown.canTrigger(
      "profanity",
      settings.profanityMinimumIntervalMs,
      Date.now()
    );
  }

  private finalizeUtterance(
    text: string,
    event: AnalysisEvent | null,
    type: Utterance["type"],
    mode: SibotMode,
    overrides?: Partial<Utterance>
  ): Utterance {
    const now = Date.now();
    const profanityUsed = hasProfanity(text);
    this.lastSpokenAt = now;
    this.profanityStreak = profanityUsed ? this.profanityStreak + 1 : 0;

    if (profanityUsed) {
      this.profanityCooldown.markTriggered("profanity", now);
    }

    return {
      id: createId("utt"),
      type,
      text,
      mode,
      createdAt: now,
      eventId: event?.id,
      profanityUsed,
      priority: event?.priorityScore ?? 10,
      tags: overrides?.tags ?? [type, mode],
      source: overrides?.source ?? "template"
    };
  }
}

