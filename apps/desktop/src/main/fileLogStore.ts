import { join } from "path";
import { promises as fs, createReadStream } from "fs";
import { createInterface } from "readline";

export interface PersistedLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  source?: string;
  type?: string;
  payload?: unknown;
}

export interface LogStore {
  append(entry: PersistedLogEntry): Promise<void>;
  loadLast(count: number): Promise<PersistedLogEntry[]>;
  clear(): Promise<void>;
  getPath(): string;
}

const MAX_BYTES = 5 * 1024 * 1024;

function getUserDataDir(): string {
  try {
    // lazy require — avoids failing in Vitest/jsdom where Electron not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { app } = require("electron");
    return join(app.getPath("userData"), "logs");
  } catch {
    // fallback for tests
    return join(process.cwd(), ".tmp-logs");
  }
}

export function createFileLogStore(baseDir?: string): LogStore {
  const dir = baseDir ?? getUserDataDir();
  const filePath = join(dir, "activity.jsonl");

  async function ensureDir() {
    await fs.mkdir(dir, { recursive: true });
  }

  return {
    getPath: () => filePath,
    async append(entry) {
      await ensureDir();
      const line = JSON.stringify(entry) + "\n";
      await fs.appendFile(filePath, line, "utf8");
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_BYTES) {
          const all = await this.loadLast(100000);
          const keep = all.slice(-Math.floor(all.length / 2));
          await fs.writeFile(filePath + ".rotating", keep.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
          await fs.rename(filePath + ".rotating", filePath);
        }
      } catch {
        // ignore rotation errors
      }
    },
    async loadLast(count: number) {
      try {
        await ensureDir();
        await fs.access(filePath);
      } catch {
        return [];
      }
      const lines: string[] = [];
      const rl = createInterface({ input: createReadStream(filePath, "utf8"), crlfDelay: Infinity });
      for await (const line of rl) {
        if (line.trim()) lines.push(line);
      }
      const slice = lines.slice(-count);
      const out: PersistedLogEntry[] = [];
      for (const l of slice) {
        try {
          out.push(JSON.parse(l));
        } catch {
          // skip corrupt
        }
      }
      return out;
    },
    async clear() {
      try {
        await fs.unlink(filePath);
      } catch {
        // no file
      }
    },
  };
}
