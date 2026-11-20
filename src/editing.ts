import {
  DISTRICT,
  type District,
  N,
  TOOLS,
  cost,
  type Intervention,
  type Tool,
} from "./engine";
export type EditOperation = { kind: "move" | "duplicate"; id: string } | null;
export function placementError(
  items: Intervention[],
  type: Tool,
  x: number,
  y: number,
  moveId?: string,
  map: District = DISTRICT,
) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= N ||
    y >= N
  )
    return "Choose a column and row from 0 to 99.";
  if ([3, 4].includes(map.kind[y * N + x]))
    return "Choose open ground or a street.";
  if (items.some((t) => t.id !== moveId && t.x === x && t.y === y))
    return "Another improvement already occupies this cell.";
  if (moveId && !items.some((t) => t.id === moveId))
    return "This improvement is no longer in the plan.";
  if (!moveId && items.length >= 8)
    return "A plan can contain up to eight improvements.";
  if (!moveId && cost(items) + TOOLS[type].cost > 100)
    return "Not enough budget for this improvement.";
  return null;
}
export function placeIntervention(
  items: Intervention[],
  type: Tool,
  x: number,
  y: number,
  newId: string,
  moveId?: string,
  map: District = DISTRICT,
) {
  const error = placementError(items, type, x, y, moveId, map);
  if (error) throw Error(error);
  return moveId
    ? items.map((t) => (t.id === moveId ? { ...t, x, y } : t))
    : [...items, { id: newId, type, x, y }];
}
export type EditHistory = { past: Intervention[][]; future: Intervention[][] };
export function recordEdit(history: EditHistory, current: Intervention[]) {
  history.past.push(current.map((t) => ({ ...t })));
  history.past = history.past.slice(-50);
  history.future = [];
}
export function travelHistory(
  history: EditHistory,
  current: Intervention[],
  direction: "undo" | "redo",
) {
  const from = direction === "undo" ? history.past : history.future;
  const to = direction === "undo" ? history.future : history.past;
  const next = from.pop();
  if (!next) return current;
  to.push(current.map((t) => ({ ...t })));
  return next;
}
