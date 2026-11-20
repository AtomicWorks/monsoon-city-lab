import { useMemo } from "react";
import { mobility, type AccessLayer } from "./mobility";
import { LANDMARKS, type Landmark } from "./impact";
import { districtFor, type Layout, type Frame } from "./engine";
import { ContextHelp } from "./Help";
export default function ServicePanel({
  layout,
  layer,
  change,
  traffic,
  toggleTraffic,
  frame,
  focus,
  playing,
  reduced,
}: {
  layout?: Layout;
  layer: AccessLayer;
  change: (v: AccessLayer) => void;
  traffic: boolean;
  toggleTraffic: () => void;
  frame?: Frame;
  focus: (l: Landmark) => void;
  playing: boolean;
  reduced: boolean;
}) {
  const graph = useMemo(
    () => (frame ? mobility(frame.depth, districtFor(layout)) : null),
    [frame, layout],
  );
  return (
    <div className="service-panel">
      <span className="release-kicker">RELEASE 08 / SHAPE THE CITY</span>
      <h2 className="mission-heading">
        Life follows
        <br />
        the open roads.
      </h2>
      <p className="side-intro">
        See which streets and essential places remain connected at the selected
        minute.
      </p>
      <label className="layer-picker">
        Map layer
        <select
          value={layer}
          onChange={(e) => change(e.target.value as AccessLayer)}
        >
          <option value="water">Water depth</option>
          <option value="roads">Road accessibility</option>
          <option value="services">Service access</option>
        </select>
      </label>
      <button
        className="traffic-toggle"
        aria-pressed={traffic}
        onClick={toggleTraffic}
      >
        Illustrative traffic {traffic ? "on" : "off"}
      </button>
      <p className="motion-caption">
        {!frame
          ? "Run this design to show access."
          : !traffic
            ? "Traffic hidden."
            : reduced
              ? "Reduced motion · stationary vehicle markers."
              : playing
                ? "Simulation playing · illustrative traffic moving."
                : "Simulation paused · traffic is stationary."}
      </p>
      <ContextHelp id="mobility" />
      <div className="service-key">
        <span>● Green: connected to northern boundary</span>
        <span>
          {layer === "services"
            ? "Coral route: access interrupted"
            : "● Amber: dry, but disconnected"}
        </span>
        <span>
          {layer === "services"
            ? "Coral square: first flooded reference-route cell"
            : "● Coral: deeper than 15 cm"}
        </span>
      </div>
      {LANDMARKS.map((l, i) => (
        <button
          className={
            "service-card " +
            (graph?.services[i].connected ? "connected" : "disconnected")
          }
          key={l.id}
          onClick={() => {
            change("services");
            focus(l);
          }}
        >
          <span>{l.name}</span>
          <strong>
            {!graph
              ? "Run to evaluate"
              : graph.services[i].connected
                ? "Connected"
                : "Access interrupted"}
          </strong>
          <small>
            {!graph
              ? "Awaiting results"
              : graph.services[i].connected
                ? "Trace the open route"
                : !graph.services[i].path.length
                  ? "Road network disconnected by the layout"
                : "Trace the reference route and first flooded cell"}{" "}
            →
          </small>
        </button>
      ))}
      <p className="event-note">
        These cards describe your design. Comparison maps show each scenario’s
        own routes. Vehicles follow roads toward the north or south edge,
        reroute when a dry route exists, and wait at closures. Their speeds and
        trips are decorative—not traffic or evacuation predictions. Scrubbing
        resets their positions.
      </p>
    </div>
  );
}
