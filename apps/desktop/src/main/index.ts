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
    mainWindow.webContents.send(NEXUS_IPC.BUS_SUBSCRIBE, event);
    mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, logEntry);
  }
  return logEntry;
}

function sendToast(message: string, ok: boolean) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(NEXUS_IPC.TOAST, { message, ok });
  }
}

function handleStateTransition(event: { type: string; payload: unknown; id: string }) {
  const from = machine.getState();
  const res = machine.transition({ type: event.type, payload: event.payload });
  if (!res.ok) {
    const warn = { id: `${Date.now()}-warn`, timestamp: new Date().toISOString(), source: "system" as const, type: "system.warning" as const, payload: { message: res.reason }, level: "warn" as const, message: res.reason };
    bus.publish(warn);
    persistAndBroadcast(warn as never);
    sendToast(`${event.type}: REJECTED because ${res.reason}`, false);
    return { ok: false as const, reason: res.reason, from };
  }
  const to = res.to;
  // Kill from idle should not log pointless idle->idle
  if (from === to && event.type === "system.kill") {
    persistAndBroadcast({ id: `${Date.now()}-state`, timestamp: new Date().toISOString(), source: "system", type: "log:entry", payload: {}, level: "info", message: "kill: already idle" } as never);
    sendToast("kill: already idle", true);
    return { ok: true as const, from, to };
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(NEXUS_IPC.STATE_CHANGED, { from, to, eventId: event.id });
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
  // --- Ollama proxy (keep CSP strict, renderer uses preload) ---
  ipcMain.handle(NEXUS_IPC.OLLAMA_LIST_MODELS, async () => {
    try {
      const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const res = await fetch(`${base}/api/tags`, { method: "GET" });
      if (!res.ok) return { ok: false as const, error: `Ollama tags ${res.status} ${res.statusText}` };
      const data = (await res.json()) as { models?: unknown };
      return { ok: true as const, models: data.models ?? [] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle(NEXUS_IPC.OLLAMA_CHAT_STREAM, async (event, payload: { model: string; messages: { role: string; content: string }[]; fastMode?: boolean }) => {
    const sender = event.sender;
    const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const model = payload?.model || "qwen3:8b";
    const messages = payload?.messages || [];
    const fastMode = !!payload?.fastMode;
    try {
      const body: Record<string, unknown> = { model, messages, stream: true };
      if (fastMode) {
        // Ollama 0.40.9 supports think:false for qwen3 reasoning disable
        body.think = false;
      }
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        // Detect unsupported think option
        if (fastMode && (text.includes("think") || res.status === 400)) {
          sender.send(NEXUS_IPC.OLLAMA_CHAT_ERROR, { message: `Fast mode unsupported by this Ollama version: ${text || res.statusText}` });
          return { ok: false as const, error: "Fast mode unsupported by this Ollama version" };
        }
        sender.send(NEXUS_IPC.OLLAMA_CHAT_ERROR, { message: `Ollama chat failed ${res.status}: ${text || res.statusText}` });
        return { ok: false as const, error: `Ollama chat failed ${res.status}` };
      }
      if (!res.body) {
        sender.send(NEXUS_IPC.OLLAMA_CHAT_ERROR, { message: "Ollama chat: no body" });
        return { ok: false as const, error: "no body" };
      }
      // Stream NDJSON lines
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      (async () => {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let newlineIdx: number;
            while ((newlineIdx = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, newlineIdx).trim();
              buf = buf.slice(newlineIdx + 1);
              if (!line) continue;
              try {
                const chunk = JSON.parse(line) as {
                  message?: { content?: string; thinking?: string; role?: string };
                  thinking?: string;
                  response?: string;
                  done?: boolean;
                };
                // Normalize thinking/content from both newer (thinking field) and older (no)
                const thinking = chunk.message?.thinking ?? chunk.thinking ?? "";
                const content = chunk.message?.content ?? chunk.response ?? "";
                const isDone = !!chunk.done;
                if (!sender.isDestroyed()) {
                  sender.send(NEXUS_IPC.OLLAMA_CHAT_CHUNK, { thinking, content, done: isDone });
                }
                if (isDone) {
                  if (!sender.isDestroyed()) sender.send(NEXUS_IPC.OLLAMA_CHAT_DONE, {});
                  return;
                }
              } catch {
                // Non-JSON line — forward as content
                if (!sender.isDestroyed()) sender.send(NEXUS_IPC.OLLAMA_CHAT_CHUNK, { thinking: "", content: line, done: false });
              }
            }
          }
          // Flush remaining buf
          const remaining = buf.trim();
          if (remaining) {
            try {
              const chunk = JSON.parse(remaining) as { message?: { content?: string; thinking?: string }; done?: boolean };
              const thinking = chunk.message?.thinking ?? "";
              const content = chunk.message?.content ?? "";
              if (!sender.isDestroyed()) sender.send(NEXUS_IPC.OLLAMA_CHAT_CHUNK, { thinking, content, done: !!chunk.done });
            } catch {
              if (!sender.isDestroyed()) sender.send(NEXUS_IPC.OLLAMA_CHAT_CHUNK, { thinking: "", content: remaining, done: false });
            }
          }
          if (!sender.isDestroyed()) sender.send(NEXUS_IPC.OLLAMA_CHAT_DONE, {});
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!sender.isDestroyed()) sender.send(NEXUS_IPC.OLLAMA_CHAT_ERROR, { message: msg });
        }
      })();
      return { ok: true as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!sender.isDestroyed()) sender.send(NEXUS_IPC.OLLAMA_CHAT_ERROR, { message: msg });
      return { ok: false as const, error: msg };
    }
  });

  ipcMain.handle(NEXUS_IPC.LOG_CLEAR_VIEW, async () => ({ ok: true }));
  ipcMain.handle(NEXUS_IPC.BUS_PUBLISH, async (_e, raw) => {
    const isDev = !app.isPackaged;
    const parsed = NexusEventSchema.safeParse(raw);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => i.message).join("; ");
      const rawType = (raw as { type?: string })?.type ?? "event";
      const entry = { id: `${Date.now()}-rej`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: { reason }, level: "warn" as const, message: `${rawType}: REJECTED because ${reason}` };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: `${rawType}: REJECTED because ${reason}`, ok: false });
      }
      return { ok: false, reason };
    }
    const ev = parsed.data as unknown as { source: string; type: string };
    if (!isDev && ev.source === "simulated") {
      const reason = "simulated not allowed in production";
      const entry = { id: `${Date.now()}-rej`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: { reason }, level: "warn" as const, message: `${ev.type}: REJECTED because ${reason}` };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: `${ev.type}: REJECTED because ${reason}`, ok: false });
      }
      return { ok: false, reason };
    }
    if (ev.source === "simulated" && !RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)) {
      const reason = `Renderer not allowed to publish ${ev.type}`;
      const entry = { id: `${Date.now()}-rej`, timestamp: new Date().toISOString(), source: "system" as const, type: "log:entry" as const, payload: { reason }, level: "warn" as const, message: `${ev.type}: REJECTED because ${reason}` };
      await logStore.append({ id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type, payload: entry.payload } as never);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: `${ev.type}: REJECTED because ${reason}`, ok: false });
      }
      return { ok: false, reason };
    }
    const res = bus.publish(raw, { fromRenderer: true });
    if (!res.ok) {
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
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
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
        mainWindow.webContents.send(NEXUS_IPC.LOG_ENTRY, { id: entry.id, timestamp: entry.timestamp, level: entry.level, message: entry.message, source: entry.source, type: entry.type });
        mainWindow.webContents.send(NEXUS_IPC.TOAST, { message: "kill: already idle", ok: true });
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
    if (input.code === "KeyF" && input.control && input.alt && input.shift && input.type === "keyDown") {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(NEXUS_IPC.FPS_TOGGLE);
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
