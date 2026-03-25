import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultSettings, sanitizeSettings } from "@sibot/config";
import type { UserSettings } from "@sibot/shared";

export class SettingsStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<UserSettings> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return sanitizeSettings(JSON.parse(raw));
    } catch {
      await this.save(defaultSettings);
      return defaultSettings;
    }
  }

  async save(settings: UserSettings) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(settings, null, 2), "utf8");
  }
}

