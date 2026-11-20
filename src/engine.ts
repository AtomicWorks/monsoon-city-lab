export const N = 100,
  CELL = 10,
  AREA = 100,
  MODEL = "monsoon-1.3";
export type Tool = "paving" | "garden" | "basin" | "drain";
export const TOOLS: Record<
  Tool,
  {
    name: string;
    cost: number;
    radius: number;
    color: string;
    description: string;
  }
> = {
  paving: {
    name: "Permeable paving",
    cost: 12,
    radius: 4,
    color: "#c8c6ac",
    description:
      "Replace sealed surfaces with paving that lets rain soak into the soil.",
  },
  garden: {
    name: "Rain garden",
    cost: 18,
    radius: 4,
    color: "#9acb79",
    description:
      "Add planted depressions with 120 mm of temporary surface storage.",
  },
  basin: {
    name: "Retention basin",
    cost: 26,
    radius: 5,
    color: "#75b7c5",
    description:
      "Create a 350 mm depression that stores runoff and can overflow.",
  },
  drain: {
    name: "Drain upgrade",
    cost: 22,
    radius: 3,
    color: "#dfad64",
    description:
      "Increase intake capacity. The shared downstream outlet still limits discharge.",
  },
};
export type Intervention = { id: string; type: Tool; x: number; y: number };
export type LandKind = 0 | 1 | 4 | 5;
export const DEFAULT_PRESET = "bangla";
const DISTRICT_NAME = "Bangla Quarter";
export type Layout = {
  preset: typeof DEFAULT_PRESET | "dense" | "green" | "industrial";
  edits: { x: number; y: number; kind: LandKind }[];
};
export type Scenario = {
  layout?: Layout;
  version: 1;
  model: string;
  name: string;
  storm: "burst" | "persistent" | "double";
  intensity: number;
  duration: number;
  recovery?: number;
  infiltrationFactor?: number;
  challenge?: "clinic" | "school" | "market" | "services";
  blockage: number;
  outlet: number;
  interventions: Intervention[];
};
export const DEFAULT: Scenario = {
  version: 1,
  model: MODEL,
  name: DISTRICT_NAME,
  storm: "burst",
  intensity: 85,
  duration: 60,
  recovery: 60,
  infiltrationFactor: 1,
  blockage: 15,
  outlet: 4,
  interventions: [],
};
export type District = {
  z: Float64Array;
  kind: Uint8Array;
  roof: Int32Array;
  drains: Uint8Array;
};
export type Metrics = {
  time: number;
  rain: number;
  stored: number;
  infiltrated: number;
  discharged: number;
  residual: number;
  maxDepth: number;
  flooded: number;
  roads: number;
};
export type Frame = {
  depth: Float32Array;
  metrics: Metrics;
  draining?: Uint16Array;
  soilUsed?: Float32Array;
};
export type Result = {
  frames: Frame[];
  peakDepth: Float32Array;
  exposure: Float32Array;
  infiltration: Float32Array;
  drainage: Float32Array;
  elapsed: number;
  scenario: Scenario;
};
export function ground(x: number, y: number) {
  return (
    1.4 +
    0.016 * (100 - y) +
    0.55 * Math.sin(x * 0.065) +
    0.35 * Math.cos(y * 0.08) -
    1.15 * Math.exp(-((x - 62) ** 2 + (y - 64) ** 2) / 270) -
    0.65 * Math.exp(-((x - 27) ** 2 + (y - 35) ** 2) / 180)
  );
}
export function district(): District {
  const z = new Float64Array(N * N),
    kind = new Uint8Array(N * N),
    roof = new Int32Array(N * N).fill(-1),
    drains = new Uint8Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      z[i] = ground(x, y);
      const road =
        (x % 20 >= 8 && x % 20 <= 11) || (y % 20 >= 8 && y % 20 <= 11);
      const park = x < 27 && y > 68,
        pond = (x - 83) ** 2 / 80 + (y - 68) ** 2 / 170 < 1;
      kind[i] = road ? 1 : pond ? 3 : park ? 0 : 2;
      if (pond && !road) z[i] -= 0.45;
      if (road && x % 20 === 9 && y % 10 === 0) drains[i] = 1;
    }
  for (let y = 4; y < 94; y += 10)
    for (let x = 4; x < 94; x += 10) {
      if (kind[y * N + x] !== 2) continue;
      for (let dy = -2; dy <= 1; dy++)
        for (let dx = -2; dx <= 1; dx++) {
          const i = (y + dy) * N + x + dx;
          if (kind[i] === 2) {
            kind[i] = 4;
            roof[i] = (y + 2) * N + x + dx;
          }
        }
    }
  return { z, kind, roof, drains };
}
export const DISTRICT = district();
export function cost(items: Intervention[]) {
  return items.reduce((s, t) => s + TOOLS[t.type].cost, 0);
}
export function currentScenarioName(name: string) {
  return name === "Shonar Quarter" ? DISTRICT_NAME : name;
}
export function validate(input: unknown): Scenario {
  if (!input || typeof input !== "object")
    throw Error("This file is not a MONSOON scenario.");
  const s = input as Scenario;
  if (
    s.version !== 1 ||
    ![MODEL, "monsoon-1.2", "monsoon-1.1", "monsoon-1.0"].includes(s.model)
  )
    throw Error("Unsupported scenario or model version.");
  if (!["burst", "persistent", "double"].includes(s.storm))
    throw Error("Unknown storm profile.");
  for (const [key, min, max] of [
    ["intensity", 0, 160],
    ["duration", 20, 120],
    ["blockage", 0, 100],
    ["outlet", 0, 12],
  ] as const)
    if (
      typeof s[key] !== "number" ||
      !Number.isFinite(s[key]) ||
      s[key] < min ||
      s[key] > max
    )
      throw Error(`Invalid ${key}.`);
  if (
    !Number.isInteger(s.duration) ||
    typeof s.name !== "string" ||
    s.name.length > 100 ||
    !Array.isArray(s.interventions) ||
    s.interventions.length > 8
  )
    throw Error("Invalid scenario contents.");
  const layout = validateLayout(s.layout);
  if (s.challenge && layout)
    throw Error(
      "Missions use the original district. Return to sandbox to edit its layout.",
    );
  const map = districtFor(layout);
  const ids = new Set<string>(),
    positions = new Set<string>();
  for (const t of s.interventions) {
    if (
      !t ||
      !Object.hasOwn(TOOLS, t.type) ||
      typeof t.id !== "string" ||
      ids.has(t.id) ||
      !Number.isInteger(t.x) ||
      !Number.isInteger(t.y) ||
      t.x < 0 ||
      t.x >= N ||
      t.y < 0 ||
      t.y >= N ||
      [3, 4].includes(map.kind[t.y * N + t.x])
    )
      throw Error("An intervention is invalid or outside a buildable area.");
    const p = `${t.x},${t.y}`;
    if (positions.has(p))
      throw Error("Two interventions occupy the same location.");
    positions.add(p);
    ids.add(t.id);
  }
  if (cost(s.interventions) > 100)
    throw Error("This plan exceeds the 100-credit budget.");
  if (
    s.recovery !== undefined &&
    (!Number.isInteger(s.recovery) || s.recovery < 0 || s.recovery > 180)
  )
    throw Error("Recovery must be between 0 and 180 minutes.");
  if (
    s.challenge !== undefined &&
    !["clinic", "school", "market", "services"].includes(s.challenge)
  )
    throw Error("Unknown challenge.");
  if (
    s.infiltrationFactor !== undefined &&
    (!Number.isFinite(s.infiltrationFactor) ||
      s.infiltrationFactor < 0 ||
      s.infiltrationFactor > 2)
  )
    throw Error("Soil absorption multiplier must be between 0 and 2.");
  return {
    ...structuredClone(s),
    model: MODEL,
    name: currentScenarioName(s.name),
    ...(layout ? { layout } : {}),
    recovery: s.recovery ?? 0,
    infiltrationFactor: s.infiltrationFactor ?? 1,
  };
}
export function rainfall(s: Scenario, t: number) {
  if (t < 0 || t >= s.duration * 60) return 0;
  const u = t / (s.duration * 60);
  return (
    s.intensity *
    (s.storm === "persistent"
      ? 0.72
      : s.storm === "burst"
        ? 0.12 + 0.88 * Math.exp(-(((u - 0.36) / 0.17) ** 2))
        : 0.12 +
          0.8 * Math.exp(-(((u - 0.24) / 0.12) ** 2)) +
          0.88 * Math.exp(-(((u - 0.7) / 0.13) ** 2)))
  );
}
export function terrainFor(items: Intervention[], map: District = DISTRICT) {
  const z = map.z.slice();
  for (const t of items) {
    const r = TOOLS[t.type].radius;
    for (let y = Math.max(0, t.y - r); y <= Math.min(N - 1, t.y + r); y++)
      for (let x = Math.max(0, t.x - r); x <= Math.min(N - 1, t.x + r); x++) {
        const i = y * N + x;
        if ((x - t.x) ** 2 + (y - t.y) ** 2 <= r * r && map.kind[i] !== 4) {
          if (t.type === "basin") z[i] -= 0.35;
          if (t.type === "garden") z[i] -= 0.12;
        }
      }
  }
  return z;
}
export function hydraulicFields(s: Scenario) {
  const len = N * N,
    rate = new Float64Array(len),
    capacity = new Float64Array(len),
    intake = new Float64Array(len);
  const map = districtFor(s.layout);
  const { kind, drains } = map;
  for (let i = 0; i < len; i++) {
    rate[i] =
      (kind[i] === 0 ? 12 : kind[i] === 2 ? 3 : kind[i] === 3 ? 1 : 0) /
      3600000;
    capacity[i] = kind[i] === 0 ? 0.1 : 0.03;
    intake[i] = drains[i] ? 0.06 : 0;
  }
  for (const t of s.interventions) {
    const r = TOOLS[t.type].radius;
    for (let y = Math.max(0, t.y - r); y <= Math.min(N - 1, t.y + r); y++)
      for (let x = Math.max(0, t.x - r); x <= Math.min(N - 1, t.x + r); x++) {
        const i = y * N + x;
        if ((x - t.x) ** 2 + (y - t.y) ** 2 > r * r || kind[i] === 4) continue;
        if (t.type === "paving" || t.type === "garden") {
          rate[i] = Math.max(
            rate[i],
            (t.type === "garden" ? 45 : 28) / 3600000,
          );
          capacity[i] = Math.max(capacity[i], 0.22);
        }
        if (t.type === "drain") intake[i] = Math.max(intake[i], 0.012);
      }
  }
  return { z: terrainFor(s.interventions, map), rate, capacity, intake };
}
export function simulate(
  s: Scenario,
  progress?: (p: number) => void,
  step = 2,
): Result {
  if (!Number.isFinite(step) || step <= 0 || step > 60)
    throw Error("Invalid simulation time step.");
  s = validate(s);
  const started = performance.now(),
    len = N * N,
    { z, rate, capacity, intake } = hydraulicFields(s),
    water = new Float64Array(len),
    soil = new Float64Array(len),
    delta = new Float64Array(len),
    outgoing = new Float64Array(len),
    east = new Float64Array(len),
    south = new Float64Array(len),
    peakDepth = new Float32Array(len),
    exposure = new Float32Array(len),
    infiltration = new Float32Array(len),
    drainage = new Float32Array(len);
  const { kind, roof } = districtFor(s.layout);
  let rain = 0,
    infiltrated = 0,
    discharged = 0;
  const frames: Frame[] = [];
  const previousDrainage = new Float32Array(len);
  const duration = (s.duration + (s.recovery ?? 0)) * 60;
  let nextFrame = 0;
  const snapshot = (time: number) => {
    let stored = 0,
      maxDepth = 0,
      flooded = 0,
      roads = 0;
    const depth = new Float32Array(len);
    const draining: number[] = [];
    for (let i = 0; i < len; i++) {
      const h = water[i] / AREA;
      depth[i] = h;
      if (drainage[i] > previousDrainage[i]) draining.push(i);
      stored += water[i];
      maxDepth = Math.max(maxDepth, h);
      if (h > 0.1) flooded += AREA;
      if (h > 0.15 && kind[i] === 1) roads += AREA;
    }
    frames.push({
      depth,
      draining: Uint16Array.from(draining),
      soilUsed: Float32Array.from(soil),
      metrics: {
        time,
        rain,
        stored,
        infiltrated,
        discharged,
        residual: rain - stored - infiltrated - discharged,
        maxDepth,
        flooded,
        roads,
      },
    });
    previousDrainage.set(drainage);
  };
  snapshot(0);
  nextFrame = 60;
  for (let time = 0; time < duration;) {
    const dt = Math.min(step, 2.8, duration - time, nextFrame - time);
    const add = (rainfall(s, time + dt / 2) / 3600000) * dt * AREA;
    rain += add * len;
    for (let i = 0; i < len; i++) water[roof[i] >= 0 ? roof[i] : i] += add;
    for (let i = 0; i < len; i++) {
      const loss = Math.max(
        0,
        Math.min(
          water[i],
          rate[i] * (s.infiltrationFactor ?? 1) * dt * AREA,
          (capacity[i] - soil[i]) * AREA,
        ),
      );
      water[i] -= loss;
      soil[i] += loss / AREA;
      infiltrated += loss;
      infiltration[i] += loss;
    }
    outgoing.fill(0);
    delta.fill(0);
    east.fill(0);
    south.fill(0);
    const flux = (a: number, b: number) => {
      if (kind[a] === 4 || kind[b] === 4) return 0;
      const diff = z[a] + water[a] / AREA - z[b] - water[b] / AREA;
      const source = diff > 0 ? a : b;
      const target = diff > 0 ? b : a;
      const head = Math.max(
        0,
        z[source] +
          water[source] / AREA -
          Math.max(z[source], z[target] + water[target] / AREA),
      );
      return Math.sign(diff) * Math.min(head * 8 * dt, water[source]);
    };
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (x < N - 1) {
          const f = flux(i, i + 1);
          east[i] = f;
          outgoing[f > 0 ? i : i + 1] += Math.abs(f);
        }
        if (y < N - 1) {
          const f = flux(i, i + N);
          south[i] = f;
          outgoing[f > 0 ? i : i + N] += Math.abs(f);
        }
      }
    const transfer = (a: number, b: number, f: number) => {
      const source = f > 0 ? a : b;
      const adjusted = f * Math.min(1, water[source] / (outgoing[source] || 1));
      delta[a] -= adjusted;
      delta[b] += adjusted;
    };
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        if (x < N - 1) transfer(i, i + 1, east[i]);
        if (y < N - 1) transfer(i, i + N, south[i]);
      }
    let demand = 0;
    for (let i = 0; i < len; i++) {
      water[i] = Math.max(0, water[i] + delta[i]);
      demand += Math.min(water[i], intake[i] * dt * (1 - s.blockage / 100));
    }
    const factor = Math.min(1, (s.outlet * dt) / (demand || 1));
    for (let i = 0; i < len; i++) {
      const loss =
        Math.min(water[i], intake[i] * dt * (1 - s.blockage / 100)) * factor;
      water[i] -= loss;
      discharged += loss;
      drainage[i] += loss;
      const depth = water[i] / AREA;
      peakDepth[i] = Math.max(peakDepth[i], depth);
      if (depth > 0.1) exposure[i] += dt;
    }
    time += dt;
    if (time >= nextFrame - 1e-8 || time >= duration) {
      snapshot(time);
      nextFrame += 60;
      progress?.(time / duration);
    }
  }
  return {
    frames,
    peakDepth,
    exposure,
    infiltration,
    drainage,
    elapsed: performance.now() - started,
    scenario: structuredClone(s),
  };
}
export function access(depth: Float32Array, map: District = DISTRICT) {
  const road = map.kind,
    seen = new Uint8Array(N * N),
    queue: number[] = [];
  for (let x = 0; x < N; x++)
    if (road[x] === 1 && depth[x] <= 0.15) {
      seen[x] = 1;
      queue.push(x);
    }
  for (let p = 0; p < queue.length; p++) {
    const i = queue[p],
      x = i % N;
    for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, i - N, i + N])
      if (
        j >= 0 &&
        j < N * N &&
        !seen[j] &&
        road[j] === 1 &&
        depth[j] <= 0.15
      ) {
        seen[j] = 1;
        queue.push(j);
      }
  }
  let total = 0,
    connected = 0;
  for (let i = 0; i < N * N; i++)
    if (road[i] === 1) {
      total++;
      if (seen[i]) connected++;
    }
  return total ? Math.round((connected / total) * 100) : 0;
}

