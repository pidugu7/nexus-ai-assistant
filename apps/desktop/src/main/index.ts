import { app, BrowserWindow, ipcMain, shell, globalShortcut } from "electron";
import { join } from "path";
import { NEXUS_IPC, windowActionSchema } from "@nexus/shared";

// Keep in sync with packages/shared/src/csp.ts and docs/ARCHITECTURE.md
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';";
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*;";

let mainWindow: BrowserWindow | null = null;

function createLogEntry(level: "info" | "warn" | "error", message: string) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, entry);
  }
  const prefix = level === "error" ? "[NEXUS][error]" : level === "warn" ? "[NEXUS][warn]" : "[NEXUS]";
  if (level === "error") console.error(prefix, message);
  else if (level === "warn") console.warn(prefix, message);
  else console.log(prefix, message);
  return entry;
}

function registerIpcHandlers(): void {
  ipcMain.handle("nexus:ping", async () => {
    return { ok: true, message: "pong" };
  });

  ipcMain.handle(NEXUS_IPC.WINDOW_MINIMIZE, async (_e, payload) => {
    const parsed = windowActionSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Invalid minimize payload");
    if (mainWindow) mainWindow.minimize();
    return { ok: true };
  });

  ipcMain.handle(NEXUS_IPC.WINDOW_MAXIMIZE, async (_e, payload) => {
    const parsed = windowActionSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Invalid maximize payload");
    if (!mainWindow) return { ok: false };
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { ok: true };
  });

  ipcMain.handle(NEXUS_IPC.WINDOW_CLOSE, async (_e, payload) => {
    const parsed = windowActionSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Invalid close payload");
    if (mainWindow) mainWindow.close();
    return { ok: true };
  });

  ipcMain.handle(NEXUS_IPC.WINDOW_TOGGLE_FULLSCREEN, async (_e, payload) => {
    const parsed = windowActionSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Invalid fullscreen payload");
    if (mainWindow) {
      const next = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(next);
      return { ok: true, isFullscreen: next };
    }
    return { ok: false };
  });

  ipcMain.handle(NEXUS_IPC.WINDOW_IS_MAXIMIZED, async () => {
    return { isMaximized: mainWindow?.isMaximized() ?? false };
  });

  ipcMain.handle(NEXUS_IPC.WINDOW_IS_FULLSCREEN, async () => {
    return { isFullscreen: mainWindow?.isFullScreen() ?? false };
  });
}

function registerKillSwitch(): void {
  const accelerator = "Ctrl+Alt+Shift+K";
  const ok = globalShortcut.register(accelerator, () => {
    const payload = { reason: "kill-switch", timestamp: new Date().toISOString() };
    createLogEntry("warn", `Kill-switch activated (${accelerator}) — emitting system.kill`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(NEXUS_IPC.SYSTEM_KILL, payload);
    }
  });
  if (ok) {
    createLogEntry("info", `Global hotkey registered: ${accelerator}`);
  } else {
    createLogEntry("warn", `Global hotkey registration failed: ${accelerator} (already in use)`);
  }
}

function createWindow(): void {
  const isDev = !app.isPackaged || !!process.env["ELECTRON_RENDERER_URL"];

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    backgroundColor: "#04070a",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // CSP: strict in production, relaxed for Vite HMR in dev only.
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [isDev ? DEV_CSP : PROD_CSP],
      },
    });
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
    createLogEntry("info", "Window ready-to-show");
  });

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send(NEXUS_IPC.WINDOW_ON_MAXIMIZED_CHANGED, { isMaximized: true });
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send(NEXUS_IPC.WINDOW_ON_MAXIMIZED_CHANGED, { isMaximized: false });
  });
  mainWindow.on("enter-full-screen", () => {
    mainWindow?.webContents.send(NEXUS_IPC.WINDOW_ON_FULLSCREEN_CHANGED, { isFullscreen: true });
  });
  mainWindow.on("leave-full-screen", () => {
    mainWindow?.webContents.send(NEXUS_IPC.WINDOW_ON_FULLSCREEN_CHANGED, { isFullscreen: false });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // F11 fullscreen toggle — handled in main so it works even without focus on input
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      event.preventDefault();
      if (mainWindow) {
        const next = !mainWindow.isFullScreen();
        mainWindow.setFullScreen(next);
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  createLogEntry("info", "App started — window created");
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.nexus.ai");
  registerIpcHandlers();
  createWindow();
  registerKillSwitch();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
