import type { AnalysisEvent, LogEntry, Utterance } from "./types";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const pickRandom = <T>(items: T[]): T | undefined => {
  if (items.length === 0) {
    return undefined;
  }

  return items[Math.floor(Math.random() * items.length)];
};

export const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const uniqueBy = <T, K>(items: T[], selector: (item: T) => K): T[] => {
  const seen = new Set<K>();

  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const limitList = <T>(items: T[], limit: number): T[] =>
  items.slice(0, limit);

export const sampleWithoutRecent = (
  templates: string[],
  recentUtterances: Utterance[],
  recentLimit = 4
) => {
  const recentSet = new Set(recentUtterances.slice(0, recentLimit).map((item) => item.text));
  const filtered = templates.filter((template) => !recentSet.has(template));
  const pool = filtered.length > 0 ? filtered : templates;

  return pickRandom(pool);
};

export const hasRecentSimilarEvent = (
  event: AnalysisEvent,
  recentEvents: AnalysisEvent[],
  withinMs: number
) =>
  recentEvents.some(
    (recent) =>
      recent.type === event.type && Math.abs(recent.timestamp - event.timestamp) <= withinMs
  );

export const relativeMs = (target: number, now = Date.now()) => Math.max(0, target - now);

export const formatClockTime = (timestamp: number) =>
  new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(timestamp);

export const summarizeLog = (entry: LogEntry) =>
  `[${entry.scope}] ${entry.message}`;

