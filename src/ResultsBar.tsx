import { Droplets, MoveUpRight, ShieldCheck, Waves } from "lucide-react";
import type { Metrics } from "./engine";
import { fmt } from "./format";

/** Headline metrics for the selected minute of the design run. */
export default function ResultsBar({
  m,
  reduction,
  connectivity,
  hasInterventions,
}: {
  m: Metrics | undefined;
  reduction: number;
  connectivity: number | null;
  hasInterventions: boolean;
}) {
  return (
    <section className="metrics" aria-label="Scenario results">
      <div>
        <span className="metric-label">
          FLOODED AREA <Waves size={15} />
        </span>
        <strong>
          {m ? fmt(m.flooded / 10000, 2) : "—"}
          <small> ha</small>
        </strong>
        <p>
          {m && hasInterventions ? (
            <span className={reduction >= 0 ? "positive" : "negative"}>
              {reduction >= 0 ? "↘" : "↗"} {fmt(Math.abs(reduction), 1)}%{" "}
              {reduction >= 0 ? "less" : "more"} than baseline
            </span>
          ) : (
            "Surface depth above 10 cm"
          )}
        </p>
      </div>
      <div>
        <span className="metric-label">
          MAXIMUM DEPTH <Droplets size={15} />
        </span>
        <strong>
          {m ? fmt(m.maxDepth * 100, 1) : "—"}
          <small> cm</small>
        </strong>
        <p>At the selected moment</p>
      </div>
      <div>
        <span className="metric-label">
          CONNECTED STREETS <MoveUpRight size={15} />
        </span>
        <strong>
          {connectivity ?? "—"}
          <small> %</small>
        </strong>
        <p>Reachable from northern boundary</p>
      </div>
      <div>
        <span className="metric-label">
          SURFACE STORAGE <ShieldCheck size={15} />
        </span>
        <strong>
          {m ? fmt(m.stored) : "—"}
          <small> m³</small>
        </strong>
        <p>Water currently held in the district</p>
      </div>
    </section>
  );
}
