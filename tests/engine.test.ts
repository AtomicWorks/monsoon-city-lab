import test from "node:test";
import assert from "node:assert/strict";
import {
  simulate,
  validate,
  DEFAULT,
  DISTRICT,
  N,
  access,
  type Scenario,
} from "../src/engine.ts";
const small: Scenario = { ...DEFAULT, duration: 20, recovery: 0 };
const last = (r: ReturnType<typeof simulate>) => r.frames.at(-1)!.metrics;
test("dry initial state and zero rain stay dry", () => {
  const r = simulate({ ...small, intensity: 0 });
  assert.equal(last(r).stored, 0);
  assert.equal(last(r).discharged, 0);
  assert.equal(last(r).rain, 0);
  assert.equal(access(r.frames.at(-1)!.depth), 100);
});
test("rain is conserved and all depths stay finite and nonnegative", () => {
  const r = simulate(small),
    m = last(r);
  assert.ok(m.rain > 0);
  assert.ok(Math.abs(m.residual) / m.rain < 1e-9);
  for (const f of r.frames)
    for (const h of f.depth) assert.ok(Number.isFinite(h) && h >= 0);
  assert.equal(r.frames.length, 21);
  assert.ok(m.discharged <= small.outlet * small.duration * 60 + 1e-6);
});
test("closed drainage cannot discharge; all rain remains in surface or soil storage", () => {
  const m = last(simulate({ ...small, outlet: 0 }));
  assert.equal(m.discharged, 0);
  assert.ok(Math.abs(m.rain - m.stored - m.infiltrated) < 1e-5);
});
test("blocked intakes cannot discharge despite outlet capacity", () => {
  assert.equal(last(simulate({ ...small, blockage: 100 })).discharged, 0);
});
test("deterministic repeated runs and matching conditions", () => {
  const a = simulate(small),
    b = simulate(small);
  assert.deepEqual(a.frames.at(-1), b.frames.at(-1));
});
test("finite interventions conserve water and affect results", () => {
  const baseline = simulate(small);
  const improved = simulate({
    ...small,
    interventions: [
      { id: "garden", type: "garden", x: 62, y: 68 },
      { id: "basin", type: "basin", x: 59, y: 63 },
      { id: "pave", type: "paving", x: 29, y: 39 },
      { id: "drain", type: "drain", x: 69, y: 60 },
    ],
  });
  const m = last(improved);
  assert.ok(Math.abs(m.residual) / m.rain < 1e-9);
  assert.ok(m.infiltrated > last(baseline).infiltrated);
  assert.notDeepEqual(
    improved.frames.at(-1)!.depth,
    baseline.frames.at(-1)!.depth,
  );
  console.log(
    "Intervention fixture",
    JSON.stringify({
      baseline: last(baseline),
      improved: m,
      ms: improved.elapsed,
    }),
  );
});
test("halving the time step produces consistent aggregate storage", () => {
  const a = last(simulate(small, undefined, 2)),
    b = last(simulate(small, undefined, 1));
  const rel = Math.abs(a.stored - b.stored) / Math.max(1, b.stored);
  assert.ok(rel < 0.02, `Storage difference ${rel}`);
  assert.ok(
    Math.abs(a.maxDepth - b.maxDepth) / Math.max(0.001, b.maxDepth) < 0.05,
  );
  console.log("Timestep sensitivity:", rel);
});
test("invalid imports reject budget, model, coordinates, prototype keys and nonfinite values", () => {
  for (const p of [
    { intensity: NaN },
    { model: "unknown" },
    { duration: -1 },
    { interventions: [{ id: "a", type: "__proto__", x: 0, y: 0 }] },
    { interventions: [{ id: "a", type: "garden", x: 100, y: 20 }] },
    {
      interventions: Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        type: "basin",
        x: i,
        y: 0,
      })),
    },
  ])
    assert.throws(() => validate({ ...small, ...p }));
  assert.equal(validate(small).duration, 20);
});
test("roof cells redirect rainfall and stay dry", () => {
  const r = simulate(small);
  for (let i = 0; i < N * N; i++)
    if (DISTRICT.kind[i] === 4) assert.equal(r.peakDepth[i], 0);
});
