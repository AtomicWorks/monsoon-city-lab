import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT,
  MODEL,
  N,
  simulate,
  rainfall,
  validate,
  type Scenario,
} from "../src/engine";
import {
  LANDMARKS,
  route,
  entrance,
  landmarkSummary,
  missionScenario,
  matchesMission,
  challengeOutcome,
} from "../src/impact";
test("all three missions have a verified within-budget solution", () => {
  for (const id of ["clinic", "school", "market"] as const) {
    const s = missionScenario(id);
    const interventions: Scenario["interventions"] =
      id === "clinic"
        ? [
            { id: "b1", type: "basin", x: 59, y: 63 },
            { id: "d1", type: "drain", x: 64, y: 66 },
            { id: "d2", type: "drain", x: 66, y: 66 },
            { id: "d3", type: "drain", x: 61, y: 66 },
          ]
        : [
            { id: "b1", type: "basin", x: 59, y: 63 },
            { id: "b2", type: "basin", x: 29, y: 35 },
            { id: "d1", type: "drain", x: 64, y: 66 },
            { id: "d2", type: "drain", x: 29, y: 39 },
          ];
    const a = simulate(s),
      b = simulate({ ...s, interventions }),
      outcome = challengeOutcome(b.scenario, a, b);
    assert.equal(outcome?.complete, true, JSON.stringify({ id, outcome }));
    console.log("Verified mission", id, JSON.stringify(outcome));
  }
});
test("rain stops exactly at storm end, recovery conserves mass and removes surface water", () => {
  const s = { ...DEFAULT, duration: 20, recovery: 30 };
  const r = simulate(s);
  assert.equal(r.frames.length, 51);
  assert.equal(rainfall(s, 1200), 0);
  assert.equal(rainfall(s, 1800), 0);
  const rainEnd = r.frames[20].metrics,
    end = r.frames.at(-1)!.metrics;
  assert.equal(end.rain, rainEnd.rain);
  assert.ok(end.stored < rainEnd.stored);
  assert.ok(Math.abs(end.residual) < 1e-5);
  for (let k = 21; k < r.frames.length; k++)
    assert.ok(
      r.frames[k].metrics.stored <= r.frames[k - 1].metrics.stored + 1e-6,
    );
});
test("legacy imports preserve zero recovery and upgrade model without mutating input", () => {
  const old = { ...DEFAULT, model: "monsoon-1.0" };
  delete old.recovery;
  const v = validate(old);
  assert.equal(v.model, MODEL);
  assert.equal(v.recovery, 0);
  assert.equal(old.model, "monsoon-1.0");
  for (const recovery of [-1, 181, NaN, 1.5])
    assert.throws(() => validate({ ...DEFAULT, recovery }));
});
test("landmark routes connect when dry and detect a blocked entrance", () => {
  for (const l of LANDMARKS) {
    const depth = new Float32Array(N * N);
    const p = route(depth, l);
    assert.ok(p.length > 0, l.name);
    assert.equal(p[0], entrance(l));
    assert.ok(p.at(-1)! < N);
    depth[entrance(l)] = 0.2;
    assert.equal(route(depth, l).length, 0);
    assert.ok(route(depth, l, true).length > 0);
  }
});
test("landmark recovery reports never interrupted, restored and censored outcomes", () => {
  const r = simulate({ ...DEFAULT, intensity: 0, duration: 20, recovery: 15 });
  const l = LANDMARKS[0],
    i = entrance(l);
  assert.equal(landmarkSummary(r, l).outageMinutes, 0);
  r.frames[21].depth[i] = 0.2;
  r.frames[22].depth[i] = 0.2;
  let summary = landmarkSummary(r, l);
  assert.equal(summary.outageMinutes, 2);
  assert.equal(summary.restored, 3);
  r.frames.at(-1)!.depth[i] = 0.2;
  summary = landmarkSummary(r, l);
  assert.equal(summary.restored, null);
  assert.equal(summary.connectedAtEnd, false);
});
test("challenge objectives are bound to fixed conditions and peak flooded area", () => {
  for (const id of ["clinic", "school", "market"] as const) {
    const s = missionScenario(id);
    assert.equal(matchesMission(s), true);
    assert.equal(matchesMission({ ...s, intensity: 0 }), false);
    validate(s);
  }
  const s = missionScenario("clinic");
  const r = simulate({ ...s, duration: 20, recovery: 0 });
  assert.equal(challengeOutcome({ ...s, intensity: 0 }, r, r), null);
});
