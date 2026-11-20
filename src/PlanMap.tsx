import { districtFor, TOOLS, type Scenario } from "./engine";
import { LANDMARKS } from "./impact";
export default function PlanMap({ s }: { s: Scenario }) {
  const map = districtFor(s.layout),
    palette = [
      "#52664b",
      "#a6aa96",
      "#7b8265",
      "#355c66",
      "#b5bba7",
      "#656e69",
    ];
  const paths = palette.map((_, kind) =>
    Array.from(map.kind, (v, i) =>
      v === kind ? `M${i % 100} ${Math.floor(i / 100)}h1v1h-1Z` : "",
    ).join(""),
  );
  return (
    <svg
      className="plan-map"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Placement diagram for ${s.name}, ${s.interventions.length} interventions. North at top.`}
    >
      <rect width="100" height="100" fill="#1d302b" />
      {paths.map((d, i) => (
        <path key={i} d={d} fill={palette[i]} />
      ))}
      {s.interventions.map((t) => (
        <g key={t.id}>
          <circle
            cx={t.x}
            cy={t.y}
            r={TOOLS[t.type].radius}
            fill={TOOLS[t.type].color}
            fillOpacity=".38"
            stroke={TOOLS[t.type].color}
            strokeWidth=".8"
          />
          <text
            x={t.x}
            y={t.y + 1.2}
            fontSize="4"
            textAnchor="middle"
            fill="#fff"
          >
            {t.type[0].toUpperCase()}
          </text>
        </g>
      ))}
      {LANDMARKS.map((l) => (
        <g key={l.id}>
          <circle cx={l.x} cy={l.y + 2} r="1.2" fill={l.color} />
          <text x={l.x - 2} y={l.y - 3} fontSize="3.5" fill="#fff">
            {l.short}
          </text>
        </g>
      ))}
      <text x="3" y="6" fill="#fff" fontSize="4">
        N ↑
      </text>
    </svg>
  );
}
