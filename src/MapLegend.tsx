import type { AccessLayer } from "./mobility";

/** Legends and scale shown along the bottom of the map. */
export default function MapLegend({
  layer,
  difference,
}: {
  layer: AccessLayer;
  difference: boolean;
}) {
  return (
    <div className="map-bottom">
      {layer !== "water" && (
        <div className="mobility-legend">
          <b>{layer === "roads" ? "ROAD ACCESS" : "SERVICE ACCESS"}</b>
          <span>
            {layer === "roads"
              ? "Green: connected · Amber: dry, disconnected · Coral: flooded"
              : "Green: open route · Coral: interrupted reference route"}
          </span>
          <small>
            {layer === "services"
              ? "Click the clinic, school or market to trace its route."
              : "Access to northern boundary · 15 cm closure threshold"}
          </small>
        </div>
      )}
      <div className="depth-legend">
        <span>
          {difference ? "CHANGE IN WATER DEPTH" : "SURFACE WATER DEPTH"}
        </span>
        <div className={difference ? "gradient difference" : "gradient"} />
        <div>
          {difference ? (
            <>
              <span>Less water</span>
              <span>More water</span>
            </>
          ) : (
            <>
              <span>0 cm</span>
              <span>10</span>
              <span>20+</span>
            </>
          )}
        </div>
      </div>
      <div className="map-scale">
        <span>1 km × 1 km district</span>
        <small>Drag to orbit · Scroll to zoom</small>
      </div>
    </div>
  );
}
