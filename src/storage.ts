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
    const tx = db.transaction("scenarios");
    const r = tx.objectStore("scenarios").get(key);
    r.onsuccess = () => {
      db.close();
      try {
        resolve(r.result ? validate(r.result) : null);
      } catch (e) {
        reject(e);
      }
    };
    r.onerror = () => {
      db.close();
      reject(r.error);
    };
  });
}
export async function library(): Promise<SavedPlan[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("library"),
      r = tx.objectStore("library").getAll();
    r.onsuccess = () => {
      try {
        const plans = (r.result as SavedPlan[]).map((plan) => ({
          ...plan,
          title: currentScenarioName(plan.title),
          scenario: {
            ...plan.scenario,
            name: currentScenarioName(plan.scenario.name),
            layout: validateLayout(plan.scenario.layout),
          },
        }));
        resolve(plans.sort((a, b) => b.updated - a.updated));
      } catch (error) {
        reject(error);
      }
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
