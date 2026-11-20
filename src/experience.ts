import {
  DEFAULT,
  DISTRICT,
  districtFor,
  type District,
  N,
  validate,
  type Result,
  type Scenario,
} from "./engine";
import {
  LANDMARKS,
  entrance,
  landmarkSummary,
  missionScenario,
  route,
} from "./impact";
export type StormEvent = {
  id: string;
  minute: number;
  title: string;
  detail: string;
  kind: "weather" | "flood" | "access" | "recovery";
  landmark?: (typeof LANDMARKS)[number]["id"];
};
export function stormEvents(r: Result): StormEvent[] {
  const events: StormEvent[] = [];
  const add = (
    minute: number,
    title: string,
    detail: string,
    kind: StormEvent["kind"],
    landmark?: StormEvent["landmark"],
  ) =>
    events.push({
      id: `${kind}-${landmark ?? "district"}-${minute}-${events.length}`,
      minute,
      title,
      detail,
      kind,
      landmark,
    });
  add(
    0,
    "The experiment begins",
    `${r.scenario.storm} profile · ${r.scenario.intensity} mm/h setting. Every run starts dry.`,
    "weather",
  );
  const peak = r.frames.reduce(
    (a, b) => (b.metrics.flooded > a.metrics.flooded ? b : a),
    r.frames[0],
  );
  if (peak.metrics.flooded > 0)
    add(
      peak.metrics.time / 60,
      "District flooding peaks",
      `${(peak.metrics.flooded / 10000).toFixed(2)} hectares above 10 cm at this recorded minute.`,
      "flood",
    );
  for (const l of LANDMARKS) {
    let connected =
        route(r.frames[0].depth, l, false, districtFor(r.scenario.layout))
          .length > 0,
      wet = r.frames[0].depth[entrance(l)] > 0.1;
    for (let i = 1; i < r.frames.length; i++) {
      const f = r.frames[i],
        nextConnected =
          route(f.depth, l, false, districtFor(r.scenario.layout)).length > 0,
        nextWet = f.depth[entrance(l)] > 0.1,
        minute = f.metrics.time / 60;
      if (nextConnected !== connected)
        add(
          minute,
          `${l.short} access ${nextConnected ? "returns" : "is lost"}`,
          nextConnected
            ? "A route to the northern boundary is available at this minute. Later interruptions remain possible."
            : "No modeled route is available. Roads deeper than 15 cm are excluded.",
          "access",
          l.id,
        );
      if (nextWet !== wet)
        add(
          minute,
          `${l.short} entrance ${nextWet ? "floods" : "clears"}`,
          `Entrance depth is ${(f.depth[entrance(l)] * 100).toFixed(1)} cm; the illustrative flood threshold is 10 cm.`,
          nextWet ? "flood" : "recovery",
          l.id,
        );
      connected = nextConnected;
      wet = nextWet;
    }
  }
  add(
    r.scenario.duration,
    "Rainfall ends",
    `Soil and drains continue working for ${r.scenario.recovery ?? 0} more minutes.`,
    "weather",
  );
  const last = r.frames.at(-1)!;
  add(
    last.metrics.time / 60,
    "The observation window ends",
    `${Math.round(last.metrics.stored).toLocaleString("en")} m³ remains on the surface. This is the end of observation, not necessarily complete recovery.`,
    "recovery",
  );
  return events.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));
}
export function replayChapters(events: StormEvent[]) {
  const core = events.filter((e) => !e.landmark),
    local: StormEvent[] = [];
  for (const l of LANDMARKS) {
    const landmarkEvents = events.filter((e) => e.landmark === l.id);
    const accessEvents = landmarkEvents.filter((e) => e.kind === "access");
    const changes = accessEvents.length ? accessEvents : landmarkEvents;
    if (changes.length) local.push(changes[0]);
    if (changes.length > 1) local.push(changes.at(-1)!);
  }
  return [...new Map([...core, ...local].map((e) => [e.id, e])).values()].sort(
    (a, b) => a.minute - b.minute || a.id.localeCompare(b.id),
  );
}
export function resultStories(a: Result, b: Result) {
  const peak = (r: Result) =>
    Math.max(...r.frames.map((f) => f.metrics.flooded)) / 10000;
  const delta = peak(a) - peak(b),
    outage =
      landmarkSummary(a, LANDMARKS[0]).outageMinutes -
      landmarkSummary(b, LANDMARKS[0]).outageMinutes;
  const school =
    (a.peakDepth[entrance(LANDMARKS[1])] -
      b.peakDepth[entrance(LANDMARKS[1])]) *
    100;
  return [
    {
      label: "District / peak flooded area",
      value: `${Math.abs(delta).toFixed(2)} ha`,
      direction:
        Math.abs(delta) < 0.005
          ? "No measurable change"
          : delta > 0
            ? "Less peak flooding"
            : "More peak flooding",
      text: "Compares each run’s largest recorded area above 10 cm; their peaks may occur at different minutes.",
      good: delta >= 0,
    },
    {
      label: "Clinic / access interruption",
      value: `${Math.abs(outage)} min`,
      direction:
        outage === 0
          ? "No change in interruption"
          : outage > 0
            ? "Shorter interruption"
            : "Longer interruption",
      text: `Baseline ${landmarkSummary(a, LANDMARKS[0]).outageMinutes} min · design ${landmarkSummary(b, LANDMARKS[0]).outageMinutes} min. Measured across the whole run.`,
      good: outage >= 0,
    },
    {
      label: "School / peak entrance depth",
      value: `${Math.abs(school).toFixed(1)} cm`,
      direction:
        Math.abs(school) < 0.05
          ? "No measurable change"
          : school > 0
            ? "Shallower peak depth"
            : "Deeper peak depth",
      text: "Compares the maximum entrance depth during the full rainfall and recovery window.",
      good: school >= 0,
    },
  ];
}
export type FlowArrow = { x: number; y: number; dx: number; dy: number };
// Coarse directions follow the same head-gradient logic as the storage-transfer model.
// They indicate direction only, never velocity or traced particle trajectories.
export function flowDirections(
  depth: Float32Array,
  z: Float64Array,
  map: District = DISTRICT,
): FlowArrow[] {
  const arrows: FlowArrow[] = [];
  for (let y = 3; y < N - 3; y += 6)
    for (let x = 3; x < N - 3; x += 6) {
      const i = y * N + x;
      if (depth[i] < 0.01 || map.kind[i] === 4) continue;
      let best = 0,
        dx = 0,
        dy = 0;
      for (const [vx, vy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const j = (y + vy) * N + x + vx;
        if (map.kind[j] === 4) continue;
        const h = z[i] + depth[i] - Math.max(z[i], z[j] + depth[j]);
        if (h > best) {
          best = h;
          dx = vx;
          dy = vy;
        }
      }
      if (best > 0.0005) arrows.push({ x, y, dx, dy });
    }
  return arrows;
}
export function floodEdges(depth: Float32Array) {
  const edges: number[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (depth[i] <= 0.1) continue;
      if (x === 0 || depth[i - 1] <= 0.1) edges.push(x, y, x, y + 1);
      if (x === N - 1 || depth[i + 1] <= 0.1)
        edges.push(x + 1, y, x + 1, y + 1);
      if (y === 0 || depth[i - N] <= 0.1) edges.push(x, y, x + 1, y);
      if (y === N - 1 || depth[i + N] <= 0.1)
        edges.push(x, y + 1, x + 1, y + 1);
    }
  return edges;
}
export const DEMOS = [
  {
    id: "services",
    title: "Essential services",
    tag: "THREE PLACES / 96 CREDITS",
    description:
      "Two basins and two drain upgrades balance clinic recovery, school protection and market access.",
    scenario: validate({
      ...missionScenario("services"),
      name: "Connected city",
      interventions: [
        { id: "b1", type: "basin", x: 59, y: 63 },
        { id: "b2", type: "basin", x: 29, y: 35 },
        { id: "d1", type: "drain", x: 64, y: 66 },
        { id: "d2", type: "drain", x: 29, y: 39 },
      ],
    }),
  },
  {
    id: "clinic",
    title: "Protect the clinic",
    tag: "ACCESS / 92 CREDITS",
    description:
      "A basin and three drain upgrades near the clinic. Watch when its access disappears and returns.",
    scenario: validate({
      ...missionScenario("clinic"),
      name: "Clinic rescue",
      interventions: [
        { id: "b", type: "basin", x: 59, y: 63 },
        { id: "d1", type: "drain", x: 64, y: 66 },
        { id: "d2", type: "drain", x: 66, y: 66 },
        { id: "d3", type: "drain", x: 61, y: 66 },
      ],
    }),
  },
  {
    id: "overload",
    title: "Overloaded drainage",
    tag: "BOTTLENECK / 44 CREDITS",
    description:
      "A restricted outlet and heavily blocked drains. Investigate why extra intakes may not be enough.",
    scenario: validate({
      ...DEFAULT,
      name: "Overloaded drainage",
      storm: "persistent",
      intensity: 100,
      duration: 40,
      recovery: 60,
      blockage: 80,
      outlet: 0.5,
      interventions: [
        { id: "d1", type: "drain", x: 64, y: 66 },
        { id: "d2", type: "drain", x: 29, y: 39 },
      ],
    }),
  },
  {
    id: "gardens",
    title: "A garden strategy",
    tag: "SOIL & STORAGE / 36 CREDITS",
    description:
      "Two gardens near lowlands. Save this design, then compare with the paving demo under the same conditions.",
    scenario: validate({
      ...DEFAULT,
      name: "Garden strategy",
      duration: 40,
      recovery: 60,
      interventions: [
        { id: "g1", type: "garden", x: 59, y: 63 },
        { id: "g2", type: "garden", x: 29, y: 35 },
      ],
    }),
  },
  {
    id: "paving",
    title: "A paving strategy",
    tag: "ABSORPTION / 24 CREDITS",
    description:
      "Paving at the same locations and in the same weather as the garden demo. Compare cost and measured outcomes.",
    scenario: validate({
      ...DEFAULT,
      name: "Paving strategy",
      duration: 40,
      recovery: 60,
      interventions: [
        { id: "p1", type: "paving", x: 59, y: 63 },
        { id: "p2", type: "paving", x: 29, y: 35 },
      ],
    }),
  },
] as const;
