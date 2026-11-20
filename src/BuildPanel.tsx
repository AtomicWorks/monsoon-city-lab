import {
  Droplets,
  Layers,
  Leaf,
  LocateFixed,
  Plus,
  RotateCcw,
  Trash2,
  Waves,
} from "lucide-react";
import { ContextHelp } from "./Help";
import type { EditOperation } from "./editing";
import {
  TOOLS,
  cost,
  type Intervention,
  type Scenario,
  type Tool,
} from "./engine";

/** The Build tab: budget, intervention tools and the placed-improvement list. */
export default function BuildPanel({
  s,
  tool,
  operation,
  canUndo,
  canRedo,
  cancelEdit,
  chooseTool,
  undoEdit,
  showPlacement,
  beginEdit,
  remove,
  openLocator,
}: {
  s: Scenario;
  tool: Tool | null;
  operation: EditOperation;
  canUndo: boolean;
  canRedo: boolean;
  cancelEdit: () => void;
  chooseTool: (id: Tool) => void;
  undoEdit: (direction: "undo" | "redo") => void;
  showPlacement: (item: Intervention) => void;
  beginEdit: (kind: "move" | "duplicate", item: Intervention) => void;
  remove: (id: string) => void;
  openLocator: () => void;
}) {
  return (
    <>
      <div className="section-label">
        01 / YOUR INVESTMENT
        <span>{100 - cost(s.interventions)} C LEFT</span>
      </div>
      <div className="budget-bar">
        <i style={{ width: `${cost(s.interventions)}%` }} />
      </div>
      <ContextHelp id="placement" />
      <p className="side-intro">
        Choose an intervention, then place it on open ground or a street.
      </p>
      {operation && (
        <div className="edit-notice" role="status">
          <strong>
            {operation.kind === "move"
              ? "Move improvement"
              : "Duplicate improvement"}
          </strong>
          <p>
            {operation.kind === "move"
              ? "No extra credits. Original stays until a valid destination is chosen."
              : "Choose a new location. Cost and budget are checked before placement."}
          </p>
          <button onClick={cancelEdit}>Cancel edit</button>
        </div>
      )}
      <div className="tool-list">
        {(Object.entries(TOOLS) as [Tool, (typeof TOOLS)[Tool]][]).map(
          ([id, t]) => (
            <button
              key={id}
              className={`tool-card ${tool === id ? "chosen" : ""}`}
              onClick={() => chooseTool(id)}
            >
              <span className="tool-symbol" style={{ color: t.color }}>
                {id === "garden" ? (
                  <Leaf />
                ) : id === "basin" ? (
                  <Waves />
                ) : id === "drain" ? (
                  <Droplets />
                ) : (
                  <Layers />
                )}
              </span>
              <strong>
                {t.name}
                <small>
                  {t.cost} credits · {t.radius * 10} m radius
                </small>
              </strong>
              <Plus size={15} />
              <p>{t.description}</p>
            </button>
          ),
        )}
      </div>
      <div className="section-label">
        02 / PLACED IMPROVEMENTS
        <button
          aria-label="Undo last intervention change"
          disabled={!canUndo}
          className="icon-button"
          onClick={() => undoEdit("undo")}
        >
          <RotateCcw size={14} />
        </button>
        <button
          disabled={!canRedo}
          onClick={() => undoEdit("redo")}
          aria-label="Redo intervention change"
          className="redo-edit"
        >
          Redo
        </button>
      </div>
      {s.interventions.length === 0 ? (
        <p className="empty">
          Your plan starts here. Add an improvement to see what changes.
        </p>
      ) : (
        s.interventions.map((t, i) => (
          <div className="placed" key={t.id}>
            <span className="placement-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <button onClick={() => showPlacement(t)}>
              {TOOLS[t.type].name}
              <small>
                Cell {t.x}, {t.y}
              </small>
            </button>
            <button
              className="edit-placement"
              aria-label={`Move ${TOOLS[t.type].name} at ${t.x}, ${t.y}`}
              onClick={() => beginEdit("move", t)}
            >
              Move
            </button>
            <button
              className="edit-placement"
              disabled={
                s.interventions.length >= 8 ||
                cost(s.interventions) + TOOLS[t.type].cost > 100
              }
              aria-label={`Duplicate ${TOOLS[t.type].name} at ${t.x}, ${t.y}`}
              onClick={() => beginEdit("duplicate", t)}
            >
              Copy
            </button>
            <button
              aria-label={`Remove ${TOOLS[t.type].name} at ${t.x}, ${t.y}`}
              className="icon-button"
              onClick={() => remove(t.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
      <button className="coordinate-button" onClick={openLocator}>
        <LocateFixed size={15} /> Place by coordinates
      </button>
    </>
  );
}
