import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT,
  MODEL,
  N,
  DISTRICT,
  districtFor,
  validate,
  paintLayout,
  baselineScenario,
  simulate,
  access,
  protectedLot,
  type Layout,
} from "../src/engine";
import { missionScenario, matchesMission } from "../src/impact";
import { mobility, createTraffic } from "../src/mobility";
import { candidates, scenarioKey, analyze } from "../src/planning";
import { encodeScenario, decodeScenario } from "../src/share";
import { cityDetails } from "../src/cityDetails";
import { InstancedMesh } from "three";

test("legacy scenarios keep the original district and custom maps cannot earn mission scores", () => {
  const old = validate({ ...DEFAULT, model: "monsoon-1.2" });
  assert.equal(old.model, MODEL);
  assert.equal(old.layout, undefined);
  assert.equal(districtFor(old.layout), DISTRICT);
  const s = {
    ...missionScenario("services"),
    layout: { preset: "shonar" as const, edits: [] },
  };
  assert.throws(() => validate(s), /Missions/);
  assert.equal(matchesMission(s), false);
});
test("presets preserve landmarks, roof receivers and bounded architecture instances", () => {
  for (const preset of ["dense", "green", "industrial"] as const) {
    const map = districtFor({ preset, edits: [] });
    assert.notDeepEqual(map.kind, DISTRICT.kind);
    map.kind.forEach((kind, i) => {
      if (protectedLot(Math.floor((i % N) / 10), Math.floor(i / (N * 10))))
        assert.equal(kind, DISTRICT.kind[i]);
      if (kind === 4) {
        assert.ok(map.roof[i] >= 0 && map.roof[i] < N * N);
        assert.notEqual(map.kind[map.roof[i]], 4);
      } else assert.equal(map.roof[i], -1);
    });
    const group = cityDetails(map);
    group.traverse((o) => {
      if (o instanceof InstancedMesh) {
        assert.ok(o.count <= o.instanceMatrix.count);
        assert.ok(Array.from(o.instanceMatrix.array).every(Number.isFinite));
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      }
    });
  }
});
test("brushes are immutable, protected and validated; baseline retains only the preset", () => {
  const s = validate({
      ...DEFAULT,
      layout: { preset: "industrial", edits: [] },
    }),
    edited = paintLayout(s, 5, 4, 0);
  assert.equal(s.layout!.edits.length, 0);
  assert.equal(edited.layout!.edits.length, 1);
  assert.equal(districtFor(edited.layout).kind[44 * N + 54], 0);
  assert.deepEqual(baselineScenario(edited).layout, s.layout);
  assert.throws(() => paintLayout(s, 6, 6, 0), /protects/);
  for (const layout of [
    { preset: "bad", edits: [] },
    { preset: "green", edits: [{ x: 10, y: 0, kind: 0 }] },
    { preset: "green", edits: [{ x: 1, y: 1, kind: 3 }] },
    {
      preset: "green",
      edits: [
        { x: 1, y: 1, kind: 0 },
        { x: 1, y: 1, kind: 1 },
      ],
    },
  ])
    assert.throws(() => validate({ ...DEFAULT, layout }));
  const withDrain = {
    ...s,
    interventions: [{ id: "drain", type: "drain" as const, x: 54, y: 44 }],
  };
  assert.throws(() => paintLayout(withDrain, 5, 4, 4), /intervention/);
});
test("routing and mobility caches use the actual layout and vehicles start on roads", () => {
  const edits: Layout["edits"] = Array.from({ length: 10 }, (_, x) => ({
    x,
    y: 0,
    kind: 5,
  }));
  const map = districtFor({ preset: "dense", edits }),
    depth = new Float32Array(N * N);
  assert.equal(access(depth, map), 0);
  assert.equal(access(depth, DISTRICT), 100);
  assert.notEqual(mobility(depth, map), mobility(depth, DISTRICT));
  assert.equal(mobility(depth, map).north[69 * N + 69], -1);
  for (const v of createTraffic(map)) assert.equal(map.kind[v.cell], 1);
});
test("layout share links round trip and legacy links remain readable", () => {
  const s = paintLayout({ ...DEFAULT, name: "সবুজ শহর" }, 5, 4, 0);
  assert.deepEqual(decodeScenario(encodeScenario(s)).layout, s.layout);
  const raw = [
    1,
    "monsoon-1.2",
    "Legacy",
    "burst",
    85,
    60,
    60,
    15,
    4,
    1,
    null,
    [],
  ];
  const old = btoa(JSON.stringify(raw))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  assert.equal(decodeScenario(old).layout, undefined);
  assert.notEqual(scenarioKey(s), scenarioKey({ ...s, layout: undefined }));
});
test("custom hydrology conserves rainfall and the first experiment increases absorption", () => {
  const s = validate({
    ...DEFAULT,
    name: "First green block",
    duration: 20,
    recovery: 30,
    layout: { preset: "industrial", edits: [] },
  });
  const edited = paintLayout(s, 5, 4, 0),
    a = simulate(baselineScenario(edited)),
    b = simulate(edited);
  for (const r of [a, b]) {
    const map = districtFor(r.scenario.layout);
    for (const f of r.frames) {
      assert.ok(Math.abs(f.metrics.residual) < 1e-5);
      assert.ok(f.depth.every((d) => Number.isFinite(d) && d >= 0));
    }
    map.roof.forEach((v, i) => {
      if (v >= 0) assert.equal(r.peakDepth[i], 0);
    });
  }
  const absorbed =
    b.frames.at(-1)!.metrics.infiltrated - a.frames.at(-1)!.metrics.infiltrated;
  assert.ok(absorbed > 0);
  console.log("First experiment extra absorption m3", absorbed);
});
test("planning preserves each saved layout and skips invalid intervention candidates", () => {
  const s = paintLayout({ ...DEFAULT, duration: 20, recovery: 0 }, 5, 6, 4);
  const choices = candidates(s, 100);
  assert.ok(choices.length > 0);
  choices.forEach((v) => validate(v));
  const plan = paintLayout(s, 5, 4, 0),
    result = analyze({ kind: "compare", scenario: s, plans: [plan] }, () => {});
  assert.deepEqual(result.alternatives![0].scenario.layout, plan.layout);
  assert.deepEqual(result.alternatives![0].scenario.storm, s.storm);
});
