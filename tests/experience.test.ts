import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT, simulate, validate, DISTRICT, N } from "../src/engine";
import { LANDMARKS, entrance } from "../src/impact";
import {
  stormEvents,
  replayChapters,
  resultStories,
  DEMOS,
  flowDirections,
  floodEdges,
} from "../src/experience";
import {
  encodeScenario,
  decodeScenario,
  scenarioFromHash,
  scenarioLink,
} from "../src/share";
test("shared links preserve Unicode, settings and placements without mutating the source", () => {
  for (const demo of DEMOS) {
    const s = { ...demo.scenario, name: "শহর / Rain & recovery" },
      before = JSON.stringify(s),
      v = decodeScenario(encodeScenario(s));
    assert.equal(v.name, s.name);
    assert.deepEqual(
      v.interventions.map(({ id, ...rest }) => rest),
      s.interventions.map(({ id, ...rest }) => rest),
    );
    assert.equal(v.storm, s.storm);
    assert.equal(v.recovery, s.recovery);
    assert.equal(v.blockage, s.blockage);
    assert.equal(JSON.stringify(s), before);
    assert.deepEqual(
      scenarioFromHash(
        new URL(scenarioLink(s, "https://example.com/?old=1")).hash,
      ),
      v,
    );
  }
});
test("malformed, oversized and unsupported share payloads are rejected", () => {
  for (const text of [
    "",
    "!",
    "a".repeat(6001),
    btoa("{}"),
    btoa(JSON.stringify([9])),
  ])
    assert.throws(() => decodeScenario(text));
  const p = JSON.parse(atob(encodeScenario(DEFAULT)));
  p[4] = 999;
  assert.throws(() =>
    decodeScenario(btoa(JSON.stringify(p)).replace(/=+$/, "")),
  );
  assert.equal(scenarioFromHash("#unrelated"), null);
});
test("events capture actual threshold and route changes, in chronological order", () => {
  const r = simulate({ ...DEFAULT, intensity: 0, duration: 20, recovery: 0 });
  const dry = stormEvents(r);
  assert.equal(
    dry.filter((e) => e.kind === "access" || e.kind === "flood").length,
    0,
  );
  r.frames[1].depth[entrance(LANDMARKS[0])] = 0.2;
  r.frames[1].metrics.flooded = 100;
  const events = stormEvents(r);
  assert.ok(
    events.some((e) => e.minute === 1 && e.title === "Clinic access is lost"),
  );
  assert.ok(
    events.some((e) => e.minute === 2 && e.title === "Clinic access returns"),
  );
  assert.ok(
    events.some((e) => e.minute === 1 && e.title === "Clinic entrance floods"),
  );
  assert.ok(
    events.some((e) => e.minute === 2 && e.title === "Clinic entrance clears"),
  );
  assert.ok(events.every((e, i) => !i || e.minute >= events[i - 1].minute));
  const chapters = replayChapters(events);
  assert.equal(chapters[0].minute, 0);
  assert.equal(chapters.at(-1)!.minute, 20);
  assert.equal(new Set(chapters.map((e) => e.id)).size, chapters.length);
  assert.ok(chapters.length <= 10);
  assert.ok(chapters.some((e) => e.title === "Clinic access is lost"));
  assert.ok(chapters.some((e) => e.title === "Clinic access returns"));
  const stories = resultStories(r, r);
  assert.ok(stories.every((s) => s.direction.startsWith("No ")));
});
test("recorded drainage activity reflects discharge and excludes blocked drains", () => {
  const wet = simulate({ ...DEFAULT, duration: 20, recovery: 0 }),
    blocked = simulate({
      ...DEFAULT,
      duration: 20,
      recovery: 0,
      blockage: 100,
    });
  assert.equal(wet.frames[0].draining?.length, 0);
  assert.ok(wet.frames.some((f) => f.draining!.length > 0));
  assert.ok(blocked.frames.every((f) => f.draining!.length === 0));
  for (const f of wet.frames)
    for (const i of f.draining!)
      assert.ok(i >= 0 && i < N * N && DISTRICT.kind[i] !== 4);
});
test("overlay arrows follow downhill head and flood boundaries match wet-cell edges", () => {
  const depth = new Float32Array(N * N).fill(0.05),
    z = Float64Array.from({ length: N * N }, (_, i) => 100 - (i % N));
  const arrows = flowDirections(depth, z);
  assert.ok(arrows.length > 0);
  assert.ok(
    arrows.every(
      (a) => a.dx === 1 && a.dy === 0 && DISTRICT.kind[a.y * N + a.x + 1] !== 4,
    ),
  );
  depth.fill(0);
  depth[5050] = 0.2;
  assert.equal(floodEdges(depth).length, 16);
  depth[5051] = 0.2;
  assert.equal(floodEdges(depth).length, 24);
  for (const d of DEMOS) validate(d.scenario);
});
