import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "path";

// Keep in sync with packages/shared/src/csp.ts and docs/ARCHITECTURE.md
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';";
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*;";

// IPC validation helpers (zod in future phases)
function registerIpcHandlers(): void {
  ipcMain.handle("nexus:ping", async () => {
    return { ok: true, message: "pong" };
  });
}

function createWindow(): void {
  const isDev = !app.isPackaged || !!process.env["ELECTRON_RENDERER_URL"];

  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // CSP: strict in production, relaxed for Vite HMR in dev only.
  // See packages/shared/src/csp.ts — never allow unsafe-eval/ws in prod.
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [isDev ? DEV_CSP : PROD_CSP]
      }
    });
  });

  win.on("ready-to-show", () => {
    win.show();
    // Auto-open DevTools in dev only (per task requirement)
    if (isDev) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer, load file for production
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.nexus.ai");

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
