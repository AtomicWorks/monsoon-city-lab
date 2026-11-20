import test from "node:test";
import assert from "node:assert/strict";
import { N, DISTRICT, cost, simulate, type Intervention } from "../src/engine";
import { DEMOS } from "../src/experience";
import { challengeOutcome, missionScenario } from "../src/impact";
import {
  placeIntervention,
  placementError,
  recordEdit,
  travelHistory,
  type EditHistory,
} from "../src/editing";
import {
  adjacent,
  roadField,
  mobility,
  createTraffic,
  advanceVehicle,
  vehiclePosition,
} from "../src/mobility";
import { encodeScenario, decodeScenario } from "../src/share";

test("moves preserve identity and budget; copies enforce placement, budget and count", () => {
  const original: Intervention[] = [{ id: "b", type: "basin", x: 59, y: 63 }];
  const moved = placeIntervention(original, "basin", 60, 63, "unused", "b");
  assert.equal(moved[0].id, "b");
  assert.equal(cost(moved), cost(original));
  assert.equal(original[0].x, 59);
  const copied = placeIntervention(moved, "basin", 59, 63, "copy");
  assert.equal(copied.length, 2);
  assert.equal(copied[1].id, "copy");
  assert.equal(cost(copied), 2 * cost(original));
  assert.match(placementError(copied, "basin", 59, 63)!, /occupies/);
  for (const x of [-1, 100, 1.5, NaN])
    assert.match(placementError([], "basin", x, 63)!, /0 to 99/);
  const roof = Array.from(DISTRICT.kind).findIndex((k) => k === 3);
  assert.match(
    placementError([], "basin", roof % N, Math.floor(roof / N))!,
    /open ground/,
  );
  const demo = DEMOS.find((d) => d.id === "services")!.scenario;
  assert.match(placementError(demo.interventions, "basin", 60, 63)!, /budget/);
  assert.equal(placementError(demo.interventions, "basin", 60, 63, "b1"), null);
  const eight = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    type: "garden" as const,
    x: 9,
    y: 10 + i,
  }));
  assert.match(placementError(eight, "garden", 60, 63)!, /eight/);
});

test("undo and redo restore complete plans and a new edit discards the redo branch", () => {
  const history: EditHistory = { past: [], future: [] };
  const empty: Intervention[] = [];
  const added = placeIntervention(empty, "drain", 64, 66, "d");
  recordEdit(history, empty);
  const moved = placeIntervention(added, "drain", 65, 66, "unused", "d");
  recordEdit(history, added);
  const undo = travelHistory(history, moved, "undo");
  assert.deepEqual(undo, added);
  assert.deepEqual(travelHistory(history, undo, "redo"), moved);
  const again = travelHistory(history, moved, "undo");
  recordEdit(history, again);
  assert.equal(history.future.length, 0);
  again[0].x = 1;
  assert.equal(history.past.at(-1)![0].x, 64);
});

test("road routing respects boundaries, closures and alternate paths", () => {
  assert.ok(!adjacent(99).includes(100));
  const dry = new Float32Array(N * N),
    start = 66 * N + 69;
  const original = roadField(dry, "north");
  assert.ok(original[start] >= 0);
  const closed = dry.slice();
  closed[original[start]] = 0.2;
  const rerouted = roadField(closed, "north");
  assert.ok(rerouted[start] >= 0);
  assert.notEqual(rerouted[start], original[start]);
  let cell = start;
  const seen = new Set<number>();
  while (rerouted[cell] !== cell) {
    assert.ok(!seen.has(cell));
    seen.add(cell);
    const next = rerouted[cell];
    assert.ok(adjacent(cell).includes(next));
    assert.equal(DISTRICT.kind[next], 1);
    assert.ok(closed[next] <= 0.15);
    cell = next;
  }
  assert.ok(cell < N);
  const barrier = dry.slice();
  barrier.fill(0.2, 50 * N, 51 * N);
  assert.equal(roadField(barrier, "north")[start], -1);
  assert.ok(roadField(barrier, "south")[start] >= 0);
  assert.equal(mobility(dry), mobility(dry));
});

test("traffic brakes before a newly flooded cell and resumes after recovery", () => {
  const dry = new Float32Array(N * N),
    graph = mobility(dry),
    v = createTraffic()[0];
  advanceVehicle(v, dry, graph, 0.05);
  assert.equal(v.state, "moving");
  const next = v.next;
  v.progress = 0.2;
  v.speed = 0.7;
  const blocked = dry.slice();
  blocked[next] = 0.2;
  const blockedGraph = mobility(blocked);
  const cell = v.cell;
  for (let k = 0; k < 100; k++) advanceVehicle(v, blocked, blockedGraph, 0.05);
  assert.equal(v.cell, cell);
  assert.equal(v.state, "waiting");
  assert.ok(v.progress < 0.5);
  assert.ok(v.speed < 0.01);
  const before = vehiclePosition(v);
  advanceVehicle(v, dry, graph, 0.05);
  assert.equal(v.state, "moving");
  assert.notDeepEqual(vehiclePosition(v), before);
  for (let k = 0; k < 50; k++) advanceVehicle(v, dry, graph, 0.05);
  assert.notEqual(v.cell, cell);
  const occupied = dry.slice();
  occupied[v.cell] = 0.3;
  const stopped = vehiclePosition(v);
  advanceVehicle(v, occupied, mobility(occupied), 0.05);
  assert.equal(v.state, "flooded");
  assert.deepEqual(vehiclePosition(v), stopped);
});

test("combined services challenge has a verified 96-credit solution and fixed conditions", () => {
  const s = DEMOS.find((d) => d.id === "services")!.scenario;
  assert.equal(cost(s.interventions), 96);
  assert.equal(decodeScenario(encodeScenario(s)).challenge, "services");
  const baseline = simulate(missionScenario("services")),
    design = simulate(s);
  const outcome = challengeOutcome(s, baseline, design)!;
  assert.equal(outcome.complete, true);
  assert.equal(outcome.goals.length, 3);
  assert.ok(outcome.goals.every((g) => g.met));
  assert.ok(outcome.improvement >= 5);
  assert.equal(
    challengeOutcome(baseline.scenario, baseline, baseline)?.complete,
    false,
  );
  assert.equal(
    challengeOutcome({ ...s, intensity: s.intensity + 1 }, baseline, design),
    null,
  );
});
