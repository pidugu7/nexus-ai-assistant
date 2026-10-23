/**
 * Ollama model utilities — filtering, reasoning parsing, chat request.
 * Covers:
 * - Model picker must list only chat-capable models (exclude embedding like bge-m3)
 * - Qwen3 reasoning: handle (a) thinking field in streamed message, (b) <think> tags in content
 * - Fast mode (disable reasoning) via think:false when supported
 * - Warm-up generous timeout (60s for first token)
 */

export const OLLAMA_BASE = "http://localhost:11434";
export const OLLAMA_VERSION = "0.40.9";
export const DEFAULT_CHAT_MODEL = "qwen3:8b";
export const FIRST_TOKEN_TIMEOUT_MS = 60_000;

// --- Types mirroring Ollama API ---

export interface OllamaModelDetails {
  family?: string;
  families?: string[];
  format?: string;
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: OllamaModelDetails;
  // For /api/show, capabilities may exist
  capabilities?: string[];
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface OllamaShowResponse {
  template?: string;
  details?: OllamaModelDetails;
  capabilities?: string[];
  model_info?: Record<string, unknown>;
}

// --- Embedding detection ---

const EMBEDDING_NAME_PATTERNS = ["embed", "bge", "e5", "minilm", "nomic-embed"];

export function isEmbeddingModel(model: OllamaModel): boolean {
  const name = (model.name || model.model || "").toLowerCase();
  // Check name patterns
  for (const pat of EMBEDDING_NAME_PATTERNS) {
    if (name.includes(pat)) return true;
  }
  // Check details family
  const family = (model.details?.family || "").toLowerCase();
  const families = (model.details?.families || []).map((f) => f.toLowerCase());
  if (family === "bert" || families.includes("bert")) return true;
  // Check capabilities (from /api/show)
  if (model.capabilities && model.capabilities.includes("embedding")) return true;
  // Also handle explicit capability in details-like strings
  return false;
}

export function splitModels(models: OllamaModel[]): {
  chatModels: OllamaModel[];
  embeddingModels: OllamaModel[];
} {
  const chatModels: OllamaModel[] = [];
  const embeddingModels: OllamaModel[] = [];
  for (const m of models) {
    if (isEmbeddingModel(m)) embeddingModels.push(m);
    else chatModels.push(m);
  }
  return { chatModels, embeddingModels };
}

export function getDefaultChatModel(chatModels: OllamaModel[]): string {
  if (chatModels.some((m) => (m.name || m.model) === DEFAULT_CHAT_MODEL)) return DEFAULT_CHAT_MODEL;
  if (chatModels.length > 0) return chatModels[0].name || chatModels[0].model || DEFAULT_CHAT_MODEL;
  return DEFAULT_CHAT_MODEL;
}

// --- Thinking tag parsing ---

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

export function stripThinkTags(content: string): { clean: string; thinking: string | null } {
  if (!content.includes(THINK_OPEN)) return { clean: content, thinking: null };
  let thinking = "";
  let clean = "";
  let idx = 0;
  while (idx < content.length) {
    const openIdx = content.indexOf(THINK_OPEN, idx);
    if (openIdx === -1) {
      clean += content.slice(idx);
      break;
    }
    clean += content.slice(idx, openIdx);
    const closeIdx = content.indexOf(THINK_CLOSE, openIdx + THINK_OPEN.length);
    if (closeIdx === -1) {
      // No close tag yet — treat rest as thinking (streaming incomplete)
      thinking += content.slice(openIdx + THINK_OPEN.length);
      break;
    }
    thinking += content.slice(openIdx + THINK_OPEN.length, closeIdx);
    idx = closeIdx + THINK_CLOSE.length;
  }
  if (thinking === "") return { clean, thinking: null };
  return { clean, thinking };
}

// --- Stream parser for Ollama chat stream ---

export interface OllamaStreamChunk {
  model?: string;
  created_at?: string;
  message?: {
    role?: string;
    content?: string;
    thinking?: string; // newer Ollama: separate field
  };
  done?: boolean;
  // older streaming may have response field
  response?: string;
  thinking?: string; // top-level thinking (some variants)
}

export interface ParsedChunk {
  thinkingDelta: string;
  contentDelta: string;
  done: boolean;
}

export interface StreamParserState {
  inThinkTag: boolean;
  buffer: string; // for incomplete tag fragments
  thinkingDone: boolean;
}

export function createStreamParser(): {
  state: StreamParserState;
  push: (chunk: OllamaStreamChunk | string) => ParsedChunk;
  flush: () => ParsedChunk | null;
} {
  const state: StreamParserState = {
    inThinkTag: false,
    buffer: "",
    thinkingDone: false,
  };

  function push(chunk: OllamaStreamChunk | string): ParsedChunk {
    // Normalize chunk to string fields
    let rawContent = "";
    let rawThinking = "";

    if (typeof chunk === "string") {
      rawContent = chunk;
    } else {
      // Support both message.content and response field
      rawContent = chunk.message?.content ?? chunk.response ?? "";
      // Newer Ollama: thinking in separate field
      rawThinking = chunk.message?.thinking ?? chunk.thinking ?? "";
      if (chunk.done) {
        return { thinkingDelta: rawThinking, contentDelta: rawContent, done: true };
      }
    }

    let thinkingDelta = rawThinking;
    let contentDelta = "";

    // If we have buffered partial tag from previous chunk, prepend
    let toProcess = state.buffer + rawContent;
    state.buffer = "";

    // If rawThinking present, it's authoritative thinking separate from content
    // We still need to strip any think tags from content even when thinking field exists
    // to avoid showing raw tags.
    if (state.inThinkTag) {
      // Currently inside a <think> block — look for closing tag
      const closeIdx = toProcess.indexOf(THINK_CLOSE);
      if (closeIdx !== -1) {
        thinkingDelta += toProcess.slice(0, closeIdx);
        toProcess = toProcess.slice(closeIdx + THINK_CLOSE.length);
        state.inThinkTag = false;
        // After closing, remaining content may contain more tags — continue processing below
      } else {
        // No close yet — check if we have incomplete close tag fragment at end (e.g., "</thi")
        // If no close, whole chunk is thinking, but we must guard against splitting raw content that might be thinking vs content
        // We check if toProcess ends with a prefix of THINK_CLOSE
        const fragment = findPartialTagAtEnd(toProcess, THINK_CLOSE);
        if (fragment) {
          // Hold fragment for next chunk
          state.buffer = fragment;
          thinkingDelta += toProcess.slice(0, toProcess.length - fragment.length);
          return { thinkingDelta, contentDelta: "", done: false };
        }
        thinkingDelta += toProcess;
        return { thinkingDelta, contentDelta: "", done: false };
      }
    }

    // Not in think tag — look for open tags in remaining toProcess
    let idx = 0;
    while (idx < toProcess.length) {
      const openIdx = toProcess.indexOf(THINK_OPEN, idx);
      if (openIdx === -1) {
        // No open tag — check for partial open tag at end (e.g., "<thi")
        const afterIdx = toProcess.slice(idx);
        const partial = findPartialTagAtEnd(afterIdx, THINK_OPEN);
        if (partial) {
          contentDelta += afterIdx.slice(0, afterIdx.length - partial.length);
          state.buffer = partial;
        } else {
          contentDelta += afterIdx;
        }
        break;
      }
      // Content before open tag
      contentDelta += toProcess.slice(idx, openIdx);
      const closeIdx = toProcess.indexOf(THINK_CLOSE, openIdx + THINK_OPEN.length);
      if (closeIdx !== -1) {
        // Complete think block in this chunk
        thinkingDelta += toProcess.slice(openIdx + THINK_OPEN.length, closeIdx);
        idx = closeIdx + THINK_CLOSE.length;
      } else {
        // Open without close — enter thinking mode
        thinkingDelta += toProcess.slice(openIdx + THINK_OPEN.length);
        state.inThinkTag = true;
        // Check for partial close fragment? Already handled by no close case
        break;
      }
    }

    return { thinkingDelta, contentDelta, done: false };
  }

  function flush(): ParsedChunk | null {
    if (state.buffer) {
      // Flush buffer as content if not in think tag, else as thinking
      const buffered = state.buffer;
      state.buffer = "";
      if (state.inThinkTag) {
        return { thinkingDelta: buffered, contentDelta: "", done: false };
      }
      // If buffer looks like partial tag but stream ended, treat as content (don't lose)
      return { thinkingDelta: "", contentDelta: buffered, done: false };
    }
    return null;
  }

  return { state, push, flush };
}

function findPartialTagAtEnd(text: string, tag: string): string | null {
  // If text ends with a prefix of tag (and not the full tag), return that prefix
  // We need to check suffixes of text that are prefixes of tag
  const maxLen = Math.min(text.length, tag.length - 1);
  for (let len = maxLen; len > 0; len--) {
    const suffix = text.slice(text.length - len);
    if (tag.startsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

// --- Ollama API helpers (used via preload or direct fetch) ---

export async function fetchOllamaTags(baseUrl = OLLAMA_BASE): Promise<OllamaTagsResponse> {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) throw new Error(`Ollama tags failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as OllamaTagsResponse;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  think?: boolean; // Qwen3 reasoning toggle for Ollama >=0.40
  options?: Record<string, unknown>;
}

export function buildChatRequest(
  model: string,
  messages: ChatMessage[],
  fastMode: boolean
): OllamaChatRequest {
  const req: OllamaChatRequest = {
    model,
    messages,
    stream: true,
  };
  if (fastMode) {
    // Qwen3/o3 reasoning disable: Ollama 0.40+ supports think:false
    // We set it unconditionally; if server doesn't support it, it will ignore or error
    // Caller should handle "unsupported" case by showing message
    req.think = false;
  }
  return req;
}

// Parse NDJSON stream text into chunks (helper for testing mock streams)
export function parseNdjsonStream(text: string): OllamaStreamChunk[] {
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as OllamaStreamChunk;
      } catch {
        return { message: { content: line } } as OllamaStreamChunk;
      }
    });
}
