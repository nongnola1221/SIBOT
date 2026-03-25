import type {
  CaptureSourceInfo,
  RuntimeCommand,
  RuntimeSnapshot,
  UpdateStatus,
  UserSettings
} from "@sibot/shared";

declare global {
  interface Window {
    sibot: {
      getSnapshot(): Promise<RuntimeSnapshot | null>;
      getUpdateStatus(): Promise<UpdateStatus | null>;
      updateSettings(patch: Partial<UserSettings>): Promise<void>;
      command(command: RuntimeCommand): Promise<unknown>;
      checkForUpdates(): Promise<UpdateStatus | null>;
      downloadUpdate(): Promise<UpdateStatus | null>;
      installUpdate(): Promise<boolean>;
      openExternal(url: string): Promise<boolean>;
      listCaptureSources(): Promise<CaptureSourceInfo[]>;
      onSnapshot(handler: (snapshot: RuntimeSnapshot) => void): () => void;
      onUpdateStatus(handler: (status: UpdateStatus) => void): () => void;
    };
  }
}

export {};
