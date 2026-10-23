import type { NexusApi } from "./index.js";

declare global {
  interface Window {
    nexus: NexusApi;
  }
}

export {};
