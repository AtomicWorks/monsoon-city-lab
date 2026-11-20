import {
  DISTRICT,
  districtFor,
  type District,
  N,
  DEFAULT,
  type Scenario,
  type Result,
  type Frame,
} from "./engine";
export const LANDMARKS = [
  {
    id: "clinic",
    name: "Shonar Clinic",
    short: "Clinic",
    x: 64,
    y: 64,
    description:
      "The low-lying clinic needs a reliable connection to the northern boundary.",
    color: "#e8b0a0",
  },
  {
    id: "school",
    name: "Quarter School",
    short: "School",
    x: 24,
    y: 34,
    description:
      "Keep the school entrance clear as runoff collects in the western depression.",
    color: "#d8ce8c",
  },
  {
    id: "market",
    name: "East Bazaar",
    short: "Market",
    x: 74,
    y: 24,
    description:
      "Preserve access to the market through a prolonged drainage-constrained storm.",
    color: "#9bc7d0",
  },
] as const;
export type Landmark = (typeof LANDMARKS)[number];
export const MISSIONS = [
  {
    id: "services",
    title: "Keep the city connected",
    subtitle: "04 / ESSENTIAL SERVICES",
    description:
      "Reconnect the clinic by the end, keep school peak entrance depth below 2 cm with access restored, and preserve market access throughout. Reduce peak district flooding by 5%, within 100 credits.",
    storm: "double",
    intensity: 45,
    duration: 40,
    recovery: 150,
    blockage: 20,
    outlet: 4,
  },
  {
    id: "clinic",
    title: "Protect the clinic",
    subtitle: "01 / CRITICAL ACCESS",
    description:
      "A double storm is approaching. Keep the clinic reachable at the end of recovery and reduce peak district flooded area by 5%.",
    storm: "double",
    intensity: 45,
    duration: 40,
    recovery: 120,
    blockage: 20,
    outlet: 4,
  },
  {
    id: "school",
    title: "Keep the school open",
    subtitle: "02 / WESTERN LOWLAND",
    description:
      "Reduce peak flooding by 5% and keep the school entrance below 10 cm at the end of recovery.",
    storm: "burst",
    intensity: 140,
    duration: 40,
    recovery: 90,
    blockage: 35,
    outlet: 3,
  },
  {
    id: "market",
    title: "Keep the market connected",
    subtitle: "03 / DRAINAGE PRESSURE",
    description:
      "Reduce peak flooding by 3% and preserve market access after a sustained monsoon with a restricted outlet.",
    storm: "persistent",
    intensity: 100,
    duration: 80,
    recovery: 120,
    blockage: 70,
    outlet: 1.5,
  },
] as const;
export function missionScenario(
  id: NonNullable<Scenario["challenge"]>,
): Scenario {
  const m = MISSIONS.find((x) => x.id === id)!;
  return {
    ...DEFAULT,
    challenge: id,
    storm: m.storm,
    intensity: m.intensity,
    duration: m.duration,
    recovery: m.recovery,
    blockage: m.blockage,
    outlet: m.outlet,
    interventions: [],
  };
}
export function matchesMission(s: Scenario) {
  if (!s.challenge || s.layout) return false;
  const target = missionScenario(s.challenge);
  return (
    [
      "storm",
      "intensity",
      "duration",
      "recovery",
      "blockage",
      "outlet",
      "infiltrationFactor",
    ] as const
  ).every((k) => s[k] === target[k]);
}
export function entrance(l: Landmark) {
  return (l.y + 2) * N + l.x;
}
// Trace road access to the northern boundary, allowing a short ground connector at the entrance.
export function route(
  depth: Float32Array,
  l: Landmark,
  ignoreFlood = false,
  map: District = DISTRICT,
): number[] {
  const start = entrance(l),
    parent = new Int32Array(N * N).fill(-1),
    queue = [start];
  parent[start] = start;
  if (!ignoreFlood && depth[start] > 0.15) return [];
  let end = -1;
  for (let p = 0; p < queue.length; p++) {
    const i = queue[p],
      x = i % N,
      y = Math.floor(i / N);
    if (y === 0 && map.kind[i] === 1) {
      end = i;
      break;
    }
    for (const j of [
      x > 0 ? i - 1 : -1,
      x < N - 1 ? i + 1 : -1,
      i - N,
      i + N,
    ]) {
      if (
        j < 0 ||
        j >= N * N ||
        parent[j] >= 0 ||
        map.kind[j] === 4 ||
        map.kind[j] === 3 ||
        (!ignoreFlood && depth[j] > 0.15)
      )
        continue;
      const near =
        Math.abs((j % N) - l.x) + Math.abs(Math.floor(j / N) - (l.y + 2)) <= 8;
      if (map.kind[j] !== 1 && !near) continue;
      parent[j] = i;
      queue.push(j);
    }
  }
  if (end < 0) return [];
  const path = [end];
  while (end !== start) {
    end = parent[end];
    path.push(end);
  }
  return path.reverse();
}
export function landmarkSummary(r: Result, l: Landmark) {
  const i = entrance(l);
  const available = r.frames.map(
    (f) => route(f.depth, l, false, districtFor(r.scenario.layout)).length > 0,
  );
  let outageMinutes = 0;
  for (let k = 1; k < r.frames.length; k++)
    if (!available[k])
      outageMinutes +=
        (r.frames[k].metrics.time - r.frames[k - 1].metrics.time) / 60;
  let lastBlocked = -1;
  available.forEach((v, k) => {
    if (!v) lastBlocked = k;
  });
  const restored =
    lastBlocked < 0
      ? 0
      : lastBlocked === available.length - 1
        ? null
        : Math.max(
            0,
            r.frames[lastBlocked + 1].metrics.time / 60 - r.scenario.duration,
          );
  return {
    id: l.id,
    name: l.name,
    peak: r.peakDepth[i],
    exposure: r.exposure[i] / 60,
    outageMinutes,
    restored,
    connectedAtEnd: available.at(-1)!,
    endDepth: r.frames.at(-1)!.depth[i],
  };
}
export function recoverySummary(r: Result) {
  const end = r.frames[r.scenario.duration],
    last = r.frames.at(-1)!;
  return {
    rainEndStored: end.metrics.stored,
    endStored: last.metrics.stored,
    removed: end.metrics.stored - last.metrics.stored,
    recoveryMinutes: r.scenario.recovery ?? 0,
  };
}
export function challengeOutcome(s: Scenario, a: Result, b: Result) {
  if (
    !matchesMission(s) ||
    !matchesMission(a.scenario) ||
    !matchesMission(b.scenario) ||
    a.scenario.challenge !== s.challenge ||
    b.scenario.challenge !== s.challenge
  )
    return null;
  const impacts = LANDMARKS.map((l) => landmarkSummary(b, l));
  const impact = impacts.find((l) => l.id === s.challenge);
  const goals =
    s.challenge === "services"
      ? [
          {
            label: "Clinic connected at the end",
            met: impacts[0].connectedAtEnd,
            detail: impacts[0].connectedAtEnd
              ? "Route available"
              : "No route at the end",
          },
          {
            label: "School peak below 2 cm and connected at the end",
            met: impacts[1].peak < 0.02 && impacts[1].connectedAtEnd,
            detail:
              (impacts[1].peak * 100).toFixed(1) +
              " cm peak · " +
              (impacts[1].connectedAtEnd ? "connected" : "disconnected"),
          },
          {
            label: "Market access throughout the run",
            met: impacts[2].outageMinutes === 0,
            detail: impacts[2].outageMinutes + " min interrupted",
          },
        ]
      : [];
  const peak = (r: Result) =>
    Math.max(...r.frames.map((f) => f.metrics.flooded));
  const ap = peak(a),
    bp = peak(b),
    improvement = ap > 0 ? ((ap - bp) / ap) * 100 : 0;
  const local =
      s.challenge === "services"
        ? goals.every((g) => g.met)
        : s.challenge === "school"
          ? impact!.endDepth < 0.1
          : impact!.connectedAtEnd,
    target = s.challenge === "market" ? 3 : 5;
  return {
    improvement,
    local,
    target,
    complete: local && improvement >= target,
    goals,
  };
}
