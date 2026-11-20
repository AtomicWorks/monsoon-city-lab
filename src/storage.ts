import {
  currentScenarioName,
  validate,
  validateLayout,
  type Scenario,
} from "./engine";
import type { Summary } from "./planning";
export type SavedPlan = {
  id: string;
  title: string;
  notes: string;
  updated: number;
  scenario: Scenario;
  summary?: Summary;
};
// A stored scenario this release cannot read. The original record has been
// copied to `backupKey` in the "scenarios" store so later saves cannot lose it.
export class UnreadableScenarioError extends Error {
  constructor(
    readonly backupKey: string,
    readonly reason: string,
  ) {
    super(
      "Your saved plan could not be opened by this version. A copy was kept on this device.",
    );
  }
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("monsoon", 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("scenarios"))
        r.result.createObjectStore("scenarios");
      if (!r.result.objectStoreNames.contains("library"))
        r.result.createObjectStore("library", { keyPath: "id" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function save(s: Scenario, key = "current") {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("scenarios", "readwrite");
    tx.objectStore("scenarios").put(s, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function restore(key = "current"): Promise<Scenario | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("scenarios", "readwrite"),
      store = tx.objectStore("scenarios"),
      r = store.get(key);
    let result: Scenario | null = null,
      failure: unknown = null;
    r.onsuccess = () => {
      if (!r.result) return;
      try {
        result = validate(r.result);
      } catch (e) {
        // Copy the record aside in the same transaction, so the error is only
        // reported once the backup exists.
        const backupKey = `unreadable-${key}-${Date.now()}`;
        store.put(r.result, backupKey);
        failure = new UnreadableScenarioError(
          backupKey,
          e instanceof Error ? e.message : String(e),
        );
      }
    };
    tx.oncomplete = () => {
      db.close();
      if (failure) reject(failure);
      else resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
// Unreadable records stay in the database untouched; they are counted, not
// listed, so one damaged plan cannot hide the others.
export async function library(): Promise<{
  plans: SavedPlan[];
  unreadable: number;
}> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("library"),
      r = tx.objectStore("library").getAll();
    r.onsuccess = () => {
      const plans: SavedPlan[] = [];
      let unreadable = 0;
      for (const plan of r.result as SavedPlan[]) {
        try {
          plans.push({
            ...plan,
            title: currentScenarioName(plan.title),
            scenario: {
              ...plan.scenario,
              name: currentScenarioName(plan.scenario.name),
              layout: validateLayout(plan.scenario.layout),
            },
          });
        } catch {
          unreadable++;
        }
      }
      resolve({ plans: plans.sort((a, b) => b.updated - a.updated), unreadable });
    };
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writePlan(plan: SavedPlan) {
  validate(plan.scenario);
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("library", "readwrite");
    tx.objectStore("library").put(plan);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function deletePlan(id: string) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("library", "readwrite");
    tx.objectStore("library").delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
