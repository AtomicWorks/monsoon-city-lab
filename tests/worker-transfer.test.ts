import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT, resultBuffers, simulate, validate } from "../src/engine";

const short = validate({ ...DEFAULT, duration: 20, recovery: 0 });

test("result buffers can be transferred instead of copied", () => {
  const baseline = simulate(short),
    improved = simulate({
      ...short,
      interventions: [{ id: "g", type: "garden", x: 30, y: 30 }],
    });
  const transfer = resultBuffers(baseline, improved);
  const frame = baseline.frames[3];
  for (const view of [
    frame.depth,
    frame.soilUsed!,
    frame.draining!,
    baseline.peakDepth,
    improved.drainage,
  ])
    assert.ok(transfer.includes(view.buffer as ArrayBuffer));
  const copy = structuredClone({ baseline, improved }, { transfer });
  assert.equal(copy.baseline.frames.length, baseline.frames.length);
  assert.equal(frame.depth.byteLength, 0, "source should be detached");
});

test("a result sent as both baseline and design lists each buffer once", () => {
  const result = simulate(short);
  const transfer = resultBuffers(result, result);
  assert.equal(new Set(transfer).size, transfer.length);
  // Duplicate entries would make postMessage throw a DataCloneError.
  const copy = structuredClone(
    { baseline: result, improved: result },
    { transfer },
  );
  assert.equal(copy.baseline, copy.improved);
});
