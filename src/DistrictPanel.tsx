import { useState, useEffect } from "react";
import {
  DEFAULT_PRESET,
  PRESETS,
  baselineScenario,
  districtFor,
  paintLayout,
  protectedLot,
  type LandKind,
  type Layout,
  type Scenario,
  type Result,
} from "./engine";
import PlanMap from "./PlanMap";
import { ContextHelp } from "./Help";
export type Brush = { x: number; y: number; kind: LandKind; radius: number };
export const LAND_LABELS: Record<LandKind, string> = {
  0: "Park",
  1: "Road",
  4: "Building",
  5: "Paved ground",
};
export function previewDistrict(s: Scenario, brush: Brush) {
  try {
    return {
      scenario: paintLayout(s, brush.x, brush.y, brush.kind, brush.radius),
      error: "",
    };
  } catch (e) {
    return {
      scenario: s,
      error: e instanceof Error ? e.message : "Invalid brush",
    };
  }
}
export default function DistrictPanel({
  s,
  brush,
  setBrush,
  apply,
  undo,
  redo,
  canUndo,
  canRedo,
  exitMission,
  tutorial,
  startTutorial,
  endTutorial,
  results,
  run,
  compare,
}: {
  s: Scenario;
  brush: Brush;
  setBrush: (b: Brush) => void;
  apply: (s: Scenario) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  exitMission: () => void;
  tutorial: boolean;
  startTutorial: () => Promise<void>;
  endTutorial: () => void;
  results: { baseline: Result; improved: Result } | null;
  run: () => void;
  compare: () => void;
}) {
  const [preset, setPreset] = useState<Layout["preset"]>(
    s.layout?.preset ?? DEFAULT_PRESET,
  );
  const [presetPreview, setPresetPreview] = useState(false),
    [starting, setStarting] = useState(false);
  useEffect(() => {
    setPreset(s.layout?.preset ?? DEFAULT_PRESET);
    setPresetPreview(false);
  }, [s.layout?.preset]);
  const preview = previewDistrict(s, brush),
    candidate = {
      ...s,
      challenge: undefined,
      interventions: [],
      layout: { preset, edits: [] },
    } as Scenario;
  const painted =
    s.layout?.preset === "industrial" &&
    s.layout.edits.some((e) => e.x === 5 && e.y === 4 && e.kind === 0);
  const done = tutorial && painted && !!results;
  const peak = (r: Result) =>
    Math.max(...r.frames.map((f) => f.metrics.flooded)) / 10000;
  return (
    <div className="district-editor">
      <span className="release-kicker">RELEASE 08 / SHAPE THE CITY</span>
      <h2 className="mission-heading">
        A different city.
        <br />A different future.
      </h2>
      <p className="side-intro">
        Paint 100 m blocks. Preview first, then apply. The flood model and roads
        follow your layout.
      </p>
      {s.challenge ? (
        <div className="district-locked">
          <strong>Mission map locked</strong>
          <p>
            Fixed maps keep challenge scores comparable. Return to your saved
            sandbox to reshape a district.
          </p>
          <button onClick={exitMission}>Return to saved sandbox</button>
        </div>
      ) : (
        <>
          <div className="district-lesson">
            {!tutorial ? (
              <>
                <strong>Learn by doing</strong>
                <p>
                  Turn a sealed industrial block into a park, then measure the
                  difference. Your current plan is backed up first.
                </p>
                <button
                  disabled={starting}
                  onClick={async () => {
                    setStarting(true);
                    try {
                      await startTutorial();
                    } finally {
                      setStarting(false);
                    }
                  }}
                >
                  {starting ? "Preparing…" : "Start first experiment"}
                </button>
              </>
            ) : (
              <>
                <span className="lesson-step">
                  {done
                    ? "03 / OBSERVE"
                    : painted
                      ? "02 / SIMULATE"
                      : "01 / RESHAPE"}
                </span>
                <strong>
                  {done
                    ? "Your change has a measured result."
                    : painted
                      ? "Now run the storm."
                      : "Give one block back to nature."}
                </strong>
                <p>
                  {done
                    ? "Compare your whole design with the original industrial layout under identical weather. Any extra edits or improvements you added are included."
                    : painted
                      ? "Run the edited district and its unchanged preset together."
                      : "Choose Park, a 1-block brush, column 5 and row 4. Preview the green block, then Apply brush."}
                </p>
                {done && results && (
                  <div className="lesson-results">
                    <span>
                      Extra water absorbed
                      <strong>
                        {(
                          results.improved.frames.at(-1)!.metrics.infiltrated -
                          results.baseline.frames.at(-1)!.metrics.infiltrated
                        ).toFixed(0)}{" "}
                        m³
                      </strong>
                    </span>
                    <span>
                      Change in peak flooded area
                      <strong>
                        {(
                          peak(results.improved) - peak(results.baseline)
                        ).toFixed(2)}{" "}
                        ha
                      </strong>
                      <small>Negative means less flooding.</small>
                    </span>
                  </div>
                )}
                {done ? (
                  <button onClick={compare}>Compare my experiment</button>
                ) : painted ? (
                  <button onClick={run}>Run my experiment</button>
                ) : null}
                <button className="quiet-button" onClick={endTutorial}>
                  {done ? "Finish tutorial" : "Exit tutorial"}
                </button>
              </>
            )}
          </div>
          <label className="layer-picker">
            Neighborhood preset
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as Layout["preset"]);
                setPresetPreview(true);
              }}
            >
              {Object.entries(PRESETS).map(([id, v]) => (
                <option key={id} value={id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          {presetPreview && (
            <div className="preset-preview">
              <strong>{PRESETS[preset].name}</strong>
              <p>{PRESETS[preset].description}</p>
              <PlanMap s={candidate} />
              <p>
                Applying replaces the layout and removes improvements. Undo
                restores the previous design.
              </p>
              <button
                onClick={() => {
                  apply(candidate);
                  setPresetPreview(false);
                }}
              >
                Apply preset
              </button>
              <button
                className="quiet-button"
                onClick={() => setPresetPreview(false)}
              >
                Cancel preset preview
              </button>
            </div>
          )}
          <div
            className="district-brushes"
            role="group"
            aria-label="Land use brush"
          >
            {([0, 1, 4, 5] as LandKind[]).map((k) => (
              <button
                key={k}
                aria-pressed={brush.kind === k}
                onClick={() => setBrush({ ...brush, kind: k })}
              >
                <i data-kind={k} />
                {LAND_LABELS[k]}
              </button>
            ))}
          </div>
          <label className="layer-picker">
            Brush size
            <select
              value={brush.radius}
              onChange={(e) =>
                setBrush({ ...brush, radius: Number(e.target.value) })
              }
            >
              <option value={0}>1 block · 100 m</option>
              <option value={1}>3 × 3 blocks · 300 m</option>
              <option value={2}>5 × 5 blocks · 500 m</option>
            </select>
          </label>
          <div className="lot-coordinates">
            <label>
              Block column
              <input
                aria-label="Block column"
                type="number"
                min="0"
                max="9"
                value={brush.x}
                onChange={(e) =>
                  setBrush({ ...brush, x: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Block row
              <input
                aria-label="Block row"
                type="number"
                min="0"
                max="9"
                value={brush.y}
                onChange={(e) =>
                  setBrush({ ...brush, y: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <div className="district-minimap">
            <PlanMap s={preview.scenario} />
            <div className="lot-grid" role="group" aria-label="District blocks">
              {Array.from({ length: 100 }, (_, i) => {
                const x = i % 10,
                  y = Math.floor(i / 10),
                  locked = protectedLot(x, y);
                return (
                  <button
                    key={i}
                    disabled={locked}
                    aria-label={`Block ${x}, ${y}${locked ? ", protected" : ""}`}
                    aria-pressed={x === brush.x && y === brush.y}
                    className={
                      Math.abs(x - brush.x) <= brush.radius &&
                      Math.abs(y - brush.y) <= brush.radius
                        ? "brush-preview"
                        : ""
                    }
                    onClick={() => setBrush({ ...brush, x, y })}
                  >
                    {locked ? "·" : ""}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="brush-feedback" role="status">
            {preview.error ||
              `Preview: ${LAND_LABELS[brush.kind]} at block ${brush.x}, ${brush.y}. Protected blocks are skipped.`}
          </p>
          <button
            className="apply-brush"
            disabled={!!preview.error}
            onClick={() => apply(preview.scenario)}
          >
            Apply brush
          </button>
          <div className="district-history">
            <button disabled={!canUndo} onClick={undo}>
              Undo district edit
            </button>
            <button disabled={!canRedo} onClick={redo}>
              Redo
            </button>
          </div>
          <button
            className="quiet-button"
            disabled={!s.layout?.edits.length}
            onClick={() =>
              apply({ ...baselineScenario(s), interventions: s.interventions })
            }
          >
            Reset painted blocks
          </button>
          <p className="event-note">
            {s.layout?.edits.length ?? 0} edited blocks · N ↑ at top. Click the
            city or minimap to move the brush. Parks absorb water; paved ground
            and roads are sealed. Buildings redirect roof rain to their southern
            edge. Land-use edits use no intervention credits; compare them as
            planning experiments.
          </p>
        </>
      )}
      <ContextHelp id="district" />
    </div>
  );
}
