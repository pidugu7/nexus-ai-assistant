import { contextBridge, ipcRenderer } from "electron";
import { NEXUS_IPC } from "@nexus/shared";

// Secure preload — expose only typed, validated channels
// Renderer never gets Node or Electron APIs directly.

const nexusApi = {
  ping: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke("nexus:ping"),

  window: {
    minimize: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_MINIMIZE),
    maximize: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_MAXIMIZE),
    close: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(NEXUS_IPC.WINDOW_CLOSE),
    toggleFullscreen: (): Promise<{ ok: boolean; isFullscreen?: boolean }> =>
      ipcRenderer.invoke(NEXUS_IPC.WINDOW_TOGGLE_FULLSCREEN),
    isMaximized: (): Promise<{ isMaximized: boolean }> =>
      ipcRenderer.invoke(NEXUS_IPC.WINDOW_IS_MAXIMIZED),
    isFullscreen: (): Promise<{ isFullscreen: boolean }> =>
      ipcRenderer.invoke(NEXUS_IPC.WINDOW_IS_FULLSCREEN),
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
    onEntry: (
      cb: (entry: { id: string; timestamp: string; level: "info" | "warn" | "error"; message: string }) => void
    ): (() => void) => {
      const handler = (
        _: unknown,
        entry: { id: string; timestamp: string; level: "info" | "warn" | "error"; message: string }
      ) => cb(entry);
      ipcRenderer.on(NEXUS_IPC.LOG_ENTRY, handler);
      return () => ipcRenderer.removeListener(NEXUS_IPC.LOG_ENTRY, handler);
    },
  },
};

export type NexusApi = typeof nexusApi;

try {
  contextBridge.exposeInMainWorld("nexus", nexusApi);
} catch (err) {
  console.error("[preload] failed to expose nexus api", err);
}
