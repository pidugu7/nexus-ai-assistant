import { NexusEventSchema, NexusEvent, RENDERER_PUBLISH_ALLOWLIST } from "@nexus/shared";

type Handler = (ev: NexusEvent) => void;

export class TypedEventBus {
  private subs = new Map<string, Set<Handler>>();
  private anySubs = new Set<Handler>();

  subscribe(handler: Handler): () => void {
    this.anySubs.add(handler);
    return () => this.anySubs.delete(handler);
  }

  subscribeType(type: string, handler: Handler): () => void {
    if (!this.subs.has(type)) this.subs.set(type, new Set());
    this.subs.get(type)!.add(handler);
    return () => this.subs.get(type)!.delete(handler);
  }

  publish(raw: unknown, opts: { fromRenderer?: boolean } = {}): { ok: true; event: NexusEvent } | { ok: false; reason: string } {
    const parsed = NexusEventSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, reason: parsed.error.issues.map((i) => i.message).join("; ") };
    }
    const ev = parsed.data as NexusEvent;
    if (opts.fromRenderer) {
      if (!RENDERER_PUBLISH_ALLOWLIST.includes(ev.type as never)) {
        return { ok: false, reason: `Renderer not allowed to publish ${ev.type}` };
      }
      if (ev.source !== "simulated" && ev.source !== "user") {
        return { ok: false, reason: `Renderer source must be user|simulated, got ${ev.source}` };
      }
    }
    // error isolation: one bad subscriber must not break others
    for (const h of this.anySubs) {
      try {
        h(ev);
      } catch (e) {
        console.warn("[bus] subscriber error (any):", e);
      }
    }
    const set = this.subs.get(ev.type);
    if (set) {
      for (const h of set) {
        try {
          h(ev);
        } catch (e) {
          console.warn(`[bus] subscriber error for ${ev.type}:`, e);
        }
      }
    }
    return { ok: true, event: ev };
  }
}
