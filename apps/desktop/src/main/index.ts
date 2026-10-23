import { app, BrowserWindow, ipcMain, shell, globalShortcut } from "electron";
import { join } from "path";
import { NEXUS_IPC, windowActionSchema, NexusEventSchema, RENDERER_PUBLISH_ALLOWLIST } from "@nexus/shared";
import { createMachine, nextState } from "@nexus/shared";
import { TypedEventBus } from "./eventBus.js";
import { createFileLogStore } from "./fileLogStore.js";

const PROD_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self';";
const DEV_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*;";

let mainWindow: BrowserWindow | null = null;
const bus = new TypedEventBus();
const machine = createMachine("idle");
const logStore = createFileLogStore();

async function persistAndBroadcast(event: { id: string; timestamp: string; source: string; type: string; payload: unknown; level?: string; message?: string }) {
  const level = (event.level as "info" | "warn" | "error") ?? (event.type === "error" || event.type === "llm.error" || event.type === "tool.failed" ? "error" : event.type.includes("warning") ? "warn" : "info");
  const message = event.message ?? `${event.type}${event.source === "simulated" ? " (SIMULATED)" : ""}`;
  const logEntry = { id: event.id, timestamp: event.timestamp, level, message: event.source === "simulated" ? `${message} — SIMULATED` : message, source: event.source, type: event.type, payload: event.payload };
  await logStore.append(logEntry as never);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(NEXUS_IPC.BUS_SUBSCRIBE, event);
    mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, logEntry);
  }
  return logEntry;
}

function handleStateTransition(event: { type: string; payload: unknown; id: string }) {
  const from = machine.getState();
  const res = machine.transition({ type: event.type, payload: event.payload });
  if (!res.ok) {
    const warn = { id: `${Date.now()}-warn`, timestamp: new Date().toISOString(), source: "system" as const, type: "system.warning" as const, payload: { message: res.reason }, level: "warn" as const, message: res.reason };
    bus.publish(warn);
    persistAndBroadcast(warn as never);
    return { ok: false as const, reason: res.reason, from };
  }
  const to = res.to;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(NEXUS_IPC.STATE_CHANGED, { from, to, eventId: event.id });
  const lvl = to === "error" || to === "warning" ? "warn" : "info";
  persistAndBroadcast({ id: `${Date.now()}-state`, timestamp: new Date().toISOString(), source: "system", type: `state:${from}->${to}`, payload: {}, level: lvl, message: `state ${from} → ${to}` } as never);
  return { ok: true as const, from, to };
}

let didBootLog = false;
function registerIpcHandlers() {
  ipcMain.handle("nexus:ping", async () => ({ ok: true, message: "pong" }));
  ipcMain.handle(NEXUS_IPC.WINDOW_MINIMIZE, async (_e, payload) => {
    const p = windowActionSchema.safeParse(payload);
    if (!p.success) throw new Error("Invalid minimize payload");
    mainWindow?.minimize();
    return { ok: true };
  });
  ipcMain.handle(NEXUS_IPC.WINDOW_MAXIMIZE, async (_e, payload) => {
    const p = windowActionSchema.safeParse(payload);
    if (!p.success) throw new Error("Invalid maximize payload");
    if (!mainWindow) return { ok: false };
    if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
    return { ok: true };
  });
  ipcMain.handle(NEXUS_IPC.WINDOW_CLOSE, async (_e, payload) => {
    const p = windowActionSchema.safeParse(payload);
    if (!p.success) throw new Error("Invalid close payload");
    mainWindow?.close();
    return { ok: true };
  });
  ipcMain.handle(NEXUS_IPC.WINDOW_TOGGLE_FULLSCREEN, async (_e, payload) => {
    const p = windowActionSchema.safeParse(payload);
    if (!p.success) throw new Error("Invalid fullscreen payload");
    if (mainWindow) {
      const next = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(next);
      return { ok: true, isFullscreen: next };
    }
    return { ok: false };
  });
  ipcMain.handle(NEXUS_IPC.WINDOW_IS_MAXIMIZED, async () => ({ isMaximized: mainWindow?.isMaximized() ?? false }));
  ipcMain.handle(NEXUS_IPC.WINDOW_IS_FULLSCREEN, async () => ({ isFullscreen: mainWindow?.isFullScreen() ?? false }));
  ipcMain.handle(NEXUS_IPC.STATE_GET, async () => ({ state: machine.getState() }));
  ipcMain.handle(NEXUS_IPC.LOG_GET, async (_e, args) => {
    const count = typeof (args as { count?: number })?.count === "number" ? (args as { count: number }).count : 200;
    return logStore.loadLast(count);
  });
  ipcMain.handle(NEXUS_IPC.LOG_CLEAR_VIEW, async () => ({ ok: true }));
  ipcMain.handle(NEXUS_IPC.BUS_PUBLISH, async (_e, raw) => {
    const isDev = !app.isPackaged;
    const parsed = NexusEventSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: parsed.error.message };
    const ev = parsed.data as unknown as { source: string; type: string };
    if (!isDev && ev.source === "simulated") return { ok: false, reason: "simulated not allowed in production" };
    if (ev.source === "simulated" && !RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)) return { ok: false, reason: "allowlist" };
    const res = bus.publish(raw, { fromRenderer: true });
    if (!res.ok) return { ok: false, reason: res.reason };
    await persistAndBroadcast(res.event as never);
    if (nextState(machine.getState(), res.event.type, res.event.payload) !== null || res.event.type === "system.kill" || res.event.type === "error" || res.event.type === "system.warning") {
      handleStateTransition({ type: res.event.type, payload: res.event.payload, id: res.event.id });
    }
    return { ok: true };
  });
}

