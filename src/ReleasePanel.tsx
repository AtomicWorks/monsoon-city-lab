import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Flag,
  MapPin,
  Route,
  Sunrise,
} from "lucide-react";
import {
  LANDMARKS,
  MISSIONS,
  landmarkSummary,
  recoverySummary,
  challengeOutcome,
  route,
  type Landmark,
} from "./impact";
import { districtFor, type Scenario, type Result, type Frame } from "./engine";
type Props = {
  s: Scenario;
  results: { baseline: Result; improved: Result } | null;
  frame?: Frame;
  start: (id: NonNullable<Scenario["challenge"]>) => void;
  exit: () => void;
  focus: (l: Landmark) => void;
  build: () => void;
  compare: () => void;
};
export default function ReleasePanel({
  s,
  results,
  frame,
  start,
  exit,
  focus,
  build,
  compare,
}: Props) {
  const [guide, setGuide] = useState(false);
  const summaries = useMemo(
    () =>
      results
        ? LANDMARKS.map((l) => ({
            l,
            a: landmarkSummary(results.baseline, l),
            b: landmarkSummary(results.improved, l),
          }))
        : [],
    [results],
  );
  const outcome = useMemo(
    () =>
      results ? challengeOutcome(s, results.baseline, results.improved) : null,
    [s, results],
  );
  const recovery = results ? recoverySummary(results.improved) : null;
  return (
    <>
      <div className="release-kicker">
        <Sunrise size={15} /> MISSIONS · FOUR CHALLENGES
      </div>
      <h2 className="mission-heading">
        Give the city
        <br />a better tomorrow.
      </h2>
      <p className="side-intro">
        Three places. Four challenges. Every intervention changes what happens
        next.
      </p>
      {guide && (
        <div className="guide-card">
          <div className="section-label">
            YOUR FIRST EXPERIMENT
            <button onClick={() => setGuide(false)}>Skip guide</button>
          </div>
          <ol>
            <li>Choose a challenge and run its baseline.</li>
            <li>Inspect a landmark and its access route.</li>
            <li>Add improvements within 100 credits.</li>
            <li>Rerun and compare rainfall + recovery.</li>
          </ol>
          <button className="coordinate-button" onClick={build}>
            Open intervention tools <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      {!guide && (
        <button className="coordinate-button" onClick={() => setGuide(true)}>
          Show quick guide
        </button>
      )}
      <div className="mission-list">
        {MISSIONS.map((m) => (
          <article
            className={`mission-card ${s.challenge === m.id ? "selected" : ""}`}
            key={m.id}
          >
            <span className="eyebrow">{m.subtitle}</span>
            <h3>{m.title}</h3>
            <p>{m.description}</p>
            <div className="mission-facts">
              <span>{m.duration} min rain</span>
              <span>{m.recovery} min recovery</span>
            </div>
            <button disabled={s.challenge === m.id} onClick={() => start(m.id)}>
              {s.challenge === m.id ? (
                <>
                  <Check size={13} /> Active challenge
                </>
              ) : (
                <>
                  Start challenge <ArrowUpRight size={13} />
                </>
              )}
            </button>
          </article>
        ))}
      </div>
      {s.challenge && (
        <>
          <div className="objective-card">
            <Flag size={15} />
            <div>
              <strong>
                {outcome?.complete
                  ? "Challenge achieved"
                  : outcome
                    ? "Keep experimenting"
                    : "Run to evaluate your plan"}
              </strong>
              <p>
                {outcome
                  ? `${outcome.improvement.toFixed(1)}% peak flooded-area reduction / ${outcome.target}% target. Landmark target ${outcome.local ? "met" : "not yet met"}.`
                  : "Your targets are evaluated from completed runs with matching storm conditions."}
              </p>
              {!!outcome?.goals.length && (
                <ul className="service-goals">
                  {outcome.goals.map((g) => (
                    <li key={g.label} className={g.met ? "met" : ""}>
                      <span>
                        {g.met ? "✓" : "○"} {g.label}
                      </span>
                      <small>{g.detail}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button className="coordinate-button" onClick={exit}>
            Return to saved sandbox
          </button>
        </>
      )}
      <div className="section-label impact-heading">
        LANDMARK IMPACT / CURRENT RUN
      </div>
      {!results && (
        <p className="empty">
          Run the current design to reveal landmark impacts and recovery.
        </p>
      )}
      {summaries.map(({ l, a, b }) => (
        <button className="landmark-card" key={l.id} onClick={() => focus(l)}>
          <div>
            <span className="landmark-dot" style={{ background: l.color }} />
            <strong>{l.name}</strong>
            <MapPin size={13} />
          </div>
          <span className="landmark-status">
            {frame && route(frame.depth, l, false, districtFor(s.layout)).length
              ? "Connected at this moment"
              : "Disconnected at this moment"}
          </span>
          <dl>
            <div>
              <dt>Peak entrance depth</dt>
              <dd>
                {(b.peak * 100).toFixed(1)} cm{" "}
                <small>vs {(a.peak * 100).toFixed(1)}</small>
              </dd>
            </div>
            <div>
              <dt>Above 10 cm</dt>
              <dd>{b.exposure.toFixed(1)} min</dd>
            </div>
            <div>
              <dt>Access interrupted</dt>
              <dd>
                {b.outageMinutes} min <small>vs {a.outageMinutes}</small>
              </dd>
            </div>
            <div>
              <dt>Stable access after rain</dt>
              <dd>
                {b.restored === null
                  ? "Not restored"
                  : b.outageMinutes === 0
                    ? "Never interrupted"
                    : `+${b.restored} min`}
              </dd>
            </div>
          </dl>
          <span className="landmark-link">
            <Route size={12} /> Focus & trace access route
          </span>
        </button>
      ))}
      {recovery && (
        <div className="recovery-card">
          <Sunrise size={17} />
          <h3>After the rain</h3>
          <strong>
            {Math.round(recovery.removed).toLocaleString()}{" "}
            <small>m³ removed from surface</small>
          </strong>
          <p>
            During {recovery.recoveryMinutes} minutes of recovery.{" "}
            {Math.round(recovery.endStored).toLocaleString()} m³ remains in the
            district, including storage depressions.
          </p>
          <button className="coordinate-button" onClick={compare}>
            Compare both futures <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      <p className="micro-note">
        Access uses an illustrative 15 cm threshold and a short entrance
        connector to the road network. Timing is sampled once per minute. These
        are model outcomes, not real-world travel advice.
      </p>
    </>
  );
}
