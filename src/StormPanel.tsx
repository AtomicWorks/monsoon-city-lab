import { CloudRain, Droplets, SlidersHorizontal } from "lucide-react";
import { ContextHelp } from "./Help";
import { rainfall, type Scenario } from "./engine";

function RainChart({ s }: { s: Scenario }) {
  return (
    <svg
      className="rain-chart"
      viewBox="0 0 240 58"
      role="img"
      aria-label={`${s.storm} rainfall profile, peak setting ${s.intensity} millimeters per hour`}
    >
      <path d="M0 54H240M0 28H240" stroke="#34423b" strokeDasharray="2 4" />
      {Array.from({ length: 40 }, (_, i) => {
        const h = (rainfall(s, (i / 40) * s.duration * 60) / 160) * 48;
        return (
          <rect
            key={i}
            x={i * 6}
            y={54 - h}
            width="3.4"
            height={h}
            rx="1"
            fill="#bdd68b"
          />
        );
      })}
    </svg>
  );
}

/** The Storm tab: rainfall profile, recovery window and drainage conditions. */
export default function StormPanel({
  s,
  change,
}: {
  s: Scenario;
  change: (p: Partial<Scenario>) => void;
}) {
  return (
    <>
      <div className="section-label">
        01 / WEATHER SCENARIO
        <SlidersHorizontal size={14} />
      </div>
      <ContextHelp id="storm" />
      <div className="storm-options">
        {(
          [
            ["burst", "Cloudburst", "Short. Intense. Fast."],
            ["persistent", "Long monsoon", "A sustained rainfall event."],
            ["double", "Double peak", "Two waves. One recovery window."],
          ] as const
        ).map(([id, name, desc]) => (
          <button
            key={id}
            className={`storm-option ${s.storm === id ? "chosen" : ""}`}
            onClick={() => change({ storm: id })}
          >
            <CloudRain size={21} />
            <span>
              <strong>{name}</strong>
              <small>{desc}</small>
            </span>
            <span className="radio">{s.storm === id && <span />}</span>
          </button>
        ))}
      </div>
      <RainChart s={s} />
      <div className="chart-caption">
        <span>RAINFALL PROFILE</span>
        <span>{s.duration} MIN</span>
      </div>
      <label className="range-label">
        Peak intensity{" "}
        <strong>
          {s.intensity}
          <small> mm/h</small>
        </strong>
        <input
          aria-label="Peak intensity"
          type="range"
          min="0"
          max="160"
          step="5"
          value={s.intensity}
          onChange={(e) => change({ intensity: +e.target.value })}
        />
      </label>
      <label className="range-label">
        Storm duration{" "}
        <strong>
          {s.duration}
          <small> min</small>
        </strong>
        <input
          aria-label="Storm duration"
          type="range"
          min="20"
          max="120"
          step="10"
          value={s.duration}
          onChange={(e) => change({ duration: +e.target.value })}
        />
      </label>
      <div className="section-label drainage-label">RECOVERY WINDOW</div>
      <ContextHelp id="recovery" />
      <label className="range-label">
        After rainfall stops{" "}
        <strong>
          {s.recovery ?? 0}
          <small> min</small>
        </strong>
        <input
          aria-label="Recovery duration"
          type="range"
          min="0"
          max="180"
          step="15"
          value={s.recovery ?? 0}
          onChange={(e) => change({ recovery: +e.target.value })}
        />
      </label>
      <p className="side-intro">
        Rain stops completely. Soil and drains continue working through the
        recovery window.
      </p>
      <div className="section-label drainage-label">
        02 / DRAINAGE CONDITIONS
      </div>
      <ContextHelp id="drainage" />
      <label className="range-label">
        Drain blockage{" "}
        <strong>
          {s.blockage}
          <small> %</small>
        </strong>
        <input
          aria-label="Drain blockage"
          type="range"
          min="0"
          max="100"
          step="5"
          value={s.blockage}
          onChange={(e) => change({ blockage: +e.target.value })}
        />
      </label>
      <label className="range-label">
        Shared outlet capacity{" "}
        <strong>
          {s.outlet}
          <small> m³/s</small>
        </strong>
        <input
          aria-label="Outlet capacity"
          type="range"
          min="0"
          max="12"
          step=".5"
          value={s.outlet}
          onChange={(e) => change({ outlet: +e.target.value })}
        />
      </label>
      <label className="range-label">
        Soil absorption
        <strong>
          {s.infiltrationFactor ?? 1}
          <small> ×</small>
        </strong>
        <input
          aria-label="Soil absorption multiplier"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={s.infiltrationFactor ?? 1}
          onChange={(e) => change({ infiltrationFactor: +e.target.value })}
        />
      </label>
      <ContextHelp id="soil" />
      <div className="hint">
        <Droplets size={16} />
        <p>
          Every drop is accounted for. Soil, storage and drainage all have
          limits.
        </p>
      </div>
    </>
  );
}
