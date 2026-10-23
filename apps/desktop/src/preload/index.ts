import { contextBridge, ipcRenderer } from "electron";
import { NEXUS_IPC } from "@nexus/shared";

function getIsPackaged(): boolean {
  try {
    // process.argv is set via additionalArguments
    const argv: unknown = (process as unknown as { argv?: unknown }).argv;
    if (!Array.isArray(argv)) return false;
    const arg = (argv as string[]).find((a) => typeof a === "string" && a.startsWith("--nexus-is-packaged="));
    if (arg) return arg.split("=")[1] === "true";
    return false;
  } catch {
    return false;
  }
}

const isPackaged = getIsPackaged();

const nexusApi = {
  ping: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke("nexus:ping"),
  window: {
    minimize: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_MINIMIZE),
    maximize: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_MAXIMIZE),
    close: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_CLOSE),
    toggleFullscreen: (): Promise<{ ok: boolean; isFullscreen?: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_TOGGLE_FULLSCREEN),
    isMaximized: (): Promise<{ isMaximized: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_IS_MAXIMIZED),
    isFullscreen: (): Promise<{ isFullscreen: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_IS_FULLSCREEN),
    onMaximizedChanged: (cb: (val: { isMaximized: boolean }) => void): (() => void) => {
      const handler = (_: unknown, val: { isMaximized: boolean }) => cb(val);
      ipcRenderer.on(NEXUS_IPC.WINDOW_ON_MAXIMIZED_CHANGED, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.WINDOW_ON_MAXIMIZED_CHANGED, handler);
    },
    onFullscreenChanged: (cb: (val: { isFullscreen: boolean }) => void): (() => void) => {
      const handler = (_: unknown, val: { isFullscreen: boolean }) => cb(val);
      ipcRenderer.on(NEXUS_IPC.WINDOW_ON_FULLSCREEN_CHANGED, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.WINDOW_ON_FULLSCREEN_CHANGED, handler);
    },
  },
  system: {
    onKill: (cb: (payload: { reason: string; timestamp: string }) => void): (() => void) => {
      const handler = (_: unknown, payload: { reason: string; timestamp: string }) => cb(payload);
      ipcRenderer.on(NEXUS_IPC.SYSTEM_KILL, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.SYSTEM_KILL, handler);
    },
  },
  log: {
    onEntry: (cb: (entry: { id: string; timestamp: string; level: "info" | "warn" | "error"; message: string; source?: string; type?: string }) => void): (() => void) => {
      const handler = (_: unknown, entry: { id: string; timestamp: string; level: "info" | "warn" | "error"; message: string; source?: string; type?: string }) => cb(entry);
      ipcRenderer.on(NEXUS_IPC.LOG_ENTRY, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.LOG_ENTRY, handler);
    },
    get: (count?: number): Promise<{ id: string; timestamp: string; level: "info" | "warn" | "error"; message: string; source?: string; type?: string }[]> =>
      ipcRenderer.invoke(NEXUS_IPC.LOG_GET, { count }),
    clearView: (): Promise<{ ok: true }> => ipcRenderer.invoke(NEXUS_IPC.LOG_CLEAR_VIEW),
  },
  bus: {
    publish: (event: unknown): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke(NEXUS_IPC.BUS_PUBLISH, event),
    onEvent: (cb: (ev: { id: string; timestamp: string; source: string; type: string; payload: unknown; level?: string; message?: string }) => void): (() => void) => {
      const handler = (_: unknown, ev: never) => cb(ev as never);
      ipcRenderer.on(NEXUS_IPC.BUS_SUBSCRIBE, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.BUS_SUBSCRIBE, handler);
    },
  },
  state: {
    get: (): Promise<{ state: string }> => ipcRenderer.invoke(NEXUS_IPC.STATE_GET),
    onChanged: (cb: (p: { from: string; to: string; eventId: string }) => void): (() => void) => {
      const handler = (_: unknown, p: never) => cb(p as never);
      ipcRenderer.on(NEXUS_IPC.STATE_CHANGED, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.STATE_CHANGED, handler);
    },
  },
  dev: {
    isPackaged,
    onToggle: (cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on(NEXUS_IPC.DEV_TOGGLE, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.DEV_TOGGLE, handler);
    },
  },
  toast: {
    onToast: (cb: (payload: { message: string; ok: boolean }) => void): (() => void) => {
      const handler = (_: unknown, payload: { message: string; ok: boolean }) => cb(payload);
      ipcRenderer.on(NEXUS_IPC.TOAST, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.TOAST, handler);
    },
  },
};

export type NexusApi = typeof nexusApi;

try {
  contextBridge.exposeInMainWorld("nexus", nexusApi);
  contextBridge.exposeInMainWorld("__NEXUS_IS_PACKAGED__", isPackaged);
} catch (err) {
  console.error("[preload] failed to expose nexus api", err);
}
