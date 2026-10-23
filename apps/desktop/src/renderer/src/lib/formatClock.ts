/**
 * Clock formatter — only live value allowed in Phase 1 (honest UI rule).
 * Returns HH:MM:SS in 24h and YYYY-MM-DD.
 */
export function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatClock(date: Date): { time: string; date: string } {
  return { time: formatTime(date), date: formatDate(date) };
}
