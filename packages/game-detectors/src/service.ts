import si from "systeminformation";
import type { GameDetection, GameProfile, RunningGameInfo, UserSettings } from "@sibot/shared";
import { uniqueBy } from "@sibot/shared";
import { getActiveWindowSnapshot } from "./activeWindow";
import { GAME_PROFILES } from "./profiles";

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const stripExe = (value: string) => value.replace(/\.exe$/i, "");

export class GameDetectionService {
  constructor(private readonly profiles: GameProfile[] = GAME_PROFILES) {}

  resolveGameProfile(processName?: string | null, windowTitle?: string | null) {
    const normalizedProcess = normalize(processName);
    const normalizedTitle = normalize(windowTitle);
    const processVariants = new Set([normalizedProcess, stripExe(normalizedProcess)]);

    return (
      this.profiles.find((profile) => {
        const processMatch = profile.processNames.some((candidate) =>
          processVariants.has(normalize(candidate)) || processVariants.has(stripExe(normalize(candidate)))
        );
        const titleMatch = profile.windowTitleHints.some((candidate) =>
          normalizedTitle.includes(normalize(candidate))
        );

        return processMatch || titleMatch;
      }) ?? null
    );
  }

  async detectRunningGames(): Promise<RunningGameInfo[]> {
    try {
      const processes = await si.processes();
      const matches: RunningGameInfo[] = [];

      for (const processInfo of processes.list) {
        const processName = normalize(processInfo.name);
        const profile = this.resolveGameProfile(processName, processInfo.command);

        if (!profile) {
          continue;
        }

        matches.push({
          profile,
          processName: processInfo.name ?? profile.processNames[0],
          pid: processInfo.pid ?? undefined
        });
      }

      return uniqueBy(matches, (item) => `${item.profile.id}:${item.processName}`);
    } catch {
      return [];
    }
  }

  async getActiveGame(settings: UserSettings): Promise<GameDetection | null> {
    const runningGames = await this.detectRunningGames();

    let windowTitle: string | null = null;
    let processName: string | null = null;
    let profile: GameProfile | null = null;

    try {
      const active = await getActiveWindowSnapshot();
      windowTitle = active?.title ?? null;
      processName = active?.processName ?? null;
      profile = this.resolveGameProfile(processName, windowTitle);
    } catch {
      profile = null;
    }

    if (!profile && runningGames.length === 1) {
      profile = runningGames[0].profile;
      processName = runningGames[0].processName;
    }

    return {
      profile,
      processName,
      activeWindowTitle: windowTitle,
      detectedAt: Date.now(),
      source: profile ? "process" : "inactive",
      runningGames
    };
  }
}
