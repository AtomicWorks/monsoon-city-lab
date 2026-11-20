import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Pause,
  Play,
  X,
} from "lucide-react";
import { cost, type Result, type Scenario } from "./engine";
import { DEMOS, resultStories, type StormEvent } from "./experience";
import { scenarioLink } from "./share";
import PlanMap from "./PlanMap";
import { ContextHelp } from "./Help";
type Props = {
  s: Scenario;
  results: { baseline: Result; improved: Result } | null;
  events: StormEvent[];
  minute: number;
  jump: (e: StormEvent) => void;
  replay: () => void;
  load: (s: Scenario) => Promise<void>;
  busy: boolean;
};
export default function ExperiencePanel({
  s,
  results,
  events,
  minute,
  jump,
  replay,
  load,
  busy,
}: Props) {
  const [tab, setTab] = useState("events"),
    [filter, setFilter] = useState("all"),
    [preview, setPreview] = useState<Scenario | null>(null),
    [copy, setCopy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    [loading, setLoading] = useState(false);
  const link = scenarioLink(s, location.origin + location.pathname);
  const previewRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (preview && tab === "demos") previewRef.current?.focus();
  }, [preview, tab]);
  useEffect(() => setCopy(false), [link]);
  async function apply() {
    if (!preview) return;
    setLoading(true);
    setError("");
    try {
      await load(preview);
      setPreview(null);
      setTab("events");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not preserve the current plan.",
      );
    } finally {
      setLoading(false);
    }
  }
  const visible = events.filter((e) => filter === "all" || e.kind === filter);
  return (
    <div className="experience-panel">
      <span className="release-kicker">
        <Clapperboard size={15} /> RELEASE 08 / SHAPE THE CITY
      </span>
      <h2 className="mission-heading">
        Every storm
        <br />
        has a story.
      </h2>
      <p className="side-intro">
        Follow the turning points. See what your decisions changed.
      </p>
      <div className="experience-tabs" aria-label="Replay tools">
        {[
          ["events", "Events"],
          ["stories", "Impact"],
          ["demos", "Demos"],
          ["share", "Share"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "events" && (
        <>
          <button
            className="run replay-start"
            disabled={!results || busy}
            onClick={replay}
          >
            <Play size={15} />
            Watch the storm <ArrowRight size={15} />
          </button>
          <ContextHelp id="replay" />
          {!results ? (
            <p className="empty">
              Run the current design to reveal its events. Changed designs need
              a new run.
            </p>
          ) : (
            <>
              <label className="event-filter">
                Show events
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All events</option>
                  <option value="access">Landmark access</option>
                  <option value="flood">Flooding</option>
                  <option value="weather">Weather</option>
                  <option value="recovery">Recovery</option>
                </select>
              </label>
              <p className="event-note">
                Your design · {visible.length} events · sampled every minute.
                Click an event to jump to its time and location.
              </p>
              <div className="event-list">
                {visible.map((e) => (
                  <button
                    key={e.id}
                    className={e.minute === minute ? "event active" : "event"}
                    onClick={() => jump(e)}
                  >
                    <span className="event-time">
                      {e.minute}
                      <small>MIN</small>
                    </span>
                    <span>
                      <b>{e.title}</b>
                      <small>{e.detail}</small>
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
              {!visible.length && (
                <p>No events of this type occurred in this run.</p>
              )}
            </>
          )}
        </>
      )}
      {tab === "stories" && (
        <>
          <ContextHelp id="stories" />
          {results ? (
            resultStories(results.baseline, results.improved).map((v) => (
              <article
                className={v.good ? "story-card" : "story-card caution"}
                key={v.label}
              >
                <span className="eyebrow">{v.label}</span>
                <strong>{v.value}</strong>
                <h3>{v.direction}</h3>
                <p>{v.text}</p>
              </article>
            ))
          ) : (
            <p className="empty">
              Run this plan to see measured comparisons with the unchanged
              district.
            </p>
          )}
          <p className="event-note">
            Identical storm, soil and drainage settings. These stories describe
            this fictional model, not real-world predictions.
          </p>
        </>
      )}
      {tab === "demos" && (
        <>
          <p className="side-intro">
            Start with an experiment. Each demo previews its placements and
            settings before you load it.
          </p>
          {DEMOS.map((d) => (
            <button
              className="demo-card"
              key={d.id}
              onClick={() => {
                setPreview(d.scenario);
                setError("");
              }}
            >
              <span className="eyebrow">{d.tag}</span>
              <h3>{d.title}</h3>
              <p>{d.description}</p>
              <span>
                Preview experiment <ArrowRight size={14} />
              </span>
            </button>
          ))}
          {preview && (
            <section className="demo-preview" ref={previewRef} tabIndex={-1} aria-label="Demo preview">
              <h3>{preview.name}</h3>
              <PlanMap s={preview} />
              <p>
                {preview.storm} · {preview.intensity} mm/h · {preview.duration}{" "}
                min rain + {preview.recovery} min recovery ·{" "}
                {cost(preview.interventions)} credits.
              </p>
              <p>
                Your current plan is saved to the library before this demo is
                applied.
              </p>
              <button
                className="run"
                disabled={loading || busy}
                onClick={apply}
              >
                {loading ? "Saving your plan…" : "Load & simulate demo"}
              </button>
              <button onClick={() => setPreview(null)}>Cancel preview</button>
            </section>
          )}
          {error && <p role="alert">{error}</p>}
        </>
      )}
      {tab === "share" && (
        <>
          <h3>Send the experiment.</h3>
          <p className="side-intro">
            This link contains your current storm and placements. The recipient
            previews it, then runs their own simulation.
          </p>
          <label className="share-label">
            Scenario link
            <input
              ref={input}
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            className="run"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopy(true);
              } catch {
                input.current?.focus();
                input.current?.select();
                setError(
                  "Copy was unavailable. The link is selected; use your device’s Copy action.",
                );
              }
            }}
          >
            {copy ? <Check size={16} /> : <Copy size={16} />}{" "}
            {copy ? "Link copied" : "Copy scenario link"}
          </button>
          <p role="status">{error}</p>
          <ContextHelp id="sharing" />
          <p className="event-note">
            Site access permissions still apply. If sign-in is required, reopen
            this link afterward. Sharing a link does not make the site public.
            Links include the scenario name; avoid private information in that
            name.
          </p>
        </>
      )}
    </div>
  );
}
export function ReplayControls({
  events,
  step,
  paused,
  reduced,
  move,
  toggle,
  stop,
}: {
  events: StormEvent[];
  step: number;
  paused: boolean;
  reduced: boolean;
  move: (n: number) => void;
  toggle: () => void;
  stop: () => void;
}) {
  const e = events[step];
  if (!e) return null;
  return (
    <section className="cinema-card" aria-label="Cinematic replay">
      <div className="cinema-top">
        <span className="eyebrow">
          STORM REPLAY · {step + 1} / {events.length}
        </span>
        <button aria-label="Exit cinematic replay" onClick={stop}>
          <X size={16} />
        </button>
      </div>
      <div className="cinema-caption" key={e.id}>
        <span>
          {e.minute}
          <small> MIN</small>
        </span>
        <div>
          <h3>{e.title}</h3>
          <p>{e.detail}</p>
        </div>
      </div>
      <div className="cinema-actions">
        <button
          disabled={!step}
          aria-label="Previous replay chapter"
          onClick={() => move(step - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button onClick={toggle}>
          {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
          {paused ? "Play chapters" : "Pause"}
        </button>
        <button
          disabled={step === events.length - 1}
          aria-label="Next replay chapter"
          onClick={() => move(step + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <small>
          {reduced ? "Reduced motion · camera cuts" : "5 seconds per chapter"} ·
          jumps between measured events
        </small>
      </div>
    </section>
  );
}
export function SharedScenarioDialog({
  s,
  accept,
  dismiss,
}: {
  s: Scenario;
  accept: () => Promise<void>;
  dismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="shared-dialog"
      aria-label="Preview shared scenario"
      onCancel={(e) => {
        if (pending) e.preventDefault();
        else dismiss();
      }}
    >
      <div className="modal-head">
        <span className="eyebrow">A SHARED EXPERIMENT</span>
        <button
          className="icon-button"
          aria-label="Keep my current plan"
          disabled={pending}
          onClick={dismiss}
        >
          <X />
        </button>
      </div>
      <h2>{s.name}</h2>
      <PlanMap s={s} />
      <p>
        {s.storm} storm · {s.intensity} mm/h · {s.duration} min rain +{" "}
        {s.recovery} min recovery · {cost(s.interventions)} credits.
      </p>
      <p>
        Your current design will be backed up in the plan library before this
        scenario is loaded.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="run"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await accept();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not load this plan.",
            );
            setPending(false);
          }
        }}
      >
        {pending ? "Saving current plan…" : "Load shared plan & simulate"}
      </button>
      <button className="keep-plan" disabled={pending} onClick={dismiss}>
        Keep my current plan
      </button>
    </dialog>
  );
}
