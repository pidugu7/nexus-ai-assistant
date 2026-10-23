/**
 * Command bar submit stub — logs "command received: <text>" per spec.
 * Pure function for testing.
 */
export function submitCommand(raw: string): { ok: boolean; message: string } {
  const text = raw.trim();
  if (!text) {
    return { ok: false, message: "command received: <empty>" };
  }
  return { ok: true, message: `command received: ${text}` };
}
