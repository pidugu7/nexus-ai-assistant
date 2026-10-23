import { app, BrowserWindow, ipcMain, screen, shell, globalShortcut } from "electron";
import { join } from "path";
import { NEXUS_IPC, windowActionSchema, NexusEventSchema, RENDERER_PUBLISH_ALLOWLIST } from "@nexus/shared";
import { createMachine, nextState } from "@nexus/shared";
import { TypedEventBus } from "./eventBus.js";
import { createFileLogStore } from "./fileLogStore.js";
import { getClampedWindowBounds } from "./windowBounds.js";

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
    // TRACE HOP 6
    try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.BUS_SUBSCRIBE} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
    mainWindow.webContents.send(NEXUS_IPC.BUS_SUBSCRIBE, event);
    try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.LOG_ENTRY} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
    mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, logEntry);
  } else {
    try { console.log(`[HOP 6] main: webContents.send skipped - no window or destroyed`); } catch (_e) { void _e; }
  }
  return logEntry;
}

function sendToast(message: string, ok: boolean) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.TOAST} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
    mainWindow.webContents.send(NEXUS_IPC.TOAST, { message, ok });
  } else {
    try { console.log(`[HOP 6] main: webContents.send skipped for ${NEXUS_IPC.TOAST}`); } catch (_e) { void _e; }
  }
}

function handleStateTransition(event: { type: string; payload: unknown; id: string }) {
  // TRACE HOP 5
  try { console.log(`[HOP 5] main: state machine result start ${event.type} from=${machine.getState()}`); } catch (_e) { void _e; }
  const from = machine.getState();
  const res = machine.transition({ type: event.type, payload: event.payload });
  if (!res.ok) {
    try { console.log(`[HOP 5] main: state machine result rejection reason ${res.reason} old=${from}`); } catch (_e) { void _e; }
    const warn = { id: `${Date.now()}-warn`, timestamp: new Date().toISOString(), source: "system" as const, type: "system.warning" as const, payload: { message: res.reason }, level: "warn" as const, message: res.reason };
    bus.publish(warn);
    persistAndBroadcast(warn as never);
    sendToast(`${event.type}: REJECTED because ${res.reason}`, false);
    return { ok: false as const, reason: res.reason, from };
  }
  const to = res.to;
  try { console.log(`[HOP 5] main: state machine result old state ${from}, new state ${to}`); } catch (_e) { void _e; }
  // Kill from idle should not log pointless idle->idle
  if (from === to && event.type === "system.kill") {
    persistAndBroadcast({ id: `${Date.now()}-state`, timestamp: new Date().toISOString(), source: "system", type: "log:entry", payload: {}, level: "info", message: "kill: already idle" } as never);
    sendToast("kill: already idle", true);
    return { ok: true as const, from, to };
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.STATE_CHANGED} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
    mainWindow.webContents.send(NEXUS_IPC.STATE_CHANGED, { from, to, eventId: event.id });
  } else {
    try { console.log(`[HOP 6] main: webContents.send skipped for ${NEXUS_IPC.STATE_CHANGED}`); } catch (_e) { void _e; }
  }
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
    // TRACE HOP 3
    try { console.log(`[HOP 3] main: the IPC handler receives it ${JSON.stringify(raw).slice(0,200)}`); } catch (_e) { void _e; }
    const isDev = !app.isPackaged;
    const parsed = NexusEventSchema.safeParse(raw);
    if (!parsed.success) {
      // TRACE HOP 4
      try { const r = parsed.error.issues.map((i) => i.message).join("; "); console.log(`[HOP 4] main: validation result rejected with the zod error ${r.slice(0,200)}`); } catch (_e) { void _e; }
      const reason = parsed.error.issues.map((i) => i.message).join("; ");
      const rawType = (raw as { type?: string })?.type ?? "event";
      const entry = { id: `${Date.now()}-rej`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: { reason }, level: "warn" as const, message: `${rawType}: REJECTED because ${reason}` };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.LOG_ENTRY} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.TOAST} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: `${rawType}: REJECTED because ${reason}`, ok: false });
      } else {
        try { console.log(`[HOP 6] main: webContents.send skipped for REJECTED`); } catch (_e) { void _e; }
      }
      return { ok: false, reason };
    }
    const ev = parsed.data as unknown as { source: string; type: string };
    if (!isDev && ev.source === "simulated") {
      const reason = "simulated not allowed in production";
      const entry = { id: `${Date.now()}-rej`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: { reason }, level: "warn" as const, message: `${ev.type}: REJECTED because ${reason}` };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.LOG_ENTRY} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.TOAST} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: `${ev.type}: REJECTED because ${reason}`, ok: false });
      } else {
        try { console.log(`[HOP 6] main: webContents.send skipped for REJECTED ${ev.type}`); } catch (_e) { void _e; }
      }
      return { ok: false, reason };
    }
    if (ev.source === "simulated" && !RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)) {
      const reason = `Renderer not allowed to publish ${ev.type}`;
      const entry = { id: `${Date.now()}-rej`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: { reason }, level: "warn" as const, message: `${ev.type}: REJECTED because ${reason}` };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.LOG_ENTRY} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.TOAST} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: `${ev.type}: REJECTED because ${reason}`, ok: false });
      } else {
        try { console.log(`[HOP 6] main: webContents.send skipped for allowlist ${ev.type}`); } catch (_e) { void _e; }
      }
      return { ok: false, reason };
    }
    // TRACE HOP 4 accepted so far
    try { console.log(`[HOP 4] main: validation result accepted ${ev.type} allowlist=${RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)}`); } catch (_e) { void _e; }
    const res = bus.publish(raw, { fromRenderer: true });
    if (!res.ok) {
      // TRACE HOP 4 rejected by bus
      try { console.log(`[HOP 4] main: validation result rejected with the zod error / allowlist reason ${res.reason}`); } catch (_e) { void _e; }
      const reason = res.reason;
      const entry = { id: `${Date.now()}-rej`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: { reason }, level: "warn" as const, message: `${ev.type}: REJECTED because ${reason}` };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: `${ev.type}: REJECTED because ${reason}`, ok: false });
      }
      return { ok: false, reason };
    }
    // Special case: kill from idle should log once, not idle->idle
    if (res.event.type === "system.kill" && machine.getState() === "idle") {
      const entry = { id: `${Date.now()}-kill-idle`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: {}, level: "info" as const, message: "kill: already idle" };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.LOG_ENTRY} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
      } else {
        try { console.log(`[HOP 6] main: webContents.send skipped for kill idle`); } catch (_e) { void _e; }
      }
      sendToast("kill: already idle", true);
      return { ok: true };
    }
    await persistAndBroadcast(res.event as never);
    sendToast(`${res.event.type}: accepted`, true);
    if (nextState(machine.getState(), res.event.type, res.event.payload) !== null || res.event.type === "system.kill" || res.event.type === "error" || res.event.type === "system.warning") {
      handleStateTransition({ type: res.event.type, payload: res.event.payload, id: res.event.id });
    }
    return { ok: true };
  });
}

