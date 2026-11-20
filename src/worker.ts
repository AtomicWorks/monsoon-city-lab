import { simulate, baselineScenario, type Scenario } from "./engine";
self.onmessage = (e: MessageEvent<Scenario>) => {
  try {
    const baseline = simulate(baselineScenario(e.data), (p) =>
      self.postMessage({ type: "progress", value: p * 0.5 }),
    );
    const improved =
      e.data.interventions.length || e.data.layout?.edits.length
        ? simulate(e.data, (p) =>
            self.postMessage({ type: "progress", value: 0.5 + p * 0.5 }),
          )
        : baseline;
    self.postMessage({ type: "done", baseline, improved });
  } catch (e) {
    self.postMessage({
      type: "error",
      message: e instanceof Error ? e.message : "Simulation failed",
    });
  }
};