export const PRESETS = {
  [DEFAULT_PRESET]: {
    name: DISTRICT_NAME,
    description: "The original district and mission map.",
  },
  dense: {
    name: "Dense urban quarter",
    description:
      "Compact buildings, sealed courtyards and the original street grid.",
  },
  green: {
    name: "Garden neighborhood",
    description:
      "Park blocks alternate with homes, increasing soil storage and absorption.",
  },
  industrial: {
    name: "Industrial district",
    description:
      "Industrial blocks and sealed yards leave little absorbent ground.",
  },
} as const;
// Landmarks and the existing pond remain intact across every editable layout.
export function protectedLot(x: number, y: number) {
  return (
    (x === 6 && y === 6) ||
    (x === 2 && y === 3) ||
    (x === 7 && y === 2) ||
    Array.from(
      { length: 100 },
      (_, n) =>
        DISTRICT.kind[(y * 10 + Math.floor(n / 10)) * N + x * 10 + (n % 10)],
    ).includes(3)
  );
}
export function validateLayout(input: unknown): Layout | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object")
    throw Error("Invalid district layout.");
  const v = input as { preset: string; edits: Layout["edits"] };
  // Earlier saves and share links used this key for the original district.
  const preset = v.preset === "shonar" ? DEFAULT_PRESET : v.preset;
  if (
    !Object.hasOwn(PRESETS, preset) ||
    !Array.isArray(v.edits) ||
    v.edits.length > 100
  )
    throw Error("Invalid district preset or edits.");
  const seen = new Set<number>();
  const edits = v.edits
    .map((e) => {
      if (
        !e ||
        !Number.isInteger(e.x) ||
        !Number.isInteger(e.y) ||
        e.x < 0 ||
        e.x > 9 ||
        e.y < 0 ||
        e.y > 9 ||
        ![0, 1, 4, 5].includes(e.kind) ||
        protectedLot(e.x, e.y) ||
        seen.has(e.y * 10 + e.x)
      )
        throw Error("Invalid, duplicate or protected district block.");
      seen.add(e.y * 10 + e.x);
      return { x: e.x, y: e.y, kind: e.kind };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return { preset: preset as Layout["preset"], edits };
}
const districtCache = new Map<string, District>();
export function districtFor(layout?: Layout): District {
  if (!layout || (layout.preset === DEFAULT_PRESET && !layout.edits.length))
    return DISTRICT;
  const key = JSON.stringify(layout);
  const cached = districtCache.get(key);
  if (cached) return cached;
  const map: District = {
    z: DISTRICT.z.slice(),
    kind: DISTRICT.kind.slice(),
    roof: DISTRICT.roof.slice(),
    drains: DISTRICT.drains.slice(),
  };
  const paint = (
    bx: number,
    by: number,
    kind: LandKind,
    preserveRoads: boolean,
  ) => {
    if (protectedLot(bx, by)) return;
    for (let dy = 0; dy < 10; dy++)
      for (let dx = 0; dx < 10; dx++) {
        const x = bx * 10 + dx,
          y = by * 10 + dy,
          i = y * N + x;
        if (preserveRoads && DISTRICT.kind[i] === 1) continue;
        const roof = kind === 4 && dx >= 2 && dx <= 5 && dy >= 2 && dy <= 5;
        map.kind[i] = roof ? 4 : kind === 4 ? 5 : kind;
        map.roof[i] = roof ? (by * 10 + 6) * N + x : -1;
        map.drains[i] =
          map.kind[i] === 1 && x % 20 === 9 && y % 10 === 0 ? 1 : 0;
      }
  };
  if (layout.preset !== DEFAULT_PRESET)
    for (let y = 0; y < 10; y++)
      for (let x = 0; x < 10; x++) {
        const kind: LandKind =
          layout.preset === "green"
            ? (x + y) % 3
              ? 0
              : 4
            : layout.preset === "industrial"
              ? (x + y) % 2
                ? 5
                : 4
              : 4;
        paint(x, y, kind, true);
      }
  for (const e of layout.edits) paint(e.x, e.y, e.kind, false);
  if (districtCache.size >= 24)
    districtCache.delete(districtCache.keys().next().value!);
  districtCache.set(key, map);
  return map;
}
export function baselineScenario(s: Scenario): Scenario {
  return {
    ...s,
    interventions: [],
    ...(s.layout ? { layout: { preset: s.layout.preset, edits: [] } } : {}),
  };
}
export function paintLayout(
  s: Scenario,
  x: number,
  y: number,
  kind: LandKind,
  radius = 0,
): Scenario {
  if (s.challenge)
    throw Error("Return to sandbox before editing the district.");
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x > 9 ||
    y < 0 ||
    y > 9 ||
    ![0, 1, 2].includes(radius)
  )
    throw Error("Choose a block from 0 to 9.");
  const layout = s.layout ?? { preset: DEFAULT_PRESET, edits: [] };
  const edits = new Map(layout.edits.map((e) => [e.y * 10 + e.x, e]));
  let changed = 0;
  for (let by = Math.max(0, y - radius); by <= Math.min(9, y + radius); by++)
    for (
      let bx = Math.max(0, x - radius);
      bx <= Math.min(9, x + radius);
      bx++
    ) {
      if (protectedLot(bx, by)) continue;
      edits.set(by * 10 + bx, { x: bx, y: by, kind });
      changed++;
    }
  if (!changed)
    throw Error("This block protects a landmark or the existing pond.");
  return validate({ ...s, layout: { ...layout, edits: [...edits.values()] } });
}
// Typed-array buffers of simulation results, each listed once, for a
// postMessage transfer list (a repeated buffer makes postMessage throw).
export function resultBuffers(...results: Result[]): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  const add = (view?: ArrayBufferView) => {
    if (view) buffers.add(view.buffer as ArrayBuffer);
  };
  for (const r of results) {
    for (const f of r.frames) {
      add(f.depth);
      add(f.draining);
      add(f.soilUsed);
    }
    add(r.peakDepth);
    add(r.exposure);
    add(r.infiltration);
    add(r.drainage);
  }
  return [...buffers];
}
