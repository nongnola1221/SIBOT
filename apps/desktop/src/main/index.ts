import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import { SibotRuntime } from "@sibot/core";
import type {
  RuntimeCommand,
  RuntimeSnapshot,
  UpdateStatus,
  UserSettings
} from "@sibot/shared";
import { ObsOverlayServer } from "./obsOverlayServer";
import { SettingsStore } from "./settingsStore";
import { UpdateManager } from "./updateManager";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let runtime: SibotRuntime | null = null;
let settingsStore: SettingsStore | null = null;
const obsOverlayServer = new ObsOverlayServer();
let updateManager: UpdateManager | null = null;

const preloadPath = path.join(__dirname, "../preload/index.mjs");
const rendererPath = path.join(__dirname, "../renderer/index.html");
const overlayPath = path.join(__dirname, "../renderer/overlay.html");

const rendererUrl = process.env.VITE_DEV_SERVER_URL ?? "";
const overlayUrl = rendererUrl ? new URL("overlay.html", rendererUrl).toString() : "";

const createMainWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 1200,
    minHeight: 840,
    backgroundColor: "#081118",
    title: "SIBOT",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(rendererPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (runtime) {
      mainWindow?.webContents.send("sibot:snapshot", runtime.getSnapshot());
    }
  });
};

const positionOverlayWindow = (settings: UserSettings) => {
  if (!overlayWindow) {
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const overlayWidth = 460;
  const overlayHeight = settings.overlayStyle === "subtitle" ? 200 : 360;
  const padding = 32;

  const positions: Record<UserSettings["overlayPosition"], { x: number; y: number }> = {
    "top-left": { x: padding, y: padding },
    "top-right": { x: width - overlayWidth - padding, y: padding },
    "bottom-left": { x: padding, y: height - overlayHeight - padding },
    "bottom-right": {
      x: width - overlayWidth - padding,
      y: height - overlayHeight - padding
    },
    "bottom-center": {
      x: Math.round(width / 2 - overlayWidth / 2),
      y: height - overlayHeight - padding
    }
  };

  const position = positions[settings.overlayPosition];

  overlayWindow.setBounds({
    x: position.x,
    y: position.y,
    width: overlayWidth,
    height: overlayHeight
  });
};

const shouldShowAppOverlay = (snapshot: RuntimeSnapshot) =>
  snapshot.settings.overlayEnabled &&
  (snapshot.settings.overlayMode === "app-overlay" || snapshot.settings.overlayMode === "both");

const hasFreshOverlayMessage = (snapshot: RuntimeSnapshot) =>
  snapshot.recentUtterances.some(
    (utterance) => Date.now() - utterance.createdAt <= snapshot.settings.overlayDurationMs
  );

const syncOverlayWindow = (snapshot: RuntimeSnapshot) => {
  if (!overlayWindow) {
    return;
  }

  positionOverlayWindow(snapshot.settings);

  if (shouldShowAppOverlay(snapshot) && hasFreshOverlayMessage(snapshot)) {
    overlayWindow.showInactive();
  } else {
    overlayWindow.hide();
  }
};

const createOverlayWindow = async () => {
  overlayWindow = new BrowserWindow({
    width: 460,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  if (isDev) {
    await overlayWindow.loadURL(overlayUrl);
  } else {
    await overlayWindow.loadFile(overlayPath);
  }

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  overlayWindow.webContents.on("did-finish-load", () => {
    if (runtime) {
      overlayWindow?.webContents.send("sibot:snapshot", runtime.getSnapshot());
    }
  });
};

const sendSnapshot = (snapshot: RuntimeSnapshot) => {
  obsOverlayServer.updateSnapshot(snapshot);
  void obsOverlayServer.ensureListening(snapshot.settings.obsOverlayPort);
  mainWindow?.webContents.send("sibot:snapshot", snapshot);
  overlayWindow?.webContents.send("sibot:snapshot", snapshot);
  syncOverlayWindow(snapshot);
};

const sendUpdateStatus = (status: UpdateStatus) => {
  mainWindow?.webContents.send("sibot:update-status", status);
  overlayWindow?.webContents.send("sibot:update-status", status);
};

const registerIpc = () => {
  ipcMain.handle("sibot:get-snapshot", () => runtime?.getSnapshot() ?? null);
  ipcMain.handle("sibot:get-update-status", () => updateManager?.getStatus() ?? null);
  ipcMain.handle("sibot:update-settings", async (_event, patch: Partial<UserSettings>) => {
    return runtime?.updateSettings(patch) ?? null;
  });
  ipcMain.handle("sibot:command", async (_event, command: RuntimeCommand) => {
    return runtime?.runCommand(command) ?? null;
  });
  ipcMain.handle("sibot:check-for-updates", async () => updateManager?.check() ?? null);
  ipcMain.handle("sibot:open-external", async (_event, url: string) => {
    if (!url) {
      return false;
    }

    await shell.openExternal(url);
    return true;
  });
};

const bootstrap = async () => {
  const settingsPath = path.join(app.getPath("userData"), "settings", "sibot.settings.json");
  settingsStore = new SettingsStore(settingsPath);
  const settings = await settingsStore.load();

  runtime = new SibotRuntime(settings, {
    persistSettings: async (nextSettings) => {
      await settingsStore?.save(nextSettings);
    }
  });
  updateManager = new UpdateManager((status) => {
    sendUpdateStatus(status);
  });

  await runtime.initialize();
  runtime.subscribe((snapshot) => {
    sendSnapshot(snapshot);
  });

  registerIpc();
  await createMainWindow();
  await createOverlayWindow();

  sendSnapshot(runtime.getSnapshot());
  sendUpdateStatus(updateManager.getStatus());

  if (app.isPackaged) {
    setTimeout(() => {
      void updateManager?.check();
    }, 3000);
  }
};

app.whenReady().then(async () => {
  await bootstrap();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
      await createOverlayWindow();
      if (runtime) {
        sendSnapshot(runtime.getSnapshot());
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void obsOverlayServer.stop();
  runtime?.dispose();
});
