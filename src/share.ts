import { validate, type Scenario } from "./engine";
export function encodeScenario(input: Scenario): string {
  const s = validate(input);
  const data = [
    2,
    s.model,
    s.name,
    s.storm,
    s.intensity,
    s.duration,
    s.recovery,
    s.blockage,
    s.outlet,
    s.infiltrationFactor,
    s.challenge ?? null,
    s.interventions.map((i) => [i.type, i.x, i.y]),
    s.layout ?? null,
  ];
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodeScenario(encoded: string): Scenario {
  if (encoded.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(encoded))
    throw Error("This scenario link is invalid or too large.");
  try {
    const raw = atob(encoded.replaceAll("-", "+").replaceAll("_", "/"));
    const p = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      ),
    );
    if (
      !Array.isArray(p) ||
      !((p[0] === 1 && p.length === 12) || (p[0] === 2 && p.length === 13)) ||
      !Array.isArray(p[11]) ||
      p[11].length > 8
    )
      throw Error();
    return validate({
      version: 1,
      model: p[1],
      name: p[2],
      storm: p[3],
      intensity: p[4],
      duration: p[5],
      recovery: p[6],
      blockage: p[7],
      outlet: p[8],
      infiltrationFactor: p[9],
      challenge: p[10] ?? undefined,
      layout: p[12] ?? undefined,
      interventions: p[11].map((t: unknown, i: number) => {
        if (!Array.isArray(t) || t.length !== 3) throw Error();
        return { id: `shared-${i}`, type: t[0], x: t[1], y: t[2] };
      }),
    });
  } catch {
    throw Error(
      "This scenario link is damaged or uses unsupported settings. Your current plan has been kept.",
    );
  }
}
export function scenarioFromHash(hash: string): Scenario | null {
  if (!hash.startsWith("#plan=")) return null;
  return decodeScenario(hash.slice(6));
}
export function scenarioLink(s: Scenario, origin: string) {
  const url = new URL(origin);
  url.search = "";
  url.hash = "plan=" + encodeScenario(s);
  return url.href;
}
