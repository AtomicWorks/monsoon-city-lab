import {
  cost,
  baselineScenario,
  simulate,
  validate,
  type Scenario,
  type Result,
  type Intervention,
} from "./engine";
import { LANDMARKS, landmarkSummary } from "./impact";
export type Objective = "flood" | "clinic" | "school" | "cost";
export const OBJECTIVES: Record<Objective, string> = {
  flood: "Reduce peak flooded area",
  clinic: "Reduce clinic access outage",
  school: "Reduce school entrance peak",
  cost: "Lowest cost meeting flood target",
};
export function summarize(r: Result) {
  return {
    peakHa: Math.max(...r.frames.map((f) => f.metrics.flooded)) / 10000,
    endStored: r.frames.at(-1)!.metrics.stored,
    landmarks: LANDMARKS.map((l) => landmarkSummary(r, l)),
    history: r.frames.map((f) => ({
      minute: f.metrics.time / 60,
      stored: f.metrics.stored,
    })),
    residual: r.frames.at(-1)!.metrics.residual,
  };
}
export type Summary = ReturnType<typeof summarize>;
export type PlanResult = { scenario: Scenario; summary: Summary };
export type StressRow = PlanResult & {
  label: string;
  changed: boolean;
  passed: boolean;
};
export type Contribution = {
  item: Intervention;
  floodHa: number;
  clinicMinutes: number;
  schoolCm: number;
};
export type Analysis = {
  baseline: Summary;
  current: Summary;
  alternatives?: PlanResult[];
  evaluated?: number;
  stress?: StressRow[];
  contributions?: Contribution[];
};
export type Job = {
  kind: "search" | "stress" | "explain" | "compare";
  scenario: Scenario;
  budget?: number;
  objective?: Objective;
  target?: number;
  plans?: Scenario[];
};
export function scenarioKey(s: Scenario) {
  const v = validate(s);
  return JSON.stringify([
    v.model,
    v.layout ?? null,
    v.storm,
    v.intensity,
    v.duration,
    v.recovery,
    v.blockage,
    v.outlet,
    v.infiltrationFactor,
    v.interventions
      .map(({ type, x, y }) => ({ type, x, y }))
      .sort((a, b) => a.x - b.x || a.y - b.y || a.type.localeCompare(b.type)),
  ]);
}
export function reduction(base: Summary, result: Summary) {
  return base.peakHa > 0
    ? ((base.peakHa - result.peakHa) / base.peakHa) * 100
    : 0;
}
export function candidates(s: Scenario, budget: number): Scenario[] {
  if (!Number.isFinite(budget) || budget < 0 || budget > 100)
    throw Error("Invalid search budget.");
  const item = (
    type: Intervention["type"],
    x: number,
    y: number,
  ): Intervention => ({ id: `search-${type}-${x}-${y}`, type, x, y });
  const b = item("basin", 59, 63),
    w = item("basin", 29, 35),
    d = item("drain", 64, 66),
    e = item("drain", 29, 39),
    g = item("garden", 59, 69),
    p = item("paving", 29, 29),
    m = item("drain", 74, 26),
    n = item("garden", 69, 29);
  const sets: Intervention[][] = [
    [],
    s.interventions,
    [b],
    [w],
    [d],
    [e],
    [g],
    [p],
    [m],
    [n],
    [b, d],
    [w, e],
    [g, p],
    [b, w],
    [b, w, d],
    [b, w, d, e],
    [b, d, item("drain", 66, 66), item("drain", 61, 66)],
    [w, e, g, p],
    [b, g, m, p],
    [w, n, m, e],
    [b, w, g, p],
    [d, e, m, p],
  ];
  const seen = new Set<string>();
  return sets
    .filter((v) => cost(v) <= budget)
    .flatMap((interventions) => {
      try {
        return [validate({ ...s, interventions })];
      } catch {
        return [];
      }
    })
    .filter((v) => {
      const key = scenarioKey(v);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function rank(
  plans: PlanResult[],
  base: Summary,
  objective: Objective,
  target: number,
) {
  const score = (p: PlanResult) =>
    objective === "flood"
      ? p.summary.peakHa
      : objective === "clinic"
        ? p.summary.landmarks[0].outageMinutes
        : objective === "school"
          ? p.summary.landmarks[1].peak
          : cost(p.scenario.interventions);
  return plans
    .filter((p) => objective !== "cost" || reduction(base, p.summary) >= target)
    .sort(
      (a, b) =>
        score(a) - score(b) ||
        cost(a.scenario.interventions) - cost(b.scenario.interventions) ||
        a.summary.peakHa - b.summary.peakHa,
    )
    .slice(0, 3);
}
export function stressScenarios(s: Scenario) {
  return [
    {
      label: "Heavier rain",
      scenario: validate({
        ...s,
        challenge: undefined,
        intensity: Math.min(160, s.intensity * 1.25),
      }),
    },
    {
      label: "Blocked drains",
      scenario: validate({
        ...s,
        challenge: undefined,
        blockage: Math.min(100, s.blockage + 25),
      }),
    },
    {
      label: "Lower absorption",
      scenario: validate({
        ...s,
        challenge: undefined,
        infiltrationFactor: (s.infiltrationFactor ?? 1) * 0.5,
      }),
    },
    {
      label: "Two storm peaks",
      scenario: validate({ ...s, challenge: undefined, storm: "double" }),
    },
  ].map((v) => ({ ...v, changed: scenarioKey(v.scenario) !== scenarioKey(s) }));
}
export function contribution(
  full: Summary,
  without: Summary,
  item: Intervention,
): Contribution {
  return {
    item,
    floodHa: without.peakHa - full.peakHa,
    clinicMinutes:
      without.landmarks[0].outageMinutes - full.landmarks[0].outageMinutes,
    schoolCm: (without.landmarks[1].peak - full.landmarks[1].peak) * 100,
  };
}
// Cache compact summaries, never hundreds of full 100x100 time series.
const cache = new Map<string, Summary>();
export function analyze(
  job: Job,
  progress: (done: number, total: number, label: string) => void,
): Analysis {
  const s = validate(job.scenario),
    base = baselineScenario(s);
  const run = (v: Scenario) => {
    const key = scenarioKey(v);
    let r = cache.get(key);
    if (!r) {
      r = summarize(simulate(v));
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(key, r);
    }
    return r;
  };
  const plans =
    job.kind === "search"
      ? candidates(s, job.budget ?? 100)
      : job.kind === "compare"
        ? (job.plans ?? []).map((p) =>
            validate({
              ...s,
              interventions: p.interventions,
              layout: p.layout,
              challenge: undefined,
              name: p.name,
            }),
          )
        : [];
  const stresses = job.kind === "stress" ? stressScenarios(s) : [];
  const total =
    2 +
    plans.length +
    stresses.length +
    (job.kind === "explain" ? s.interventions.length : 0);
  let done = 0;
  progress(done, total, "Unchanged district");
  const baseline = run(base);
  progress(++done, total, "Current design");
  const current = run(s);
  progress(++done, total, "Analyzing plans");
  const output: Analysis = { baseline, current };
  if (plans.length) {
    const evaluated = plans.map((scenario, i) => {
      const summary = run(scenario);
      progress(++done, total, `Plan ${i + 1} of ${plans.length}`);
      return { scenario, summary };
    });
    output.alternatives =
      job.kind === "search"
        ? rank(evaluated, baseline, job.objective ?? "flood", job.target ?? 5)
        : evaluated;
    output.evaluated = plans.length;
  }
  if (job.kind === "stress")
    output.stress = stresses.map((v) => {
      const summary = run(v.scenario);
      progress(++done, total, v.label);
      return {
        ...v,
        summary,
        passed:
          summary.landmarks[0].connectedAtEnd &&
          summary.landmarks[1].endDepth < 0.1 &&
          summary.landmarks[2].connectedAtEnd,
      };
    });
  if (job.kind === "explain")
    output.contributions = s.interventions.map((item) => {
      const without = run({
        ...s,
        interventions: s.interventions.filter((i) => i.id !== item.id),
      });
      progress(++done, total, `Without ${item.type}`);
      return contribution(current, without, item);
    });
  return output;
}
