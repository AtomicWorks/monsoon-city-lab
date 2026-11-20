import { rainfall, type Scenario } from "./engine";
export type Quality = "auto" | "low" | "balanced" | "high";
export type Tier = Exclude<Quality, "auto">;
export const QUALITY = {
  low: { dpr: 1, shadow: 0, drops: 300, splashes: 0, details: false },
  balanced: { dpr: 1.5, shadow: 1024, drops: 900, splashes: 32, details: true },
  high: { dpr: 2, shadow: 2048, drops: 1600, splashes: 96, details: true },
};
export function resolveQuality(q: Quality, width: number, cores = 4): Tier {
  return q === "auto" ? (width < 760 || cores <= 4 ? "low" : "balanced") : q;
}
export function readQuality(value: string | null): Quality {
  return value === "low" || value === "balanced" || value === "high"
    ? value
    : "auto";
}
export function atmosphere(s: Scenario, minute: number, ready: boolean) {
  const mm = ready ? rainfall(s, minute * 60) : 0;
  const recovery = ready && minute >= s.duration;
  const clearing = recovery ? Math.min(1, (minute - s.duration) / 45) : 0;
  const cloud = !ready
    ? 0.18
    : recovery
      ? 0.65 * (1 - clearing)
      : 0.3 + Math.min(0.7, mm / 100);
  return {
    rain: mm,
    cloud,
    label: !ready
      ? "Design weather"
      : minute === 0
        ? "Storm arriving"
        : recovery
          ? clearing < 1
            ? "Skies clearing"
            : "After the storm"
          : mm > 50
            ? "Heavy rain"
            : "Rainfall",
  };
}
