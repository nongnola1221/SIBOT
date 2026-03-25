import { z } from "zod";
import type { UserSettings } from "@sibot/shared";
import { defaultSettings } from "./defaults";

const settingsSchema = z.object({
  aiName: z.string().min(1).max(32),
  wakeWords: z.array(z.string().min(1).max(32)).min(1).max(8),
  mode: z.enum(["clean", "taunt", "mixed", "abuse-lite"]),
  profanityEnabled: z.boolean(),
  profanityLevel: z.number().min(0).max(3),
  profanityCooldownSec: z.number().min(5).max(120),
  adlibEnabled: z.boolean(),
  adlibFrequency: z.number().min(0).max(1),
  overlayEnabled: z.boolean(),
  overlayMode: z.enum(["app-overlay", "obs-browser", "both"]),
  overlayStyle: z.enum(["bubble", "chat", "subtitle"]),
  overlayPosition: z.enum([
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
    "bottom-center"
  ]),
  overlayDurationMs: z.number().min(1200).max(15000),
  overlayHistoryCount: z.number().int().min(1).max(12),
  overlayFontScale: z.number().min(0.7).max(1.8),
  overlayOpacity: z.number().min(0.1).max(1),
  overlayShowNickname: z.boolean(),
  obsOverlayPort: z.number().int().min(1024).max(65535),
  ttsEnabled: z.boolean(),
  ttsVolume: z.number().min(0).max(1),
  ttsRate: z.number().min(0.5).max(1.6),
  microphoneDeviceId: z.string().min(1),
  wakeWordEnabled: z.boolean(),
  autoListenAfterSpeak: z.boolean(),
  autoListenDurationMs: z.number().min(1000).max(10000),
  followupListenDurationMs: z.number().min(1000).max(8000),
  maxConversationTurns: z.number().int().min(1).max(6),
  backgroundNoiseSensitivity: z.number().min(0).max(1),
  autoStartOnGameDetected: z.boolean(),
  selectedGameProfile: z.enum(["overwatch2", "valorant", "pubg", "league"]),
  captureSourceId: z.string(),
  captureAnalysisEnabled: z.boolean(),
  captureSampleIntervalMs: z.number().int().min(200).max(5000),
  eventCooldownMs: z.number().min(1000).max(30000),
  profanityMinimumIntervalMs: z.number().min(4000).max(120000),
  developerMode: z.boolean(),
  debugMode: z.boolean(),
  eventSensitivity: z.number().min(0).max(1),
  priorityConflictMode: z.enum(["highest", "latest", "queue"])
});

export type SettingsInput = Partial<UserSettings>;

export const validateSettings = (input: unknown): UserSettings =>
  settingsSchema.parse(input);

export const mergeSettings = (input: SettingsInput): UserSettings =>
  settingsSchema.parse({
    ...defaultSettings,
    ...input,
    wakeWords:
      input.wakeWords && input.wakeWords.length > 0
        ? input.wakeWords.filter(Boolean)
        : defaultSettings.wakeWords
  });

export const sanitizeSettings = (input: unknown): UserSettings => {
  try {
    return mergeSettings((input ?? {}) as SettingsInput);
  } catch {
    return defaultSettings;
  }
};

export { settingsSchema };
