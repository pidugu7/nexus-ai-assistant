import { contextBridge, ipcRenderer } from "electron";

// Secure preload — expose only typed, validated channels
// Renderer never gets Node or Electron APIs directly.

const nexusApi = {
  ping: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke("nexus:ping")
};

export type NexusApi = typeof nexusApi;

// Expose under window.nexus (typed via window.d.ts)
try {
  contextBridge.exposeInMainWorld("nexus", nexusApi);
} catch (err) {
  console.error("[preload] failed to expose nexus api", err);
}
