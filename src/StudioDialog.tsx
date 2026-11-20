import { ArrowDownToLine } from "lucide-react";
import { MODEL, cost, type Result, type Scenario } from "./engine";
import { fmt } from "./format";

function History({ a, b }: { a: Result; b: Result }) {
  const max = Math.max(
    1,
    ...a.frames.map((f) => f.metrics.stored),
    ...b.frames.map((f) => f.metrics.stored),
  );
  const path = (r: Result) =>
    r.frames
      .map(
        (f, i) =>
          `${i ? "L" : "M"}${(i / (r.frames.length - 1)) * 600} ${110 - (f.metrics.stored / max) * 100}`,
      )
      .join(" ");
  return (
    <svg
      className="history"
      viewBox="0 0 600 130"
      role="img"
      aria-label="Stored surface water over time; gray baseline and green improved design"
    >
      <path
        d="M0 110H600M0 60H600M0 10H600"
        stroke="#35443b"
        strokeDasharray="3 6"
      />
      <path d={path(a)} fill="none" stroke="#aeb8af" strokeWidth="2" />
      <path d={path(b)} fill="none" stroke="#c7e398" strokeWidth="3" />
      <text x="0" y="128" fill="#aeb8af" fontSize="10">
        0 min
      </text>
      <text x="550" y="128" fill="#aeb8af" fontSize="10">
        {a.scenario.duration + (a.scenario.recovery ?? 0)} min
      </text>
    </svg>
  );
}

/** Field notes: how to use the studio and what the model represents. */
export function FieldNotes() {
  return (
    <>
      <h2>
        A city is a system.
        <br />
        Every change travels.
      </h2>
      <p>
        MONSOON is an educational planning laboratory for a fictional
        Bangladesh-inspired district. Explore how rainfall, surface storage,
        soil and constrained drainage interact.
      </p>
      <ol className="guide">
        <li>
          <strong>Set the storm.</strong> Choose a rainfall profile and adjust
          the drainage conditions.
        </li>
        <li>
          <strong>Find the pressure points.</strong> Run the storm, scrub time
          and inspect locations.
        </li>
        <li>
          <strong>Make a plan.</strong> Invest 100 fictional credits in paving,
          gardens, basins or drainage.
        </li>
        <li>
          <strong>Compare the futures.</strong> Both designs receive identical
          weather and initial conditions.
        </li>
      </ol>
      <h3>What the model represents</h3>
      <p>
        Release 02 adds a configurable recovery window after rain stops.
        Landmark cards sample entrance runoff and road access. Green routes are
        available at the selected time; red routes are dry-weather reference
        paths with a marker at the first flooded segment. Recovery timing is
        sampled once per minute and does not imply real-world safe passage.
      </p>
      <p>
        A 100 × 100 grid with 10 m cells. Terrain and water heights are
        exaggerated sixfold for visibility. Rainfall is added in consistent
        physical units. Surface transfers conserve volume and depend on
        water-surface elevation. Soil absorption and storage are finite.
        Building roofs send rainfall to adjacent ground; building cells block
        surface flow.
      </p>
      <p>
        District edges are closed. Drains discharge through a shared capacity
        limit. No sewer backflow, river tides, groundwater feedback, evaporation
        or calibrated damage model is included. Flow is a simplified
        storage-transfer scheme, not a shallow-water solver.
      </p>
      <p>
        Flooded area means depth above 10 cm. Streets close in the routing model
        above 15 cm. These are illustrative analysis thresholds, not real-world
        safe-passage guidance. Costs are fictional planning credits.
      </p>
      <h3>Using the studio</h3>
      <p>
        Drag the model to orbit, scroll to zoom, or use the top-view button. The
        coordinate inspector supports keyboard placement and inspection. Reduced
        effects disables rainfall animation. Audio is optional and only plays
        during timeline playback.
      </p>
      <p className="credits">
        Original procedural district · Asifur Rahman Bhuiyan
        <br />
        Model {MODEL} · Results are uncalibrated scenario comparisons.
      </p>
    </>
  );
}

/** The scenario report comparing the baseline and design runs. */
export function ScenarioReport({
  s,
  results,
  exportReport,
}: {
  s: Scenario;
  results: { baseline: Result; improved: Result };
  exportReport: () => void;
}) {
  return (
    <>
      <h2>
        What changed
        <br />
        when the rain came.
      </h2>
      <p>
        {s.duration}-minute {s.storm} storm · {s.intensity} mm/h intensity
        setting · {s.interventions.length} interventions ·{" "}
        {cost(s.interventions)} credits invested.
      </p>
      <History a={results.baseline} b={results.improved} />
      <p>
        Rain ends at minute {s.duration}; recovery continues for{" "}
        {s.recovery ?? 0} minutes. End-of-run values below include recovery.
      </p>
      <div className="chart-key">
        <span>● Baseline</span>
        <span>● Your design</span>
        <small>Surface water storage over time</small>
      </div>
      <table>
        <thead>
          <tr>
            <th>At run end</th>
            <th>Baseline</th>
            <th>Your design</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ["Flooded area", "flooded", 10000, "ha"],
              ["Maximum depth", "maxDepth", 0.01, "cm"],
              ["Stored on surface", "stored", 1, "m³"],
              ["Infiltrated", "infiltrated", 1, "m³"],
              ["Drainage discharge", "discharged", 1, "m³"],
              ["Rainfall volume", "rain", 1, "m³"],
              ["Numerical residual", "residual", 1, "m³"],
            ] as const
          ).map(([label, key, div, unit]) => (
            <tr key={key}>
              <th>{label}</th>
              <td>
                {fmt(results.baseline.frames.at(-1)!.metrics[key] / div, 3)}{" "}
                {unit}
              </td>
              <td>
                {fmt(results.improved.frames.at(-1)!.metrics[key] / div, 3)}{" "}
                {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Water accounting: rainfall = surface storage + infiltration + discharge
        + numerical residual. Relative residual:{" "}
        {(
          (Math.abs(results.improved.frames.at(-1)!.metrics.residual) /
            Math.max(1, results.improved.frames.at(-1)!.metrics.rain)) *
          100
        ).toExponential(2)}
        %.
      </p>
      <p>
        Measured compute time: {fmt(results.baseline.elapsed)} ms baseline /{" "}
        {fmt(results.improved.elapsed)} ms design on this device. Frame rate and
        compute time are independent.
      </p>
      <button className="run" onClick={exportReport}>
        <ArrowDownToLine size={16} /> Export report
      </button>
      <p className="credits">
        Fictional district. Uncalibrated educational model. Both runs use the
        same storm and initial conditions. Read Field notes for assumptions.
      </p>
    </>
  );
}
