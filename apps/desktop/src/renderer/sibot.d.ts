import type { RuntimeCommand, RuntimeSnapshot, UserSettings } from "@sibot/shared";

declare global {
  interface Window {
    sibot: {
      getSnapshot(): Promise<RuntimeSnapshot | null>;
      updateSettings(patch: Partial<UserSettings>): Promise<void>;
      command(command: RuntimeCommand): Promise<unknown>;
      onSnapshot(handler: (snapshot: RuntimeSnapshot) => void): () => void;
    };
  }
}

export {};

