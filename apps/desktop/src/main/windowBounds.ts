export interface Size {
  width: number;
  height: number;
}
export interface Bounds extends Size {
  x: number;
  y: number;
}

/**
 * Clamp window to fit workArea, never larger than screen, centered,
 * respecting min 1100x680. If screen smaller than min, use screen size.
 * Pure function — unit-tested.
 */
export function getClampedWindowBounds(
  workArea: Size & { x?: number; y?: number },
  requested: Size = { width: 1366, height: 768 },
  min: Size = { width: 1100, height: 680 }
): Bounds {
  const areaW = workArea.width;
  const areaH = workArea.height;
  const baseX = workArea.x ?? 0;
  const baseY = workArea.y ?? 0;

  let width: number;
  let height: number;

  if (areaW < min.width) width = areaW;
  else width = Math.max(min.width, Math.min(requested.width, areaW));

  if (areaH < min.height) height = areaH;
  else height = Math.max(min.height, Math.min(requested.height, areaH));

  return {
    width,
    height,
    x: Math.round(baseX + (areaW - width) / 2),
    y: Math.round(baseY + (areaH - height) / 2),
  };
}
