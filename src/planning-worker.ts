import { analyze, type Job } from "./planning";
self.onmessage = (e: MessageEvent<Job>) => {
  try {
    const result = analyze(e.data, (done, total, label) =>
      self.postMessage({ type: "progress", done, total, label }),
    );
    self.postMessage({ type: "done", result });
  } catch (e) {
    self.postMessage({
      type: "error",
      message: e instanceof Error ? e.message : "Analysis failed.",
    });
  }
};
