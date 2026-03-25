import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { RuntimeCommand, RuntimeSnapshot, UserSettings } from "@sibot/shared";

const api = {
  getSnapshot: () => ipcRenderer.invoke("sibot:get-snapshot") as Promise<RuntimeSnapshot | null>,
  updateSettings: (patch: Partial<UserSettings>) =>
    ipcRenderer.invoke("sibot:update-settings", patch) as Promise<void>,
  command: (command: RuntimeCommand) =>
    ipcRenderer.invoke("sibot:command", command) as Promise<unknown>,
  onSnapshot: (handler: (snapshot: RuntimeSnapshot) => void) => {
    const listener = (_event: IpcRendererEvent, snapshot: RuntimeSnapshot) => {
      handler(snapshot);
    };

    ipcRenderer.on("sibot:snapshot", listener);

    return () => {
      ipcRenderer.removeListener("sibot:snapshot", listener);
    };
  }
};

contextBridge.exposeInMainWorld("sibot", api);

export type SibotBridge = typeof api;
