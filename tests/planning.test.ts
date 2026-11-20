import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT, cost, validate, simulate } from "../src/engine";
import {
  candidates,
  scenarioKey,
  stressScenarios,
  analyze,
  rank,
  reduction,
  summarize,
  contribution,
} from "../src/planning";
import { matchesMission, missionScenario } from "../src/impact";
const small = { ...DEFAULT, duration: 20, recovery: 0 };
test("bounded candidates are valid, unique, deterministic and within budget", () => {
  for (const budget of [12, 30, 60, 100]) {
    const plans = candidates(small, budget);
    assert.ok(plans.length <= 22);
    assert.equal(new Set(plans.map(scenarioKey)).size, plans.length);
    for (const p of plans) {
      validate(p);
      assert.ok(cost(p.interventions) <= budget);
    }
    assert.deepEqual(plans, candidates(small, budget));
  }
});
test("soil multiplier migrates old scenarios, conserves water and invalidates fixed missions", () => {
  const legacy = {
    ...small,
    model: "monsoon-1.1",
    infiltrationFactor: undefined,
  };
  assert.equal(validate(legacy).infiltrationFactor, 1);
  for (const v of [-1, 3, NaN, Infinity, "1"])
    assert.throws(() => validate({ ...small, infiltrationFactor: v }));
  const dry = simulate({ ...small, infiltrationFactor: 0 }),
    normal = simulate(small);
  assert.equal(dry.frames.at(-1)!.metrics.infiltrated, 0);
  assert.ok(normal.frames.at(-1)!.metrics.infiltrated > 0);
  assert.ok(Math.abs(dry.frames.at(-1)!.metrics.residual) < 1e-5);
  assert.equal(
    matchesMission({ ...missionScenario("clinic"), infiltrationFactor: 0.5 }),
    false,
  );
});
test("stress scenarios hold placements fixed and disclose unchanged capped conditions", () => {
  const s = {
    ...small,
    intensity: 160,
    blockage: 100,
    storm: "double" as const,
    interventions: candidates(small, 100).at(-1)!.interventions,
  };
  const rows = stressScenarios(s);
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((v) => v.changed),
    [false, false, true, false],
  );
  for (const row of rows) {
    validate(row.scenario);
    assert.deepEqual(row.scenario.interventions, s.interventions);
    assert.equal(row.scenario.duration, s.duration);
  }
});
test("search ranks measured results and cheapest target never claims an unmet solution", () => {
  const updates: number[] = [];
  const result = analyze(
    { kind: "search", scenario: small, budget: 30, objective: "flood" },
    (d, t) => updates.push(d / t),
  );
  assert.equal(updates.at(-1), 1);
  assert.ok(result.evaluated! > 1);
  const plans = result.alternatives!;
  assert.ok(plans.length <= 3);
  for (let i = 1; i < plans.length; i++)
    assert.ok(plans[i].summary.peakHa >= plans[i - 1].summary.peakHa);
  assert.equal(rank(plans, result.baseline, "cost", 101).length, 0);
  for (const p of rank(plans, result.baseline, "cost", 1))
    assert.ok(reduction(result.baseline, p.summary) >= 1);
});
test("comparison uses current conditions, and ablation values equal actual rerun differences", () => {
  const design = candidates(small, 30).find(
    (v) => v.interventions.length === 1,
  )!;
  const result = analyze(
    { kind: "compare", scenario: small, plans: [{ ...design, intensity: 0 }] },
    () => {},
  );
  assert.equal(result.alternatives![0].scenario.intensity, small.intensity);
  const full = summarize(simulate(design)),
    without = summarize(simulate(small));
  const expected = contribution(full, without, design.interventions[0]);
  const explanation = analyze({ kind: "explain", scenario: design }, () => {});
  assert.deepEqual(explanation.contributions![0], expected);
});
