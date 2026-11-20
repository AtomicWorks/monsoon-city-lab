import { useMemo } from "react";
import { X } from "lucide-react";
import {
  districtFor,
  TOOLS,
  hydraulicFields,
  type Scenario,
  type Frame,
  type Result,
} from "./engine";
import { inspectCell } from "./insight";
export default function FloodInspector({
  s,
  frame,
  result,
  selected,
  close,
}: {
  s: Scenario;
  frame?: Frame;
  result?: Result;
  selected: number;
  close: () => void;
}) {
  const DISTRICT = districtFor(s.layout);
  const fields = useMemo(() => hydraulicFields(s), [s]);
  const v = inspectCell(s, frame, selected, fields);
  const f = (n: number | undefined, digits = 1) =>
    n === undefined ? "—" : n.toFixed(digits);
  return (
    <section
      className="inspector flood-inspector"
      aria-label="Why is this flooded?"
    >
      <div className="inspector-title">
        <span>
          YOUR DESIGN · CELL {v.x}, {v.y}
        </span>
        <button
          className="icon-button"
          aria-label="Close inspector"
          onClick={close}
        >
          <X size={15} />
        </button>
      </div>
      <h3>Why is this flooded?</h3>
      <p className="inspect-context">
        {
          [
            "Green space",
            "Neighborhood street",
            "Urban ground",
            "Existing pond",
            "Building runoff",
            "Sealed paved ground",
          ][DISTRICT.kind[selected]]
        }{" "}
        · {frame ? "Minute " + frame.metrics.time / 60 : "Design preview"}
      </p>
      <div className="inspect-stats">
        <span>
          Water depth
          <strong>
            {f(v.depth === undefined ? undefined : v.depth * 100)}
            <small> cm</small>
          </strong>
        </span>
        <span>
          Ground elevation
          <strong>
            {f(v.elevation, 2)}
            <small> m</small>
          </strong>
        </span>
      </div>
      <dl className="soil-facts">
        <div>
          <dt>Absorption limit</dt>
          <dd>{f(v.rate)} mm/h</dd>
        </div>
        <div>
          <dt>Soil storage remaining</dt>
          <dd>
            {f(v.remaining)} / {f(v.capacity, 0)} mm
          </dd>
        </div>
        <div>
          <dt>Intake in this cell</dt>
          <dd>
            {fields.intake[v.i] > 0
              ? !frame
                ? "Present · run to evaluate"
                : v.active
                  ? "Active last minute"
                  : frame.metrics.time === 0
                    ? "Present · not yet active"
                    : "Present · inactive last minute"
              : "None"}
          </dd>
        </div>
        <div>
          <dt>Nearest intake</dt>
          <dd>
            {v.nearest < 0
              ? "None"
              : f(v.distance, 0) + " m in a straight line"}
          </dd>
        </div>
      </dl>
      <p className="inspector-note">
        Soil storage is water depth over this cell, not surface flood depth.
        Elevation includes your gardens and basins. Roof selections use the
        receiving ground cell.
      </p>
      <ul className="insight-notes">
        {v.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {!!v.covered.length && (
        <p>
          <b>Improvements covering this cell:</b>{" "}
          {v.covered.map((t) => TOOLS[t.type].name).join(", ")}.
        </p>
      )}
      {result && (
        <details>
          <summary>Full-run measurements</summary>
          <p>
            Peak depth {f(result.peakDepth[v.i] * 100)} cm · above 10 cm for{" "}
            {f(result.exposure[v.i] / 60)} min.
            <br />
            Infiltrated {f(result.infiltration[v.i])} m³ · drained{" "}
            {f(result.drainage[v.i])} m³.
          </p>
        </details>
      )}
      <p className="inspector-note">
        These are local model conditions, not a causal attribution or real-world
        assessment. Nearby drains may be separated by higher ground.
      </p>
    </section>
  );
}
