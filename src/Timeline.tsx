import { ArrowUpRight, Pause, Play } from "lucide-react";
import type { Scenario } from "./engine";

/** Playback controls and the minute-by-minute timeline. */
export default function Timeline({
  s,
  valid,
  index,
  total,
  playing,
  speed,
  togglePlayback,
  seek,
  cycleSpeed,
  openReport,
}: {
  s: Scenario;
  valid: boolean;
  index: number;
  total: number;
  playing: boolean;
  speed: number;
  togglePlayback: () => void;
  seek: (minute: number) => void;
  cycleSpeed: () => void;
  openReport: () => void;
}) {
  return (
    <section className="timeline" aria-label="Simulation timeline">
      <button
        className="play"
        disabled={!valid}
        aria-label={playing ? "Pause playback" : "Play simulation"}
        onClick={togglePlayback}
      >
        {playing ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" />
        )}
      </button>
      <div className="time-readout">
        {String(valid ? index : 0).padStart(2, "0")}
        <small> / {s.duration + (s.recovery ?? 0)} MIN</small>
      </div>
      <div className="timeline-track">
        <input
          aria-label="Simulation time in minutes"
          type="range"
          min="0"
          max={Math.max(1, total - 1)}
          value={valid ? index : 0}
          disabled={!valid}
          onChange={(e) => seek(+e.target.value)}
        />
        <div>
          <button
            className="phase-jump"
            disabled={!valid}
            onClick={() => seek(0)}
          >
            RAINFALL
          </button>
          <button
            className="phase-jump"
            disabled={!valid}
            onClick={() => seek(s.duration)}
          >
            RAIN ENDS · {s.duration} MIN
          </button>
          <span>
            {valid && index >= s.duration ? "RECOVERING" : "RECOVERY"} +
            {s.recovery ?? 0} MIN
          </span>
        </div>
      </div>
      <button
        className="speed"
        onClick={cycleSpeed}
        aria-label={`Playback speed ${speed} times`}
      >
        {speed}×
      </button>
      <span className="timeline-divider" />
      <button className="report-button" disabled={!valid} onClick={openReport}>
        View report <ArrowUpRight size={16} />
      </button>
    </section>
  );
}
