import { DISTRICT, N, type District } from "./engine";
import { LANDMARKS, route } from "./impact";
export type AccessLayer = "water" | "roads" | "services";
export function adjacent(i: number) {
  const x = i % N;
  return [
    x > 0 ? i - 1 : -1,
    x < N - 1 ? i + 1 : -1,
    i >= N ? i - N : -1,
    i < N * (N - 1) ? i + N : -1,
  ].filter((j) => j >= 0);
}
export function roadField(
  depth: Float32Array,
  end: "north" | "south",
  map: District = DISTRICT,
) {
  const next = new Int32Array(N * N).fill(-1),
    queue = new Int32Array(N * N);
  let size = 0;
  for (let x = 0; x < N; x++) {
    const i = (end === "north" ? 0 : N - 1) * N + x;
    if (map.kind[i] === 1 && depth[i] <= 0.15) {
      next[i] = i;
      queue[size++] = i;
    }
  }
  for (let p = 0; p < size; p++) {
    const i = queue[p];
    for (const j of adjacent(i))
      if (next[j] === -1 && map.kind[j] === 1 && depth[j] <= 0.15) {
        next[j] = i;
        queue[size++] = j;
      }
  }
  return next;
}
export type Mobility = ReturnType<typeof computeMobility>;
function computeMobility(depth: Float32Array, map: District) {
  const north = roadField(depth, "north", map),
    south = roadField(depth, "south", map);
  const services = LANDMARKS.map((l) => {
    const path = route(depth, l, false, map),
      connected = path.length > 0;
    const display = connected ? path : route(depth, l, true, map);
    return {
      landmark: l,
      connected,
      path: display,
      blocked: connected ? undefined : display.find((i) => depth[i] > 0.15),
    };
  });
  return { north, south, services };
}
// Bounded cache shares the current baseline/design analysis between UI and renderer.
const caches = new WeakMap<District, Map<Float32Array, Mobility>>();
export function mobility(depth: Float32Array, map: District = DISTRICT) {
  let cache = caches.get(map);
  if (!cache) {
    cache = new Map();
    caches.set(map, cache);
  }
  const found = cache.get(depth);
  if (found) return found;
  const value = computeMobility(depth, map);
  cache.set(depth, value);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return value;
}
export type Vehicle = {
  cell: number;
  next: number;
  progress: number;
  speed: number;
  heading: number;
  destination: "north" | "south";
  state: "moving" | "waiting" | "flooded";
};
const STARTS = [
  [69, 66],
  [29, 39],
  [49, 84],
  [89, 53],
  [9, 45],
  [69, 20],
  [29, 81],
  [49, 33],
  [89, 9],
  [9, 89],
  [69, 49],
  [29, 19],
  [49, 66],
  [89, 79],
  [9, 23],
  [69, 89],
  [29, 59],
  [49, 9],
];
export function createTraffic(map: District = DISTRICT): Vehicle[] {
  return STARTS.filter(([x, y]) => map.kind[y * N + x] === 1).map(
    ([x, y], i) => ({
      cell: y * N + x,
      next: -1,
      progress: 0,
      speed: 0,
      heading: 0,
      destination: i % 2 ? "south" : "north",
      state: "waiting",
    }),
  );
}
export function advanceVehicle(
  v: Vehicle,
  depth: Float32Array,
  graph: Mobility,
  dt: number,
) {
  dt = Math.max(0, Math.min(0.05, dt));
  if (depth[v.cell] > 0.15) {
    v.speed = 0;
    v.state = "flooded";
    return;
  }
  let field = v.destination === "north" ? graph.north : graph.south;
  if (v.next < 0 || v.progress === 0) {
    if (field[v.cell] === v.cell) {
      v.destination = v.destination === "north" ? "south" : "north";
      field = v.destination === "north" ? graph.north : graph.south;
    }
    v.next = field[v.cell];
  }
  const blocked = v.next < 0 || v.next === v.cell || depth[v.next] > 0.15;
  if (blocked) {
    v.speed *= Math.exp(-dt * 10);
    // Stop within the current dry cell. If a snapshot floods an occupied
    // segment, hold position; never teleport onto another route.
    if (v.next >= 0 && v.progress < 0.38)
      v.progress = Math.min(0.38, v.progress + v.speed * dt);
    v.state = "waiting";
    if (v.progress === 0) v.next = -1;
    return;
  }
  const after = field[v.next];
  const target = after < 0 ? 0.25 : 0.7;
  v.speed += (target - v.speed) * (1 - Math.exp(-dt * 4));
  v.heading = Math.atan2(
    (v.next % N) - (v.cell % N),
    Math.floor(v.next / N) - Math.floor(v.cell / N),
  );
  v.progress += v.speed * dt;
  v.state = "moving";
  if (v.progress >= 1) {
    v.cell = v.next;
    v.next = -1;
    v.progress = 0;
  }
}
export function vehiclePosition(v: Vehicle) {
  const next = v.next < 0 ? v.cell : v.next;
  return {
    x: ((v.cell % N) + ((next % N) - (v.cell % N)) * v.progress) * 10 - 495,
    z:
      (Math.floor(v.cell / N) +
        (Math.floor(next / N) - Math.floor(v.cell / N)) * v.progress) *
        10 -
      495,
  };
}
