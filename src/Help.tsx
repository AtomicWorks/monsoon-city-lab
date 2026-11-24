import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  HelpCircle,
  Search,
  X,
} from "lucide-react";
import { GUIDE_TOPICS, TOUR, searchGuides, type GuideAction } from "./guides";
export function ContextHelp({ id }: { id: string }) {
  const t = GUIDE_TOPICS.find((t) => t.id === id);
  if (!t) return null;
  return (
    <details className="context-help">
      <summary>
        <HelpCircle size={14} />
        How this works
      </summary>
      <div>
        <strong>{t.title}</strong>
        <p>{t.what}</p>
        <p>{t.how}</p>
        <span>{t.tip}</span>
      </div>
    </details>
  );
}
export function HelpCenter({
  close,
  navigate,
  startTour,
  reduced,
  toggleMotion,
}: {
  close: () => void;
  navigate: (a: GuideAction) => void;
  startTour: () => void;
  reduced: boolean;
  toggleMotion: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const matches = searchGuides(query, category);
  return (
    <dialog
      ref={dialog}
      className="help-dialog"
      aria-label="Help and guides"
      onCancel={close}
    >
      <div className="help-top">
        <span className="eyebrow">MONSOON / FIELD GUIDE 08</span>
        <button className="icon-button" onClick={close} aria-label="Close help">
          <X />
        </button>
      </div>
      <div className="help-hero">
        <Compass size={34} />
        <h2>
          A little guidance.
          <br />
          <em>A bigger impact.</em>
        </h2>
        <p>
          Understand the controls. Make your first plan.
          <br />
          Learn what the city is telling you.
        </p>
        <button
          className="run"
          onClick={() => {
            close();
            startTour();
          }}
        >
          Take the guided tour <ArrowRight size={16} />
        </button>
      </div>
      <div className="help-preferences">
        <span>Make yourself comfortable</span>
        <button aria-pressed={reduced} onClick={toggleMotion}>
          {reduced ? <Check size={14} /> : null}Reduced motion{" "}
          {reduced ? "on" : "off"}
        </button>
      </div>
      <label className="help-search">
        <Search size={18} />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search: drain, budget, PDF, water depth…"
          aria-label="Search function guides"
        />
      </label>
      <div className="help-categories" aria-label="Guide categories">
        {["All", ...new Set(GUIDE_TOPICS.map((t) => t.category))].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="help-count" role="status">
        {matches.length} {matches.length === 1 ? "guide" : "guides"} found
      </p>
      <div className="help-results">
        {matches.map((t) => (
          <details key={t.id} className="help-topic">
            <summary>
              <span>
                <small>{t.category}</small>
                {t.title}
              </span>
              <span className="expand-sign">+</span>
            </summary>
            <div>
              <p>{t.what}</p>
              <h3>Try it</h3>
              <p>{t.how}</p>
              <aside>{t.tip}</aside>
              <button
                onClick={() => {
                  close();
                  navigate(t.action);
                }}
              >
                Open{" "}
                {t.action === "map"
                  ? "the district"
                  : t.action === "notes"
                    ? "field notes"
                    : t.action === "run"
                      ? "simulation controls"
                      : t.action}{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          </details>
        ))}
      </div>
      {!matches.length && (
        <div className="help-empty">
          <BookOpen />
          <h3>No matching guide yet.</h3>
          <p>Try “rain”, “save”, “access” or “budget”.</p>
          <button
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            Show all guides
          </button>
        </div>
      )}
      <footer>
        Fictional city. Educational model. Explore freely, compare carefully.
      </footer>
    </dialog>
  );
}
export function GuidedTour({
  step,
  move,
  close,
  reduced,
}: {
  step: number;
  move: (step: number) => void;
  close: (finished: boolean) => void;
  reduced: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null),
    last = step === TOUR.length - 1,
    t = TOUR[step];
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-guide="${t.target}"]`,
    );
    target?.classList.add("tour-highlight");
    target?.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
      block: matchMedia("(max-width: 760px)").matches ? "start" : "nearest",
    });
    panel.current?.focus({ preventScroll: true });
    return () => target?.classList.remove("tour-highlight");
  }, [step, reduced, t.target]);
  return (
    <div
      ref={panel}
      tabIndex={-1}
      className={`tour-card ${t.target === "run" ? "tour-run" : ""}`}
      role="region"
      aria-label={`Guided tour step ${step + 1} of ${TOUR.length}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") close(false);
      }}
    >
      <div className="tour-top">
        <span className="eyebrow">
          GUIDED TOUR · {step + 1} / {TOUR.length}
        </span>
        <button aria-label="Close guided tour" onClick={() => close(false)}>
          <X size={17} />
        </button>
      </div>
      <div key={step} className="tour-copy">
        <span className="tour-number">0{step + 1}</span>
        <h3>{t.title}</h3>
        <p>{t.text}</p>
      </div>
      <div className="tour-dots" aria-label="Tour progress">
        {TOUR.map((v, i) => (
          <button
            key={v.title}
            aria-label={`Step ${i + 1}: ${v.label}`}
            aria-current={i === step ? "step" : undefined}
            onClick={() => move(i)}
          />
        ))}
      </div>
      <div className="tour-actions">
        <button onClick={() => (step ? move(step - 1) : close(false))}>
          {step ? "Back" : "Skip tour"}
        </button>
        <button
          className="run"
          onClick={() => (last ? close(true) : move(step + 1))}
        >
          {last ? "Finish tour" : "Next"}
          <ArrowRight size={15} />
        </button>
      </div>
      <small>
        You can use the highlighted controls while this guide stays open.
      </small>
    </div>
  );
}
export function WelcomeGuide({
  start,
  help,
  finished = false,
}: {
  start: () => void;
  help: () => void;
  finished?: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("monsoon-welcome-v4") === "seen";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (finished) setDismissed(true);
  }, [finished]);
  if (dismissed)
    return (
      <button className="replay-guide" onClick={start}>
        <Compass size={15} />
        Take a guided tour <ArrowRight size={14} />
      </button>
    );
  return (
    <div className="welcome-guide">
      <div className="welcome-line">
        <span className="eyebrow">NEW HERE? START SMALL.</span>
        <button
          aria-label="Dismiss welcome guide"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem("monsoon-welcome-v4", "seen");
            } catch {}
          }}
        >
          <X size={14} />
        </button>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <i />
        <i />
        <i />
        <Compass size={28} />
      </div>
      <h3>
        {/* Phones hide the break, so the space must be explicit. */}
        Your first plan <br />
        starts with one change.
      </h3>
      <p>
        Follow six short steps through the real controls. Explore at your own
        pace.
      </p>
      <button className="run" onClick={start}>
        Show me around <ArrowRight size={15} />
      </button>
      <button className="welcome-secondary" onClick={help}>
        What does each function do?
      </button>
    </div>
  );
}
