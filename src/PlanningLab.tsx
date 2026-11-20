import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookmarkPlus,
  FlaskConical,
  Layers,
  Search,
  ShieldCheck,
  X,
  Printer,
} from "lucide-react";
import {
  MODEL,
  TOOLS,
  cost,
  baselineScenario,
  validate,
  type Scenario,
  type Result,
} from "./engine";
import {
  OBJECTIVES,
  summarize,
  reduction,
  type Objective,
  type Analysis,
  type Job,
  type Summary,
  type PlanResult,
} from "./planning";
import { library, writePlan, deletePlan, type SavedPlan } from "./storage";
import PlanMap from "./PlanMap";
import { ContextHelp } from "./Help";
type Props = {
  s: Scenario;
  results: { baseline: Result; improved: Result } | null;
  apply: (s: Scenario) => void;
  close: () => void;
};
const number = (v: number, d = 1) =>
  v.toLocaleString("en", { maximumFractionDigits: d });
function Metrics({ summary }: { summary: Summary }) {
  return (
    <div className="plan-metrics">
      <span>
        <b>{number(summary.peakHa)}</b> ha peak flood
      </span>
      <span>
        <b>{summary.landmarks[0].outageMinutes}</b> min clinic outage
      </span>
      <span>
        <b>{number(summary.landmarks[1].peak * 100)}</b> cm school peak
      </span>
    </div>
  );
}
function Comparison({ base, plans }: { base: Summary; plans: PlanResult[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption>Same storm, drainage, soil and recovery window</caption>
        <thead>
          <tr>
            <th>Design</th>
            <th>Credits</th>
            <th>Peak flood</th>
            <th>Reduction</th>
            <th>Clinic outage</th>
            <th>School peak</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Unchanged district</th>
            <td>0</td>
            <td>{number(base.peakHa)} ha</td>
            <td>—</td>
            <td>{base.landmarks[0].outageMinutes} min</td>
            <td>{number(base.landmarks[1].peak * 100)} cm</td>
          </tr>
          {plans.map((p, i) => (
            <tr key={i}>
              <th>{p.scenario.name}</th>
              <td>{cost(p.scenario.interventions)}</td>
              <td>{number(p.summary.peakHa)} ha</td>
              <td>{number(reduction(base, p.summary))}%</td>
              <td>{p.summary.landmarks[0].outageMinutes} min</td>
              <td>{number(p.summary.landmarks[1].peak * 100)} cm</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function PlanningLab({ s, results, apply, close }: Props) {
  const [tab, setTab] = useState<
      "library" | "search" | "stress" | "explain" | "report"
    >("library"),
    [plans, setPlans] = useState<SavedPlan[]>([]),
    [selection, setSelection] = useState<string[]>([]),
    [title, setTitle] = useState("My resilience plan"),
    [notes, setNotes] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [pendingDelete, setPendingDelete] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [budget, setBudget] = useState(100),
    [objective, setObjective] = useState<Objective>("flood"),
    [target, setTarget] = useState(5),
    [progress, setProgress] = useState<{
      done: number;
      total: number;
      label: string;
    } | null>(null),
    [analyses, setAnalyses] = useState<Partial<Record<Job["kind"], Analysis>>>(
      {},
    ),
    [preview, setPreview] = useState<Scenario | null>(null),
    [lastSearch, setLastSearch] = useState("");
  const worker = useRef<Worker | null>(null),
    dialog = useRef<HTMLDialogElement>(null),
    previewPanel = useRef<HTMLElement>(null),
    deleted = useRef<SavedPlan | null>(null);
  const current = useMemo(
    () => (results ? summarize(results.improved) : undefined),
    [results],
  );
  useEffect(() => {
    dialog.current?.showModal();
    refresh();
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    if (preview) previewPanel.current?.focus();
  }, [preview]);
  async function refresh() {
    try {
      const { plans, unreadable } = await library();
      setPlans(plans);
      if (unreadable)
        setMessage(
          `${unreadable} saved ${unreadable === 1 ? "plan" : "plans"} could not be opened by this version and ${unreadable === 1 ? "is" : "are"} hidden. ${unreadable === 1 ? "It remains" : "They remain"} stored on this device.`,
        );
    } catch {
      setMessage(
        "Local storage is unavailable. Saving and applying plans is disabled until storage works.",
      );
    }
  }
  async function saveCurrent() {
    try {
      if (!title.trim()) throw Error("Give the plan a name.");
      const old = plans.find((p) => p.id === editing);
      await writePlan({
        id: old?.id ?? crypto.randomUUID(),
        title: title.trim(),
        notes,
        updated: Date.now(),
        scenario: old?.scenario ?? structuredClone(s),
        summary: old ? old.summary : current,
      });
      setEditing(null);
      setMessage(
        old ? "Name and notes updated." : "Plan saved on this device.",
      );
      await refresh();
    } catch (e) {
      setMessage(String(e));
    }
  }
  async function duplicate(p: SavedPlan) {
    try {
      await writePlan({
        ...p,
        id: crypto.randomUUID(),
        title: `${p.title} copy`.slice(0, 80),
        updated: Date.now(),
      });
      await refresh();
      setMessage("Copy saved.");
    } catch {
      setMessage("Could not save the copy.");
    }
  }
  async function remove(p: SavedPlan) {
    try {
      await deletePlan(p.id);
      deleted.current = p;
      setSelection((v) => v.filter((id) => id !== p.id));
      setPendingDelete(null);
      await refresh();
      setMessage("Plan deleted. You can undo this deletion.");
    } catch {
      setMessage("Could not delete the plan.");
    }
  }
  async function undoDelete() {
    if (!deleted.current) return;
    try {
      await writePlan(deleted.current);
      deleted.current = null;
      await refresh();
      setMessage("Plan restored.");
    } catch {
      setMessage("Could not restore the plan.");
    }
  }
  async function usePlan(value: Scenario) {
    try {
      const v = validate(value);
      await writePlan({
        id: crypto.randomUUID(),
        title: `Before ${v.name}`.slice(0, 80),
        notes: "Automatically saved before applying another plan.",
        updated: Date.now(),
        scenario: structuredClone(s),
        summary: current,
      });
      apply(v);
      close();
    } catch (e) {
      setMessage(`Your current design was kept. ${String(e)}`);
    }
  }
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    setProgress(null);
    setMessage("Analysis cancelled. Previous completed results are retained.");
  }
  function run(kind: Job["kind"]) {
    worker.current?.terminate();
    setMessage("");
    setProgress({ done: 0, total: 1, label: "Starting analysis" });
    const w = new Worker(new URL("./planning-worker.ts", import.meta.url), {
      type: "module",
    });
    // A fresh worker makes cancellation immediate; the worker reuses summaries within this analysis.
    worker.current = w;
    const searchDescription = `${OBJECTIVES[objective]} · ${budget} credits maximum${objective === "cost" ? ` · ${target}% target` : ""}`;
    w.onmessage = (e) => {
      if (e.data.type === "progress") setProgress(e.data);
      if (e.data.type === "error") {
        setMessage(e.data.message);
        setProgress(null);
        w.terminate();
        worker.current = null;
      }
      if (e.data.type === "done") {
        if (kind === "search") setLastSearch(searchDescription);
        setAnalyses((v) => ({ ...v, [kind]: e.data.result }));
        setProgress(null);
        setMessage("Analysis complete.");
        w.terminate();
        worker.current = null;
      }
    };
    w.onerror = () => {
      setMessage("Analysis could not finish. Try again.");
      setProgress(null);
      w.terminate();
      worker.current = null;
    };
    w.postMessage({
      kind,
      scenario: s,
      budget,
      objective,
      target,
      plans: plans
        .filter((p) => selection.includes(p.id))
        .map((p) => ({ ...p.scenario, name: p.title })),
    } satisfies Job);
  }
  const stress = analyses.stress?.stress,
    explanation = analyses.explain?.contributions;
  const resultBase = useMemo(
    () => (results ? summarize(results.baseline) : undefined),
    [results],
  );
  const reportBase =
    resultBase ??
    analyses.stress?.baseline ??
    analyses.search?.baseline ??
    analyses.explain?.baseline;
  const reportCurrent =
    current ??
    analyses.stress?.current ??
    analyses.search?.current ??
    analyses.explain?.current;
  return (
    <dialog
      ref={dialog}
      className="planning-dialog"
      onCancel={close}
      aria-label="Planning laboratory"
    >
      <div className="planning-top no-print">
        <span className="eyebrow">MONSOON / RELEASE 08</span>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close planning lab"
        >
          <X />
        </button>
      </div>
      <div className="planning-heading">
        <div>
          <span className="eyebrow">EVIDENCE BEFORE INVESTMENT</span>
          <h2>
            Find a better plan<span>.</span>
          </h2>
          <p>Save an idea. Test its limits. Understand what changes.</p>
        </div>
        <span className="lab-badge">
          <FlaskConical size={18} /> Planning laboratory
        </span>
      </div>
      <nav className="planning-tabs no-print" aria-label="Planning tools">
        {(
          [
            ["library", Layers, "Plan library"],
            ["search", Search, "Find plans"],
            ["stress", ShieldCheck, "Stress test"],
            ["explain", FlaskConical, "Contributions"],
            ["report", Printer, "Print report"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setPreview(null);
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>
      <div className="no-print">
        <ContextHelp
          key={tab}
          id={
            tab === "library"
              ? "library"
              : tab === "search"
                ? "search"
                : tab === "stress"
                  ? "stress"
                  : tab === "explain"
                    ? "contributions"
                    : "report"
          }
        />
      </div>
      {message && (
        <div role="status" className="lab-message no-print">
          {message}
          {deleted.current && <button onClick={undoDelete}>Undo delete</button>}
        </div>
      )}
      {progress && (
        <div className="analysis-progress no-print" role="status">
          <div>
            <span>{progress.label}</span>
            <b>
              {progress.done} / {progress.total}
            </b>
            <button onClick={cancel}>Cancel analysis</button>
          </div>
          <progress value={progress.done} max={progress.total} />
          <small>
            Deterministic simulations run in a background worker. Longer
            recovery windows take longer.
          </small>
        </div>
      )}
      {tab === "library" && (
        <section className="lab-section">
          <div className="lab-intro">
            <h3>Your ideas, kept together.</h3>
            <p>
              Plans and completed summaries stay in this browser. Compare up to
              three saved designs using the current weather, soil and drainage
              settings.
            </p>
          </div>
          <form
            className="save-plan"
            onSubmit={(e) => {
              e.preventDefault();
              saveCurrent();
            }}
          >
            <label>
              Plan name
              <input
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label>
              Notes
              <input
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What is this design trying to protect?"
              />
            </label>
            <button className="run" type="submit">
              <BookmarkPlus size={16} />
              {editing ? "Save name & notes" : "Save current design"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setTitle("My resilience plan");
                  setNotes("");
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
          {plans.length === 0 ? (
            <div className="lab-empty">
              <Layers size={28} />
              <h3>A place for your first idea.</h3>
              <p>
                Save the current design, then explore alternatives without
                losing it.
              </p>
            </div>
          ) : (
            <>
              <div className="lab-actions">
                <span>
                  {plans.length} saved · {selection.length} selected
                </span>
                <button
                  className="run"
                  disabled={!selection.length || !!progress}
                  onClick={() => run("compare")}
                >
                  Compare selected in current weather
                </button>
              </div>
              <div className="plan-grid">
                {plans.map((p) => (
                  <article className="plan-card" key={p.id}>
                    <PlanMap s={p.scenario} />
                    <div className="plan-card-body">
                      <label className="plan-select">
                        <input
                          type="checkbox"
                          checked={selection.includes(p.id)}
                          disabled={
                            !selection.includes(p.id) && selection.length >= 3
                          }
                          onChange={(e) =>
                            setSelection((v) =>
                              e.target.checked
                                ? [...v, p.id]
                                : v.filter((id) => id !== p.id),
                            )
                          }
                        />
                        <strong>{p.title}</strong>
                      </label>
                      <p>{p.notes || "No notes yet."}</p>
                      <small>
                        {cost(p.scenario.interventions)} credits ·{" "}
                        {p.scenario.storm} / {p.scenario.intensity} mm/h ·{" "}
                        {new Date(p.updated).toLocaleDateString()}
                      </small>
                      {p.summary && p.scenario.model === MODEL && (
                        <p>
                          Saved result: {number(p.summary.peakHa)} ha peak flood
                        </p>
                      )}
                      <div className="card-actions">
                        <button
                          onClick={() =>
                            setPreview({
                              ...validate(p.scenario),
                              name: p.title,
                            })
                          }
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setEditing(p.id);
                            setTitle(p.title);
                            setNotes(p.notes);
                          }}
                        >
                          Rename / notes
                        </button>
                        <button onClick={() => duplicate(p)}>Duplicate</button>
                        <button onClick={() => setPendingDelete(p.id)}>
                          Delete
                        </button>
                      </div>
                      {pendingDelete === p.id && (
                        <div className="delete-confirm">
                          Delete “{p.title}”?{" "}
                          <button onClick={() => remove(p)}>
                            Delete this plan
                          </button>
                          <button onClick={() => setPendingDelete(null)}>
                            Keep
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {analyses.compare?.alternatives && (
            <Comparison
              base={analyses.compare.baseline}
              plans={analyses.compare.alternatives}
            />
          )}
        </section>
      )}
      {tab === "search" && (
        <section className="lab-section">
          <div className="lab-intro">
            <h3>A shortlist. With the tradeoffs visible.</h3>
            <p>
              Search up to 22 reproducible portfolios around the district’s
              lowlands and landmarks, including eligible current and empty
              designs. These are the best plans found in this bounded set, not a
              global optimum.
            </p>
          </div>
          <div className="search-controls">
            <label>
              What matters most?
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as Objective)}
              >
                {Object.entries(OBJECTIVES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Budget · {budget} credits
              <input
                type="range"
                min="12"
                max="100"
                value={budget}
                onChange={(e) => setBudget(+e.target.value)}
              />
            </label>
            {objective === "cost" && (
              <label>
                Peak flood reduction target · {target}%
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={target}
                  onChange={(e) => setTarget(+e.target.value)}
                />
              </label>
            )}
            <button
              className="run"
              disabled={!!progress}
              onClick={() => run("search")}
            >
              <Search size={16} />
              Find plans
            </button>
          </div>
          {analyses.search && (
            <>
              <p className="eyebrow">
                {lastSearch} · {analyses.search.evaluated} portfolios evaluated
              </p>
              {analyses.search.alternatives?.length ? (
                <>
                  <Comparison
                    base={analyses.search.baseline}
                    plans={analyses.search.alternatives.map((p, i) => ({
                      ...p,
                      scenario: { ...p.scenario, name: `Option ${i + 1}` },
                    }))}
                  />
                  <div className="plan-grid">
                    {analyses.search.alternatives.map((p, i) => (
                      <article className="plan-card" key={i}>
                        <PlanMap s={p.scenario} />
                        <div className="plan-card-body">
                          <span className="eyebrow">BEST FOUND / 0{i + 1}</span>
                          <h3>{cost(p.scenario.interventions)} credits</h3>
                          <Metrics summary={p.summary} />
                          <button
                            className="run"
                            onClick={() =>
                              setPreview({
                                ...p.scenario,
                                name: `Search option ${i + 1}`,
                              })
                            }
                          >
                            Preview placements <ArrowUpRight size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="lab-empty">
                  No tested plan met the target within this budget. Try a larger
                  budget or a lower target.
                </div>
              )}
            </>
          )}
        </section>
      )}
      {tab === "stress" && (
        <section className="lab-section">
          <div className="lab-intro">
            <h3>Good once. Resilient across conditions?</h3>
            <p>
              Hold every intervention fixed. Change one condition at a time: 25%
              heavier rain (capped at 160 mm/h), +25 percentage points drain
              blockage (capped at 100%), half the soil absorption rate, or a
              double-peak rainfall profile.
            </p>
          </div>
          <button
            className="run"
            disabled={!!progress}
            onClick={() => run("stress")}
          >
            Run four stress scenarios
          </button>
          <p className="lab-rule">
            Pass rule at the end of recovery: clinic and market have road
            access, and school entrance depth is below 10 cm. This illustrative
            threshold is not a safety certification.
          </p>
          {stress && (
            <>
              <div className="stress-score">
                <b>
                  {stress.filter((v) => v.passed).length}
                  <span> / 4</span>
                </b>
                <div>
                  scenarios meet the rule
                  <p>
                    A count across these scenarios, not a probability of safety.
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Rain / blockage / soil</th>
                      <th>Peak flood</th>
                      <th>Clinic access</th>
                      <th>School at end</th>
                      <th>Market access</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stress.map((v) => (
                      <tr key={v.label}>
                        <th>
                          {v.label}
                          {!v.changed && (
                            <small>Same as current conditions</small>
                          )}
                        </th>
                        <td>
                          {number(v.scenario.intensity)} mm/h ·{" "}
                          {v.scenario.blockage}% ·{" "}
                          {v.scenario.infiltrationFactor}×
                        </td>
                        <td>{number(v.summary.peakHa)} ha</td>
                        <td>
                          {v.summary.landmarks[0].connectedAtEnd
                            ? "Connected"
                            : "Blocked"}
                        </td>
                        <td>
                          {number(v.summary.landmarks[1].endDepth * 100)} cm
                        </td>
                        <td>
                          {v.summary.landmarks[2].connectedAtEnd
                            ? "Connected"
                            : "Blocked"}
                        </td>
                        <td>
                          <span
                            className={v.passed ? "outcome pass" : "outcome"}
                          >
                            {v.passed ? "Meets rule" : "Misses rule"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
      {tab === "explain" && (
        <section className="lab-section">
          <div className="lab-intro">
            <h3>What is each intervention doing?</h3>
            <p>
              Remove one intervention, rerun the same storm, and measure the
              difference. Positive values below mean the full design performs
              better than the design with that intervention removed. Effects
              depend on the other interventions and cannot be added together.
            </p>
          </div>
          <button
            className="run"
            disabled={!!progress || !s.interventions.length}
            onClick={() => run("explain")}
          >
            Calculate contributions
          </button>
          {!s.interventions.length && (
            <p>Add interventions to calculate their contributions.</p>
          )}
          {explanation && <ContributionTable rows={explanation} />}
        </section>
      )}
      {preview && (
        <section
          ref={previewPanel}
          tabIndex={-1}
          className="plan-preview no-print"
          aria-label="Placement preview"
        >
          <PlanMap s={preview} />
          <div>
            <span className="eyebrow">PLACEMENT PREVIEW</span>
            <h3>{preview.name}</h3>
            <p>
              {cost(preview.interventions)} credits · {preview.storm} storm ·{" "}
              {preview.intensity} mm/h · absorption{" "}
              {preview.infiltrationFactor ?? 1}×
            </p>
            <ul>
              {preview.interventions.map((i) => (
                <li key={i.id}>
                  {TOOLS[i.type].name} at ({i.x}, {i.y})
                </li>
              ))}
            </ul>
            {!preview.interventions.length && (
              <p>This option has no interventions.</p>
            )}
            <p>
              Your current design will be saved in the library before this plan
              is applied and simulated.
            </p>
            <button
              className="run"
              disabled={!!progress}
              onClick={() => usePlan(preview)}
            >
              Apply this plan
            </button>
            <button onClick={() => setPreview(null)}>Dismiss preview</button>
          </div>
        </section>
      )}
      {tab === "report" && (
        <section className="lab-section printable-report">
          <div className="no-print lab-actions">
            <p>
              Print or save as PDF using your browser. Run stress tests and
              contributions first to include those sections.
            </p>
            <button
              className="run"
              disabled={!reportCurrent || !reportBase}
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print / save PDF
            </button>
          </div>
          {reportCurrent && reportBase ? (
            <>
              <h3>{s.name} / resilience report</h3>
              <p>
                Model {MODEL} · {new Date().toLocaleDateString()} · {s.storm}{" "}
                storm · {s.intensity} mm/h · rain {s.duration} min + recovery{" "}
                {s.recovery ?? 0} min · blockage {s.blockage}% · outlet{" "}
                {s.outlet} m³/s · soil {s.infiltrationFactor ?? 1}×
              </p>
              <div className="report-maps">
                <figure>
                  <PlanMap s={baselineScenario(s)} />
                  <figcaption>Baseline / placement diagram</figcaption>
                </figure>
                <figure>
                  <PlanMap s={s} />
                  <figcaption>
                    Design / {cost(s.interventions)} credits
                  </figcaption>
                </figure>
              </div>
              <Comparison
                base={reportBase}
                plans={[{ scenario: s, summary: reportCurrent }]}
              />
              <StorageChart a={reportBase} b={reportCurrent} />
              <p>
                Surface water storage over time · gray baseline / green design ·
                end at {s.duration + (s.recovery ?? 0)} minutes.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Landmark</th>
                      <th>Peak depth</th>
                      <th>Outage</th>
                      <th>Connected at end</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportCurrent.landmarks.map((l) => (
                      <tr key={l.id}>
                        <th>{l.name}</th>
                        <td>{number(l.peak * 100)} cm</td>
                        <td>{l.outageMinutes} min</td>
                        <td>{l.connectedAtEnd ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Stress scenarios</h3>
              {stress ? (
                <ul>
                  {stress.map((v) => (
                    <li key={v.label}>
                      {v.label}: {number(v.summary.peakHa)} ha peak flood ·{" "}
                      {v.passed ? "meets" : "misses"} rule
                      {!v.changed ? " (same as current conditions)" : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Not run for this report.</p>
              )}
              <p>
                Stress pass rule: clinic and market connected at run end, school
                entrance below 10 cm. Scenario pass counts are not
                probabilities.
              </p>
              <h3>Conditional contributions</h3>
              {explanation ? (
                <ContributionTable rows={explanation} />
              ) : (
                <p>Not run for this report.</p>
              )}
              <p>
                Positive contributions measure the benefit of keeping one
                intervention, with all others fixed. They are not additive.
              </p>
              <p className="credits">
                Fictional district. Uncalibrated educational model. 100 × 100
                cells, 10 m each; closed edges, finite soil storage, shared
                outlet capacity. Flood threshold 10 cm; road disruption 15 cm.
                No sewer backflow, tides, evaporation or groundwater. Identical
                dry initial conditions for each run. Costs are fictional
                credits. Original procedural district · Asifur Rahman Bhuiyan.
              </p>
            </>
          ) : (
            <div className="lab-empty">
              Run the current scenario or a planning analysis to prepare the
              report.
            </div>
          )}
        </section>
      )}
      <footer className="lab-footer">
        {MODEL} · Fictional district / real comparisons{" "}
        <span>Local storage · no account required for saved plans</span>
      </footer>
    </dialog>
  );
}
function ContributionTable({
  rows,
}: {
  rows: NonNullable<Analysis["contributions"]>;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Intervention removed</th>
            <th>Extra peak flood</th>
            <th>Extra clinic outage</th>
            <th>Extra school peak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.item.id}>
              <th>
                {TOOLS[v.item.type].name} ({v.item.x}, {v.item.y})
              </th>
              <td>{number(v.floodHa, 2)} ha</td>
              <td>{v.clinicMinutes} min</td>
              <td>{number(v.schoolCm, 2)} cm</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function StorageChart({ a, b }: { a: Summary; b: Summary }) {
  const max = Math.max(
    1,
    ...a.history.map((v) => v.stored),
    ...b.history.map((v) => v.stored),
  );
  const path = (s: Summary) =>
    s.history
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${(i / (s.history.length - 1)) * 600} ${110 - (v.stored / max) * 100}`,
      )
      .join(" ");
  return (
    <svg
      className="history"
      viewBox="0 0 600 130"
      role="img"
      aria-label="Surface water storage over time, gray baseline and green design"
    >
      <path
        d="M0 110H600M0 60H600M0 10H600"
        stroke="#69786c"
        strokeDasharray="3 6"
      />
      <path d={path(a)} fill="none" stroke="#8b9690" strokeWidth="2" />
      <path d={path(b)} fill="none" stroke="#80ad4b" strokeWidth="3" />
      <text x="0" y="128" fill="currentColor" fontSize="10">
        0 min
      </text>
      <text x="540" y="128" fill="currentColor" fontSize="10">
        {b.history.at(-1)!.minute} min
      </text>
    </svg>
  );
}
