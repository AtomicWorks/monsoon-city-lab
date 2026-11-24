import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { type Quality, type Tier } from "./graphics";
import { ContextHelp } from "./Help";
export default function GraphicsPanel({
  quality,
  tier,
  change,
  reduced,
  toggleMotion,
  close,
}: {
  quality: Quality;
  tier: Tier;
  change: (q: Quality) => void;
  reduced: boolean;
  toggleMotion: () => void;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="graphics-dialog"
      aria-label="Graphics and atmosphere"
      onCancel={close}
    >
      <div className="modal-head">
        <span className="eyebrow">MONSOON / GRAPHICS</span>
        <button
          className="icon-button"
          aria-label="Close graphics settings"
          onClick={close}
        >
          <X />
        </button>
      </div>
      <h2>A city with atmosphere.</h2>
      <p>
        Choose the level of visual detail that feels smooth on your device.
        Simulation results stay identical.
      </p>
      <fieldset>
        <legend>Graphics quality</legend>
        {(
          [
            [
              "auto",
              "Auto",
              "Low on narrow screens or devices with four or fewer CPU cores; Balanced otherwise.",
            ],
            [
              "low",
              "Low",
              "Simple lighting, fewer raindrops and core buildings. No shadows, water ripples or splashes.",
            ],
            [
              "balanced",
              "Balanced",
              "Detailed streets, soft shadows, water ripples and a small splash pool.",
            ],
            [
              "high",
              "High",
              "Sharper shadows and rendering, with more rain and splashes. Best for capable desktops.",
            ],
          ] as const
        ).map(([id, title, detail]) => (
          <label
            className={
              quality === id ? "quality-option selected" : "quality-option"
            }
            key={id}
          >
            <input
              type="radio"
              name="graphics-quality"
              checked={quality === id}
              onChange={() => change(id)}
            />
            <span>
              <b>{title}</b>
              <small>{detail}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p role="status">
        Currently rendering: <strong>{tier}</strong>. Saved on this device.
      </p>
      <button
        className="motion-toggle"
        aria-pressed={reduced}
        onClick={toggleMotion}
      >
        {reduced ? "Reduced motion on" : "Reduced motion off"}
      </button>
      <p>
        Rain, ripples and splashes animate during playback. Lighting follows the
        selected minute even when paused. Decorative effects do not change water
        depth or flood boundaries.
      </p>
      <ContextHelp id="graphics" />
      <p>
        Comparison views cap pixel density at 1.25 and shadow maps at 1024, and
        halve the vehicle count. Shadows refresh when geometry or quality
        changes.
      </p>
    </dialog>
  );
}
