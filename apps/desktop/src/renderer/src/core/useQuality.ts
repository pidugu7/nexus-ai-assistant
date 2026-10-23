import { useEffect, useState } from "react";
import { useSettingsStore } from "../store/settingsStore.js";

export type QualityTier = "low" | "medium" | "high";

export interface QualitySettings {
  particleCount: number;
  bloomIntensity: number;
  bloomRadius: number;
  enableBloom: boolean;
  dpr: number;
}

export const QUALITY_CONFIG: Record<QualityTier, QualitySettings> = {
  low: { particleCount: 120, bloomIntensity: 0, bloomRadius: 0, enableBloom: false, dpr: 1 },
  medium: { particleCount: 500, bloomIntensity: 1.0, bloomRadius: 0.65, enableBloom: true, dpr: 1.1 },
  high: { particleCount: 1100, bloomIntensity: 1.55, bloomRadius: 0.82, enableBloom: true, dpr: 1.5 },
};

export function getStoredQuality(): QualityTier {
  try {
    const raw = localStorage.getItem("nexus:quality");
    if (raw === "low" || raw === "medium" || raw === "high") return raw;
  } catch {
    // ignore
  }
  return "high";
}

export function setStoredQuality(q: QualityTier) {
  try {
    localStorage.setItem("nexus:quality", q);
  } catch {
    // ignore
  }
}

export function getBatteryTierSync(): QualityTier | null {
  // used in tests – pure logic
  return null;
}

export function resolveQualityTier(opts: {
  manual: QualityTier;
  reducedEffects: boolean;
  batteryDischarging: boolean | null;
}): QualityTier {
  if (opts.reducedEffects) return "low";
  if (opts.batteryDischarging === true) return "low";
  return opts.manual;
}

export function useQualityTier(): { tier: QualityTier; settings: QualitySettings; setTier: (t: QualityTier) => void } {
  const reduced = useSettingsStore((s) => s.effectiveReduced);
  const [manual, setManual] = useState<QualityTier>(() => getStoredQuality());
  const [batteryDischarging, setBatteryDischarging] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const nav = navigator as unknown as { getBattery?: () => Promise<{ charging: boolean }> };
      if (typeof nav.getBattery === "function") {
        nav
          .getBattery()
          .then((bat) => {
            if (!cancelled) setBatteryDischarging(!bat.charging);
            try {
              bat.addEventListener?.("chargingchange" as never, () => {
                if (!cancelled) setBatteryDischarging(!bat.charging);
              });
            } catch {
              // ignore
            }
          })
          .catch(() => {
            if (!cancelled) setBatteryDischarging(null);
          });
      }
    } catch {
      setBatteryDischarging(null);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const tier = resolveQualityTier({ manual, reducedEffects: reduced, batteryDischarging });
  const settings = QUALITY_CONFIG[tier];

  const setTier = (t: QualityTier) => {
    setStoredQuality(t);
    setManual(t);
  };

  return { tier, settings, setTier };
}
