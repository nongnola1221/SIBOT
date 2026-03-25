import {
  contextBridge,
  desktopCapturer,
  ipcRenderer,
  type IpcRendererEvent
} from "electron";
import type {
  CaptureSourceInfo,
  RuntimeCommand,
  RuntimeSnapshot,
  UpdateStatus,
  UserSettings
} from "@sibot/shared";

const api = {
  getSnapshot: () => ipcRenderer.invoke("sibot:get-snapshot") as Promise<RuntimeSnapshot | null>,
  getUpdateStatus: () =>
    ipcRenderer.invoke("sibot:get-update-status") as Promise<UpdateStatus | null>,
  updateSettings: (patch: Partial<UserSettings>) =>
    ipcRenderer.invoke("sibot:update-settings", patch) as Promise<void>,
  command: (command: RuntimeCommand) =>
    ipcRenderer.invoke("sibot:command", command) as Promise<unknown>,
  checkForUpdates: () => ipcRenderer.invoke("sibot:check-for-updates") as Promise<UpdateStatus | null>,
  openExternal: (url: string) => ipcRenderer.invoke("sibot:open-external", url) as Promise<boolean>,
  listCaptureSources: async (): Promise<CaptureSourceInfo[]> => {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      fetchWindowIcons: true,
      thumbnailSize: {
        width: 320,
        height: 180
      }
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      displayId: source.display_id,
      thumbnailDataUrl: source.thumbnail.toDataURL()
    }));
  },
  onSnapshot: (handler: (snapshot: RuntimeSnapshot) => void) => {
    const listener = (_event: IpcRendererEvent, snapshot: RuntimeSnapshot) => {
      handler(snapshot);
    };

    ipcRenderer.on("sibot:snapshot", listener);

    return () => {
      ipcRenderer.removeListener("sibot:snapshot", listener);
    };
  },
  onUpdateStatus: (handler: (status: UpdateStatus) => void) => {
    const listener = (_event: IpcRendererEvent, status: UpdateStatus) => {
      handler(status);
    };

    ipcRenderer.on("sibot:update-status", listener);

    return () => {
      ipcRenderer.removeListener("sibot:update-status", listener);
    };
  }
};

contextBridge.exposeInMainWorld("sibot", api);

export type SibotBridge = typeof api;