function registerKillSwitch() {
  const accelerator = "Ctrl+Alt+Shift+K";
  const ok = globalShortcut.register(accelerator, () => {
    const from = machine.getState();
    const ev = { id: `${Date.now()}-kill`, timestamp: new Date().toISOString(), source: "system" as const, type: "system.kill" as const, payload: { reason: "kill-switch" } };
    bus.publish(ev);
    // If already idle, log kill: already idle once, not idle->idle
    if (from === "idle") {
      const entry = { id: `${Date.now()}-kill-idle`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: {}, level: "info" as const, message: "kill: already idle" };
      logStore.append(entry as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.LOG_ENTRY} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        try { console.log(`[HOP 6] main: webContents.send is called: ${NEXUS_IPC.TOAST} windows=${BrowserWindow.getAllWindows().length} isDestroyed=${mainWindow.webContents.isDestroyed()}`); } catch (_e) { void _e; }
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: "kill: already idle", ok: true });
      } else {
        try { console.log(`[HOP 6] main: webContents.send skipped for killSwitch idle`); } catch (_e) { void _e; }
      }
      return;
    }
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
  if (!didBootLog) {
    logStore.append(entry as never);
  }
}

function createWindow() {
  const isDev = !app.isPackaged || !!process.env["ELECTRON_RENDERER_URL"];
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const bounds = getClampedWindowBounds(workArea, { width: 1366, height: 768 }, { width: 1100, height: 680 });
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
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
      additionalArguments: [`--nexus-is-packaged=${app.isPackaged}`],
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
    if (input.code === "KeyD" && input.control && input.alt && input.shift && input.type === "keyDown") {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(NEXUS_IPC.DEV_TOGGLE);
    }
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  else mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.nexus.ai");
  registerIpcHandlers();
  createWindow();
  registerKillSwitch();
  if (!didBootLog) {
    didBootLog = true;
    const bootEv = { id: `boot-${Date.now()}`, timestamp: new Date().toISOString(), source: "system" as const, type: "system.warning" as const, payload: { message: "App started" }, level: "info" as const, message: "App started" };
    bus.publish(bootEv);
    await logStore.append({ id: bootEv.id, timestamp: bootEv.timestamp, level: "info", message: "App started", source: "system", type: "system.warning", payload: { message: "App started" } } as never);
  }
  bus.subscribe((ev) => {
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
