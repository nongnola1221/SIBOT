import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
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
  downloadUpdate: () => ipcRenderer.invoke("sibot:download-update") as Promise<UpdateStatus | null>,
  installUpdate: () => ipcRenderer.invoke("sibot:install-update") as Promise<boolean>,
  openExternal: (url: string) => ipcRenderer.invoke("sibot:open-external", url) as Promise<boolean>,
  listCaptureSources: () =>
    ipcRenderer.invoke("sibot:list-capture-sources") as Promise<CaptureSourceInfo[]>,
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
