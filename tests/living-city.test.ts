import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT,
  AREA,
  N,
  DISTRICT,
  simulate,
  hydraulicFields,
} from "../src/engine";
import {
  atmosphere,
  readQuality,
  resolveQuality,
  QUALITY,
} from "../src/graphics";
import { inspectCell } from "../src/insight";
import { cityDetails } from "../src/cityDetails";
import { InstancedMesh } from "three";
test("decorative architecture stays within allocated instance buffers", () => {
  const group = cityDetails();
  assert.ok(group.children.length > 0);
  group.traverse(o => {
    if (!(o instanceof InstancedMesh)) return;
    assert.ok(o.count > 0 && o.count <= o.instanceMatrix.count);
    assert.ok(Array.from(o.instanceMatrix.array).every(Number.isFinite));
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
});
test("quality fallback is bounded and explicit choices override device heuristics", () => {
  assert.equal(readQuality("corrupt"), "auto");
  assert.equal(resolveQuality("auto", 390, 16), "low");
  assert.equal(resolveQuality("auto", 1440, 4), "low");
  assert.equal(resolveQuality("auto", 1440, 8), "balanced");
  assert.equal(resolveQuality("high", 390, 2), "high");
  assert.equal(QUALITY.low.shadow, 0);
  assert.equal(QUALITY.low.splashes, 0);
});
test("atmosphere follows actual rain and reaches clearing after rainfall stops", () => {
  assert.equal(atmosphere(DEFAULT, 0, false).rain, 0);
  const peak = atmosphere(DEFAULT, 22, true),
    end = atmosphere(DEFAULT, 60, true),
    clear = atmosphere(DEFAULT, 110, true);
  assert.ok(peak.rain > 60);
  assert.equal(end.rain, 0);
  assert.equal(clear.rain, 0);
  assert.ok(clear.cloud < end.cloud && end.cloud < peak.cloud);
});
test("soil snapshots match cumulative infiltration without changing conservation", () => {
  const s = { ...DEFAULT, duration: 20, recovery: 10 };
  const result = simulate(s),
    last = result.frames.at(-1)!,
    fields = hydraulicFields(s);
  assert.ok(result.frames[0].soilUsed!.every((v) => v === 0));
  let sum = 0;
  for (let i = 0; i < N * N; i++) {
    assert.ok(
      last.soilUsed![i] >= 0 && last.soilUsed![i] <= fields.capacity[i] + 1e-6,
    );
    assert.ok(
      Math.abs(last.soilUsed![i] * AREA - result.infiltration[i]) < 0.001,
    );
    sum += last.soilUsed![i] * AREA;
  }
  assert.ok(Math.abs(sum - last.metrics.infiltrated) < 0.01);
  assert.ok(Math.abs(last.metrics.residual) < 1e-5);
  const index = Array.from(last.soilUsed!).findIndex((v) => v > 0.001);
  const first = inspectCell(s, result.frames[0], index),
    final = inspectCell(s, last, index);
  assert.ok(final.remaining! < first.remaining!);
  assert.equal(final.depth, last.depth[index]);
});
test("inspector uses modified terrain, roof receiving cells and effective soil limits", () => {
  const s = {
    ...DEFAULT,
    infiltrationFactor: 0,
    blockage: 100,
    interventions: [{ id: "g", type: "garden" as const, x: 59, y: 63 }],
  };
  const v = inspectCell(s, undefined, 63 * N + 59);
  assert.ok(Math.abs(v.elevation - (DISTRICT.z[v.i] - 0.12)) < 1e-10);
  assert.equal(v.capacity, 220);
  assert.equal(v.rate, 0);
  assert.equal(v.used, undefined);
  assert.ok(v.notes.some((n) => n.includes("blocked")));
  assert.equal(v.covered.length, 1);
  const roof = Array.from(DISTRICT.roof).findIndex((v) => v >= 0);
  assert.equal(inspectCell(s, undefined, roof).i, DISTRICT.roof[roof]);
  assert.ok(
    inspectCell({ ...s, outlet: 0 }, undefined, roof).notes.some((n) =>
      n.includes("outlet is closed"),
    ),
  );
});
