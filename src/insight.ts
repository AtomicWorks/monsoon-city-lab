import {
  CELL,
  districtFor,
  N,
  TOOLS,
  hydraulicFields,
  rainfall,
  type Frame,
  type Scenario,
} from "./engine";
export function inspectCell(
  s: Scenario,
  frame: Frame | undefined,
  selected: number,
  fields = hydraulicFields(s),
) {
  const DISTRICT = districtFor(s.layout);
  const i = DISTRICT.roof[selected] >= 0 ? DISTRICT.roof[selected] : selected;
  const x = i % N,
    y = Math.floor(i / N),
    depth = frame?.depth[i];
  const rate = fields.rate[i] * 3600000 * (s.infiltrationFactor ?? 1);
  const capacity = fields.capacity[i] * 1000;
  const used = frame?.soilUsed ? frame.soilUsed[i] * 1000 : undefined;
  const neighbors = [
    x > 0 ? i - 1 : -1,
    x < N - 1 ? i + 1 : -1,
    y > 0 ? i - N : -1,
    y < N - 1 ? i + N : -1,
  ].filter((j) => j >= 0 && DISTRICT.kind[j] !== 4);
  const below = neighbors.filter(
    (j) => fields.z[j] > fields.z[i] + 0.001,
  ).length;
  let nearest = -1,
    distance = Infinity;
  fields.intake.forEach((v, j) => {
    if (v <= 0) return;
    const dist = Math.hypot((j % N) - x, Math.floor(j / N) - y) * CELL;
    if (dist < distance) {
      distance = dist;
      nearest = j;
    }
  });
  const covered = s.interventions.filter(
    (t) => Math.hypot(t.x - x, t.y - y) <= TOOLS[t.type].radius,
  );
  const notes: string[] = [];
  if (i !== selected)
    notes.push(
      "This building sends its roof runoff to the adjacent ground cell shown here.",
    );
  if (!frame)
    notes.push(
      "Run this design to inspect water and soil at a recorded minute.",
    );
  else {
    notes.push(
      depth! > 0.1
        ? "Water is above the model’s 10 cm flood threshold here."
        : depth! > 0.006
          ? "Some surface water is present, below the 10 cm flood threshold."
          : "This cell is effectively dry at the selected minute.",
    );
    if (rainfall(s, frame.metrics.time) === 0)
      notes.push(
        "No rain is falling at this minute; any remaining surface water can still redistribute, soak in or drain.",
      );
  }
  if (below)
    notes.push(
      "Ground here is lower than " +
        below +
        " adjacent open cell" +
        (below === 1 ? "" : "s") +
        ". This can favour accumulation; it does not prove where the water came from.",
    );
  if (rate === 0)
    notes.push(
      "Soil absorption is disabled or the surface is sealed. Its nominal soil capacity cannot be used.",
    );
  else if (used !== undefined && capacity - used < 0.1)
    notes.push(
      "The finite soil storage is full, so it cannot absorb more water during this run.",
    );
  else
    notes.push(
      "Soil can absorb up to " +
        rate.toFixed(1) +
        " mm/h while water and soil capacity are available.",
    );
  if (s.outlet === 0)
    notes.push("The shared outlet is closed, so no drain can discharge.");
  else if (s.blockage === 100)
    notes.push("All intakes are blocked, so drains cannot discharge.");
  else if (fields.intake[i] > 0)
    notes.push(
      "This cell has an intake. Blockage reduces it and the district’s shared outlet can limit discharge.",
    );
  else
    notes.push(
      "No intake is located in this cell. Water must reach a drain through the surface model; proximity alone does not establish a connection.",
    );
  return {
    i,
    x,
    y,
    depth,
    elevation: fields.z[i],
    rate,
    capacity,
    used,
    remaining: used === undefined ? undefined : Math.max(0, capacity - used),
    nearest,
    distance,
    covered,
    notes,
    active: !!frame?.draining?.includes(i),
  };
}