function registerKillSwitch() {
  const accelerator = "Ctrl+Alt+Shift+K";
  const ok = globalShortcut.register(accelerator, () => {
    const ev = { id: `${Date.now()}-kill`, timestamp: new Date().toISOString(), source: "system" as const, type: "system.kill" as const, payload: { reason: "kill-switch" } };
    bus.publish(ev);
    persistAndBroadcast(ev as never);
    handleStateTransition({ type: ev.type, payload: ev.payload, id: ev.id });
  });
  const entry = {
    id: `${Date.now()}-hk`,
    timestamp: new Date().toISOString(),
    level: ok ? ("info" as const) : ("warn" as const),
    message: ok ? `Global hotkey registered: ${accelerator}` : `Global hotkey registration failed: ${accelerator} (already in use)`,
    source: "system",
    type: "log:entry",
    payload: {},
  };
  // do not double log on reload — persist only once per launch via didBootLog guard below
  if (!didBootLog) {
    logStore.append(entry as never);
  }
}

function createWindow() {
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
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) =>
    cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [isDev ? DEV_CSP : PROD_CSP] } })
  );
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });
  for (const ev of ["maximize", "unmaximize"] as const) {
    (mainWindow as unknown as { on: (e: string, cb: () => void) => void }).on(ev, () => {
      mainWindow?.webContents.send(NEXUS_IPC.WINDOW_ON_MAXIMIZED_CHANGED, { isMaximized: ev === "maximize" });
    });
  }
  mainWindow.on("enter-full-screen", () => mainWindow?.webContents.send(NEXUS_IPC.WINDOW_ON_FULLSCREEN_CHANGED, { isFullscreen: true }));
  mainWindow.on("leave-full-screen", () => mainWindow?.webContents.send(NEXUS_IPC.WINDOW_ON_FULLSCREEN_CHANGED, { isFullscreen: false }));
  mainWindow.on("closed", () => (mainWindow = null));
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      event.preventDefault();
      if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
    if (input.key.toLowerCase() === "d" && input.control && input.alt && input.shift && input.type === "keyDown") {
      event.preventDefault();
      // dev panel toggle is handled in renderer; main just needs to allow
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  else mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.executeJavaScript(`window.__NEXUS_IS_PACKAGED__=${app.isPackaged};`);
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.nexus.ai");
  registerIpcHandlers();
  createWindow();
  registerKillSwitch();
  // single boot log per launch — fixed duplicate bug (was in both main and renderer)
  if (!didBootLog) {
    didBootLog = true;
    const bootEv = { id: `boot-${Date.now()}`, timestamp: new Date().toISOString(), source: "system" as const, type: "system.warning" as const, payload: { message: "App started" }, level: "info" as const, message: "App started" };
    bus.publish(bootEv);
    await logStore.append({ id: bootEv.id, timestamp: bootEv.timestamp, level: "info", message: "App started", source: "system", type: "system.warning", payload: { message: "App started" } } as never);
  }
  // forward bus to renderer and handle transitions centrally
  bus.subscribe((ev) => {
    // error isolation already handled in bus
    if (ev.type === "system.kill" || ev.type === "error" || ev.type.startsWith("voice.") || ev.type.startsWith("llm.") || ev.type.startsWith("tool.") || ev.type.startsWith("permission.") || ev.type.startsWith("task.step.") || ev.type === "system.warning") {
      // state transitions are already done via publish path for renderer; for main-originated kills also
    }
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
