import type { Dispatch, SetStateAction } from "react";
import { ChevronRight } from "lucide-react";
import { placementError, type EditOperation } from "./editing";
import { TOOLS, type District, type Scenario, type Tool } from "./engine";

/** Keyboard placement and inspection by grid coordinates. */
export default function LocatorForm({
  s,
  tool,
  operation,
  xy,
  setXY,
  designMap,
  submit,
}: {
  s: Scenario;
  tool: Tool | null;
  operation: EditOperation;
  xy: { x: number; y: number };
  setXY: Dispatch<SetStateAction<{ x: number; y: number }>>;
  designMap: District;
  submit: () => void;
}) {
  return (
    <form
      className="locator"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <strong>
        {operation?.kind === "move"
          ? "Move improvement"
          : operation?.kind === "duplicate"
            ? "Duplicate improvement"
            : tool
              ? "Place improvement"
              : "Inspect a location"}
      </strong>
      <label>
        Column
        <input
          type="number"
          min="0"
          max="99"
          required
          value={xy.x}
          onChange={(e) => setXY((v) => ({ ...v, x: +e.target.value }))}
        />
      </label>
      <label>
        Row
        <input
          type="number"
          min="0"
          max="99"
          required
          value={xy.y}
          onChange={(e) => setXY((v) => ({ ...v, y: +e.target.value }))}
        />
      </label>
      {tool && (
        <p className="placement-feedback">
          {placementError(
            s.interventions,
            tool,
            xy.x,
            xy.y,
            operation?.kind === "move" ? operation.id : undefined,
            designMap,
          ) ??
            (operation?.kind === "move"
              ? "Valid destination · no extra cost"
              : `Valid destination · ${TOOLS[tool].cost} credits`)}
        </p>
      )}
      <button
        type="submit"
        disabled={
          !!tool &&
          !!placementError(
            s.interventions,
            tool,
            xy.x,
            xy.y,
            operation?.kind === "move" ? operation.id : undefined,
            designMap,
          )
        }
      >
        {operation?.kind === "move"
          ? "Move here"
          : operation?.kind === "duplicate"
            ? "Duplicate here"
            : tool
              ? "Place here"
              : "Inspect"}{" "}
        <ChevronRight size={14} />
      </button>
    </form>
  );
}
