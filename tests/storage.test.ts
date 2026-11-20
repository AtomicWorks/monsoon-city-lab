import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import { DEFAULT, type Scenario } from "../src/engine";
import {
  UnreadableScenarioError,
  library,
  restore,
  save,
  writePlan,
  type SavedPlan,
} from "../src/storage";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

// Writes a record exactly as given, bypassing storage.ts validation, the way
// an older or newer release (or a damaged profile) could have left it.
async function putRaw(store: string, value: unknown, key?: string) {
  await save(DEFAULT, "setup"); // creates the object stores
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("monsoon", 2);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    if (key === undefined) tx.objectStore(store).put(value);
    else tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getRaw(key: string) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("monsoon", 2);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const value = await new Promise<unknown>((resolve, reject) => {
    const r = db.transaction("scenarios").objectStore("scenarios").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return value;
}

const plan = (id: string, scenario: unknown): SavedPlan => ({
  id,
  title: id,
  notes: "",
  updated: Date.now(),
  scenario: scenario as Scenario,
});

test("an unreadable autosave is kept in a backup record before restore reports it", async () => {
  const unreadable = { ...DEFAULT, model: "monsoon-9.9", name: "Future plan" };
  await putRaw("scenarios", unreadable, "current");
  const error = await restore().then(
    () => assert.fail("restore should reject an unreadable autosave"),
    (e: unknown) => e,
  );
  assert.ok(error instanceof UnreadableScenarioError);
  assert.deepEqual(await getRaw(error.backupKey), unreadable);
  // Later autosaves may replace "current"; the backup must survive them.
  await save(DEFAULT);
  assert.deepEqual(await getRaw(error.backupKey), unreadable);
});

test("restore still returns valid autosaves and null when nothing is saved", async () => {
  assert.equal(await restore(), null);
  await save({ ...DEFAULT, name: "Mine" });
  assert.equal((await restore())?.name, "Mine");
});

test("one unreadable saved plan does not hide the rest of the library", async () => {
  await writePlan(plan("good", DEFAULT));
  await putRaw(
    "library",
    plan("bad-layout", { ...DEFAULT, layout: { preset: "moon", edits: [] } }),
  );
  await putRaw("library", { id: "no-scenario" });
  const { plans, unreadable } = await library();
  assert.deepEqual(
    plans.map((p) => p.id),
    ["good"],
  );
  assert.equal(unreadable, 2);
});

test("repeated unreadable loads keep only the newest three backups", async () => {
  const backups: string[] = [];
  for (let n = 0; n < 5; n++) {
    await putRaw("scenarios", { ...DEFAULT, model: "monsoon-9.9", name: `v${n}` }, "current");
    await restore().catch((e: UnreadableScenarioError) => backups.push(e.backupKey));
    await new Promise((r) => setTimeout(r, 5)); // distinct timestamps
  }
  const kept = [];
  for (const key of backups) kept.push((await getRaw(key)) as Scenario | undefined);
  assert.deepEqual(
    kept.map((s) => s?.name),
    [undefined, undefined, "v2", "v3", "v4"],
  );
});
