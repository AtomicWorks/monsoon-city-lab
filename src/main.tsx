import React, {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Check,
  CloudRain,
  Expand,
  Layers,
  MapPin,
  Play,
  Settings2,
  Waves,
  X,
  BookOpen,
  LocateFixed,
  Volume2,
  VolumeX,
  Clapperboard,
} from "lucide-react";
import DistrictPanel, { type Brush } from "./DistrictPanel";
import ServicePanel from "./ServicePanel";
import { type AccessLayer } from "./mobility";
import {
  placeIntervention,
  recordEdit,
  travelHistory,
  type EditOperation,
  type EditHistory,
} from "./editing";
import type { CameraBus } from "./City";
// three.js is most of the download; the panels render while it loads.
const City = lazy(() => import("./City"));
const PlanningLab = lazy(() => import("./PlanningLab"));
const sceneLoading = (
  <div className="city">
    <div className="fallback" role="status">
      Loading the 3D district…
    </div>
  </div>
);
import GraphicsPanel from "./GraphicsPanel";
import FloodInspector from "./FloodInspector";
import {
  atmosphere,
  readQuality,
  resolveQuality,
  type Quality,
} from "./graphics";
import ReleasePanel from "./ReleasePanel";
import ExperiencePanel, {
  ReplayControls,
  SharedScenarioDialog,
} from "./ExperiencePanel";
import { stormEvents, replayChapters, type StormEvent } from "./experience";
import { scenarioFromHash } from "./share";
import { summarize } from "./planning";
import { GuidedTour, HelpCenter, WelcomeGuide } from "./Help";
import { TOUR, type GuideAction } from "./guides";
import {
  LANDMARKS,
  missionScenario,
  landmarkSummary,
  recoverySummary,
  route,
  type Landmark,
} from "./impact";
import {
  DEFAULT,
  DEFAULT_PRESET,
  districtFor,
  baselineScenario,
  PRESETS,
  MODEL,
  N,
  TOOLS,
  access,
  rainfall,
  validate,
  type Intervention,
  type Result,
  type Scenario,
  type Tool,
} from "./engine";
import { UnreadableScenarioError, restore, save, writePlan } from "./storage";
import StormPanel from "./StormPanel";
import BuildPanel from "./BuildPanel";
import LocatorForm from "./LocatorForm";
import MapLegend from "./MapLegend";
import Timeline from "./Timeline";
import ResultsBar from "./ResultsBar";
import { FieldNotes, ScenarioReport } from "./StudioDialog";
import { download } from "./format";
import "./fonts/fonts.css";
import "./style.css";
import "./district.css";
function App() {
  const [brush, setBrush] = useState<Brush>({ x: 5, y: 4, kind: 0, radius: 0 });
  const [construction, setConstruction] = useState<number[]>([]);
  const [tutorial, setTutorial] = useState(false);
  const districtHistory = useRef<{ past: Scenario[]; future: Scenario[] }>({
    past: [],
    future: [],
  });
  const [layer, setLayer] = useState<AccessLayer>("water");
  const [traffic, setTraffic] = useState(true);
  const [operation, setOperation] = useState<EditOperation>(null);
  const editHistory = useRef<EditHistory>({ past: [], future: [] });
  const [graphicsOpen, setGraphicsOpen] = useState(false);
  const [quality, setQuality] = useState<Quality>(() => {
    try {
      return readQuality(localStorage.getItem("monsoon-quality"));
    } catch {
      return "auto";
    }
  });
  const [viewportWidth, setViewportWidth] = useState(innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(innerWidth);
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("monsoon-quality", quality);
    } catch {}
  }, [quality]);
  const tier = resolveQuality(
    quality,
    viewportWidth,
    navigator.hardwareConcurrency,
  );
  const [s, setS] = useState<Scenario>(DEFAULT),
    [help, setHelp] = useState(false),
    [tour, setTour] = useState<number | null>(null),
    [tourCompleted, setTourCompleted] = useState(false),
    [planning, setPlanning] = useState(false),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState<
      "storm" | "build" | "missions" | "replay" | "city" | "district"
    >("missions"),
    [cine, setCine] = useState<{ step: number; paused: boolean } | null>(null),
    [shot, setShot] = useState<{
      x: number;
      y: number;
      nonce: number;
      wide: boolean;
    } | null>(null),
    [activity, setActivity] = useState(false),
    [reveal, setReveal] = useState(false),
    [revealPosition, setRevealPosition] = useState(50),
    [incoming, setIncoming] = useState<Scenario | null>(null),
    [focus, setFocus] = useState<{ landmark: Landmark; nonce: number } | null>(
      null,
    ),
    [results, setResults] = useState<{
      baseline: Result;
      improved: Result;
    } | null>(null),
    [progress, setProgress] = useState<number | null>(null),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [compare, setCompare] = useState(false),
    [difference, setDifference] = useState(false),
    [tool, setTool] = useState<Tool | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [top, setTop] = useState(false),
    [reduced, setReduced] = useState(() => {
      try {
        const preference = localStorage.getItem("monsoon-motion");
        if (preference) return preference === "reduced";
      } catch {}
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    }),
    [modal, setModal] = useState<"notes" | "report" | null>(null),
    [notice, setNotice] = useState(""),
    [saved, setSaved] = useState(false),
    [xy, setXY] = useState({ x: 62, y: 68 }),
    [locator, setLocator] = useState(false),
    [sound, setSound] = useState(false);
  const worker = useRef<Worker | null>(null),
    input = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    bus = useRef<CameraBus>({ listeners: new Set() }),
    audio = useRef<AudioContext | null>(null),
    soundGain = useRef<GainNode | null>(null),
    autosaveBlocked = useRef(false),
    pendingNotice = useRef("");
  const designMap = useMemo(() => districtFor(s.layout), [s.layout]);
  const baseScenario = useMemo(() => baselineScenario(s), [s]);
  const baseMap = useMemo(
    () => districtFor(baseScenario.layout),
    [baseScenario.layout],
  );
  const dirty =
      !!results &&
      JSON.stringify(s) !== JSON.stringify(results.improved.scenario),
    valid = results && !dirty,
    frame = valid ? results.improved.frames[index] : undefined,
    baseFrame = valid ? results.baseline.frames[index] : undefined,
    total = results?.improved.frames.length || 1;
  const delta = useMemo(() => {
    if (!difference || !frame || !baseFrame) return undefined;
    return frame.depth.map((v, i) => v - baseFrame.depth[i]);
  }, [difference, frame, baseFrame]);
  const connectivity = useMemo(
    () => (frame ? access(frame.depth, designMap) : null),
    [frame, designMap],
  );
  const events = useMemo(
    () => (valid && results ? stormEvents(results.improved) : []),
    [results, !!valid],
  );
  const weather = atmosphere(s, index, !!valid);
  const chapters = useMemo(() => replayChapters(events), [events]);
  function visitEvent(e: StormEvent) {
    setPlaying(false);
    setIndex(e.minute);
    setTool(null);
    setOperation(null);
    setSelected(null);
    setTop(false);
    const landmark = LANDMARKS.find((l) => l.id === e.landmark);
    const nonce = performance.now();
    setFocus(landmark ? { landmark, nonce } : null);
    setShot({
      x: landmark?.x ?? 50,
      y: landmark?.y ?? 50,
      nonce,
      wide: !landmark,
    });
  }
  function startReplay() {
    if (!valid || !chapters.length) return;
    setTour(null);
    setTab("replay");
    setCine({ step: 0, paused: reduced });
    visitEvent(chapters[0]);
  }
  function moveChapter(step: number) {
    if (!chapters[step]) return;
    setCine((v) => ({ step, paused: v?.paused ?? true }));
    visitEvent(chapters[step]);
  }
  useEffect(() => {
    if (!cine || cine.paused || !valid) return;
    const id = setTimeout(() => {
      if (cine.step >= chapters.length - 1) setCine({ ...cine, paused: true });
      else moveChapter(cine.step + 1);
    }, 5000);
    return () => clearTimeout(id);
  }, [cine, chapters, !!valid]);
  useEffect(() => {
    if (
      dirty ||
      progress !== null ||
      planning ||
      help ||
      modal ||
      tour !== null ||
      incoming
    )
      setCine(null);
  }, [dirty, progress, planning, help, modal, tour, incoming]);
  useEffect(() => {
    const read = () => {
      try {
        setIncoming(scenarioFromHash(location.hash));
      } catch (e) {
        setIncoming(null);
        inform(e instanceof Error ? e.message : "Invalid scenario link.");
      }
    };
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  function clearShared() {
    setIncoming(null);
    if (location.hash.startsWith("#plan="))
      history.replaceState(null, "", location.pathname + location.search);
  }
  async function adoptScenario(value: Scenario) {
    const next = validate(value);
    try {
      await writePlan({
        id: crypto.randomUUID(),
        title: `Before ${next.name}`.slice(0, 80),
        notes: "Automatically saved before loading a demo or shared scenario.",
        updated: Date.now(),
        scenario: validate(s),
        summary: valid && results ? summarize(results.improved) : undefined,
      });
    } catch {
      throw Error(
        "Could not back up your current plan. It has been kept. Export it or enable local storage before loading another scenario.",
      );
    }
    setS(next);
    setTool(null);
    setOperation(null);
    setSelected(null);
    setFocus(null);
    setShot(null);
    setCompare(false);
    setDifference(false);
    setReveal(false);
    editHistory.current = { past: [], future: [] };
    districtHistory.current = { past: [], future: [] };
    setTutorial(false);
    setConstruction([]);
    setOperation(null);
    run(next);
  }
  function applyDistrict(value: Scenario, record = true) {
    try {
      const next = validate(value);
      if (record) {
        districtHistory.current.past.push(structuredClone(s));
        districtHistory.current.past = districtHistory.current.past.slice(-30);
        districtHistory.current.future = [];
      }
      const before = districtFor(s.layout),
        after = districtFor(next.layout),
        lots = new Set<number>();
      after.kind.forEach((k, i) => {
        if (k !== before.kind[i])
          lots.add(Math.floor(i / 1000) * 10 + Math.floor((i % 100) / 10));
      });
      setConstruction([...lots]);
      setS(next);
      setPlaying(false);
      setCine(null);
      setTool(null);
      setOperation(null);
      setSelected(null);
      setFocus(null);
      setCompare(false);
      setDifference(false);
      editHistory.current = { past: [], future: [] };
      inform(
        "District updated. Run the storm to compare with the unchanged preset.",
      );
    } catch (e) {
      inform(e instanceof Error ? e.message : "Could not edit the district.");
    }
  }
  function travelDistrict(direction: "undo" | "redo") {
    if (s.challenge) return;
    const h = districtHistory.current,
      from = direction === "undo" ? h.past : h.future,
      to = direction === "undo" ? h.future : h.past,
      next = from.pop();
    if (!next) return;
    to.push(structuredClone(s));
    applyDistrict(
      { ...s, layout: next.layout, interventions: next.interventions },
      false,
    );
  }
  async function startExperiment() {
    try {
      await adoptScenario(
        validate({
          ...DEFAULT,
          name: "First green block",
          duration: 20,
          recovery: 30,
          layout: { preset: "industrial", edits: [] },
        }),
      );
      setTutorial(true);
      setBrush({ x: 5, y: 4, kind: 0, radius: 0 });
      setTab("district");
    } catch (e) {
      inform(
        e instanceof Error ? e.message : "Could not start the experiment.",
      );
    }
  }
  function inform(t: string) {
    setNotice(t);
  }
  function navigateGuide(action: GuideAction, touring = false) {
    setPlaying(false);
    setTool(null);
    setOperation(null);
    if (
      action === "missions" ||
      action === "storm" ||
      action === "build" ||
      action === "replay" ||
      action === "city" ||
      action === "district"
    )
      setTab(action);
    if (action === "compare") {
      setCompare(true);
      setDifference(false);
    }
    if (action === "planning" && !touring) setPlanning(true);
    if (action === "notes") setModal("notes");
    if (action === "graphics") {
      setCine(null);
      setGraphicsOpen(true);
    }
    if (action === "inspect") {
      setCine(null);
      setLocator(true);
    }
    if (touring) return;
    const selector =
      action === "run"
        ? '[data-guide="run"]'
        : action === "map" || action === "compare" || action === "inspect"
          ? ".map-area"
          : action === "planning"
            ? '[data-guide="planning"]'
            : ".side-scroll";
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(selector)?.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "nearest",
      }),
    );
  }
  function moveTour(step: number) {
    setTour(step);
    navigateGuide(TOUR[step].action, true);
  }
  function finishTour(finished: boolean) {
    setTour(null);
    if (finished) {
      setTourCompleted(true);
      inform(
        "You’re ready to experiment. Help & guides is always here when you need it.",
      );
      try {
        localStorage.setItem("monsoon-welcome-v4", "seen");
      } catch {}
    }
  }
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
    try {
      localStorage.setItem("monsoon-motion", reduced ? "reduced" : "full");
    } catch {}
  }, [reduced]);
  function run(value = s) {
    setCine(null);
    setNotice("");
    worker.current?.terminate();
    setPlaying(false);
    setProgress(0);
    setIndex(0);
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    // A failed run must not leave a held storage warning queued for a later one.
    const fail = (message: string) => {
      inform([pendingNotice.current, message].filter(Boolean).join(" "));
      pendingNotice.current = "";
    };
    w.onmessage = (e) => {
      if (e.data.type === "progress") setProgress(e.data.value);
      if (e.data.type === "error") {
        fail(e.data.message);
        setProgress(null);
        w.terminate();
      }
      if (e.data.type === "done") {
        setResults({ baseline: e.data.baseline, improved: e.data.improved });
        setIndex(e.data.improved.frames.length - 1);
        setProgress(null);
        // A storage warning raised before this run outranks the completion note.
        inform(
          pendingNotice.current ||
            "Rainfall and recovery complete. Inspect landmark impacts or compare designs.",
        );
        pendingNotice.current = "";
        w.terminate();
      }
    };
    w.onerror = () => {
      setProgress(null);
      fail("The simulation could not finish. Try running it again.");
      w.terminate();
    };
    w.postMessage(value);
  }
  useEffect(() => {
    let alive = true;
    restore()
      .then((v) => {
        if (!alive) return;
        const value = v || DEFAULT;
        setS(value);
        setReady(true);
        run(value);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof UnreadableScenarioError)
          pendingNotice.current = `${e.message} Starting from the default district.`;
        else {
          // The saved plan may still be there; never autosave over a record
          // that could not be read.
          autosaveBlocked.current = true;
          pendingNotice.current =
            "Local storage is unavailable. You can still export your scenario.";
        }
        setReady(true);
        run(DEFAULT);
      });
    return () => {
      alive = false;
      worker.current?.terminate();
      audio.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!ready || autosaveBlocked.current) return;
    setSaved(false);
    const id = setTimeout(() => {
      save(s)
        .then(() => setSaved(true))
        .catch(() =>
          inform("Autosave unavailable. Export your scenario to keep it."),
        );
    }, 600);
    return () => clearTimeout(id);
  }, [s, ready]);
  useEffect(() => {
    if (!playing || !valid) return;
    const id = setInterval(
      () =>
        setIndex((i) => {
          if (i >= total - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      700 / speed,
    );
    return () => clearInterval(id);
  }, [playing, speed, total, valid]);
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    if (!modal && dialog.current?.open) dialog.current.close();
  }, [modal]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (soundGain.current && audio.current)
      soundGain.current.gain.setTargetAtTime(
        sound && playing && index < s.duration ? 0.12 : 0,
        audio.current.currentTime,
        0.4,
      );
  }, [sound, playing, index, s.duration]);
  async function startMission(id: NonNullable<Scenario["challenge"]>) {
    try {
      if (!s.challenge) await save(s, "sandbox");
    } catch {
      inform(
        "Could not preserve your sandbox. Export it before starting a challenge.",
      );
      return;
    }
    const value = missionScenario(id);
    setS(value);
    setTool(null);
    setOperation(null);
    setSelected(null);
    editHistory.current = { past: [], future: [] };
    districtHistory.current = { past: [], future: [] };
    setTutorial(false);
    setConstruction([]);
    setOperation(null);
    setCompare(false);
    setFocus({
      landmark: LANDMARKS.find((l) => l.id === id) ?? LANDMARKS[0],
      nonce: Date.now(),
    });
    run(value);
  }
  async function exitMission() {
    try {
      const value =
        (await restore("sandbox").catch((e) => {
          if (!(e instanceof UnreadableScenarioError)) throw e;
          pendingNotice.current = `${e.message} Returning to the default district.`;
          return null;
        })) || DEFAULT;
      setS(value);
      setFocus(null);
      setTool(null);
      setOperation(null);
      editHistory.current = { past: [], future: [] };
      districtHistory.current = { past: [], future: [] };
      setTutorial(false);
      setConstruction([]);
      setOperation(null);
      run(value);
    } catch {
      inform(
        "Could not restore the sandbox. Your current challenge is preserved.",
      );
    }
  }
  function focusLandmark(l: Landmark) {
    setFocus({ landmark: l, nonce: Date.now() });
    setSelected(null);
    setTool(null);
    setOperation(null);
  }
  const routes = useMemo(() => {
    if (!focus) return { a: [], b: [], connected: false };
    const dry = new Float32Array(N * N);
    const b = frame ? route(frame.depth, focus.landmark, false, designMap) : [];
    const a = baseFrame
      ? route(baseFrame.depth, focus.landmark, false, baseMap)
      : [];
    return {
      a: a.length ? a : route(dry, focus.landmark, true, baseMap),
      b: b.length ? b : route(dry, focus.landmark, true, designMap),
      connected: !!b.length,
      baseConnected: !!a.length,
    };
  }, [focus, frame, baseFrame, designMap, baseMap]);
  function change(p: Partial<Scenario>) {
    setCine(null);
    setPlaying(false);
    setS((v) => ({
      ...v,
      ...p,
      challenge: Object.keys(p).some((k) =>
        [
          "storm",
          "duration",
          "intensity",
          "blockage",
          "outlet",
          "recovery",
          "infiltrationFactor",
        ].includes(k),
      )
        ? undefined
        : v.challenge,
    }));
  }
  function commitInterventions(next: Intervention[]) {
    districtHistory.current = { past: [], future: [] };
    recordEdit(editHistory.current, s.interventions);
    change({ interventions: next });
  }
  function undoEdit(direction: "undo" | "redo") {
    setTool(null);
    setOperation(null);
    change({
      interventions: travelHistory(
        editHistory.current,
        s.interventions,
        direction,
      ),
    });
  }
  function beginEdit(kind: "move" | "duplicate", item: Intervention) {
    setPlaying(false);
    setCine(null);
    setTab("build");
    setCompare(false);
    setTool(item.type);
    setOperation({ kind, id: item.id });
    setSelected(item.y * N + item.x);
    setXY({ x: item.x, y: item.y });
    setLocator(true);
  }
  function select(x: number, y: number) {
    if (tab === "district") {
      setBrush((v) => ({ ...v, x: Math.floor(x / 10), y: Math.floor(y / 10) }));
      return;
    }
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= N ||
      y >= N
    ) {
      inform("Choose coordinates from 0 to 99.");
      return;
    }
    setXY({ x, y });
    if (!tool) {
      const landmark =
        layer === "services"
          ? LANDMARKS.find(
              (l) => Math.abs(l.x - x) <= 2 && Math.abs(l.y - y) <= 2,
            )
          : undefined;
      if (landmark) {
        focusLandmark(landmark);
        return;
      }
      setSelected(y * N + x);
      return;
    }
    try {
      const next = placeIntervention(
        s.interventions,
        tool,
        x,
        y,
        crypto.randomUUID(),
        operation?.kind === "move" ? operation.id : undefined,
        designMap,
      );
      commitInterventions(next);
      setSelected(y * N + x);
      inform(
        operation?.kind === "move"
          ? "Improvement moved. Run again to update results."
          : operation?.kind === "duplicate"
            ? "Improvement duplicated. Run again to update results."
            : TOOLS[tool].name + " added. Run again to evaluate.",
      );
      if (operation) {
        setTool(null);
        setOperation(null);
      }
    } catch (e) {
      inform(e instanceof Error ? e.message : "Could not edit this plan.");
    }
  }
  function remove(id: string) {
    commitInterventions(s.interventions.filter((t) => t.id !== id));
    setOperation(null);
    setTool(null);
  }
  function seek(minute: number) {
    setPlaying(false);
    setCine(null);
    setShot(null);
    setIndex(minute);
  }
  function togglePlayback() {
    setCine(null);
    setShot(null);
    if (!valid) return;
    if (index === total - 1) setIndex(0);
    setPlaying((p) => !p);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('input,textarea,select,[contenteditable="true"],dialog')
      )
        return;
      if (e.key === "Escape" && tool) {
        setTool(null);
        setOperation(null);
        setLocator(false);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const direction =
        e.key.toLowerCase() === "y" ||
        (e.key.toLowerCase() === "z" && e.shiftKey)
          ? "redo"
          : e.key.toLowerCase() === "z"
            ? "undo"
            : null;
      if (direction) {
        e.preventDefault();
        tab === "district" ? travelDistrict(direction) : undoEdit(direction);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [s, tool, tab]);
  async function toggleSound() {
    if (!audio.current) {
      const ctx = new AudioContext(),
        buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * 0.3;
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = "lowpass";
      filter.frequency.value = 1100;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      audio.current = ctx;
      soundGain.current = gain;
    }
    await audio.current.resume();
    setSound((v) => !v);
  }
  const m = frame?.metrics,
    bm = baseFrame?.metrics;
  const reduction =
    m && bm && bm.flooded ? ((bm.flooded - m.flooded) / bm.flooded) * 100 : 0;
  const exportReport = () => {
    if (!valid) return;
    const r = {
      title: "MONSOON scenario report",
      model: MODEL,
      scenario: s,
      assumptions:
        "Fictional district; simplified conservative surface flow; closed edges; bounded shared drainage outlet; 0.10 m flood threshold; 0.15 m road disruption threshold. Educational model, uncalibrated.",
      baseline: results.baseline.frames.at(-1)?.metrics,
      improved: results.improved.frames.at(-1)?.metrics,
      rainfallEnd: {
        baseline: results.baseline.frames[s.duration]?.metrics,
        improved: results.improved.frames[s.duration]?.metrics,
      },
      recovery: recoverySummary(results.improved),
      landmarks: LANDMARKS.map((l) => ({
        baseline: landmarkSummary(results.baseline, l),
        improved: landmarkSummary(results.improved, l),
      })),
      simulationMilliseconds: results.improved.elapsed,
      roadConnectivityPercent: access(
        results.improved.frames.at(-1)!.depth,
        designMap,
      ),
    };
    download("monsoon-report.json", JSON.stringify(r, null, 2));
    inform("Report exported with model assumptions and measured results.");
  };
  // Props shared by the single view and both comparison views.
  const sceneProps = {
    districtBrush: tab === "district" && !s.challenge ? brush : null,
    comparison: compare,
    layer,
    traffic,
    minute: index,
    moveId: operation?.kind === "move" ? operation.id : undefined,
    placementItems: s.interventions,
    preview: locator && tool ? xy : null,
    quality: tier,
    weather,
    activity,
    animateActivity: playing || (!!cine && !cine.paused),
    shot,
    select,
    selected,
    rain: playing || (cine && !cine.paused) ? rainfall(s, index * 60) : 0,
    reduced,
    top,
    bus: bus.current,
    placing: !!tool || tab === "district",
    tool,
    focus,
  };
  return (
    <div className={`app ${tour !== null ? "tour-active" : ""}`}>
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="MONSOON home"
        >
          <span className="brand-icon">
            <Waves size={25} />
          </span>
          <span>
            MONSOON<small>CITY RESILIENCE LAB</small>
          </span>
        </a>
        <nav aria-label="Workspace">
          <button
            className={!compare ? "nav-active" : ""}
            onClick={() => {
              setCompare(false);
              setDifference(false);
            }}
          >
            Design studio
          </button>
          <button
            className={compare ? "nav-active" : ""}
            onClick={() => setCompare(true)}
          >
            Compare scenarios
          </button>
          <button
            onClick={() => {
              setTour(null);
              setHelp(true);
            }}
          >
            Help & guides <BookOpen size={13} />
          </button>
          <button
            className="planning-entry"
            data-guide="planning"
            onClick={() => {
              setPlaying(false);
              setPlanning(true);
            }}
          >
            Planning lab <ArrowUpRight size={13} />
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setCine(null);
              setGraphicsOpen(true);
            }}
          >
            Graphics <Settings2 size={13} />
          </button>
        </nav>
        <div className="header-actions">
          <span className="save-state">
            <span className={saved ? "dot" : "dot waiting"} />
            {saved ? "Saved on this device" : "Saving locally"}
          </span>
          <button
            className="icon-button"
            title="Import scenario"
            aria-label="Import scenario"
            onClick={() => input.current?.click()}
          >
            <ArrowUpFromLine size={17} />
          </button>
          <button
            className="export"
            onClick={() => {
              download("monsoon-scenario.json", JSON.stringify(s, null, 2));
              inform("Scenario exported.");
            }}
          >
            <ArrowDownToLine size={15} /> Export
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="district-card">
            <div className="eyebrow">
              <span className="dot" /> FICTIONAL DISTRICT / 01
            </div>
            <h1>
              {PRESETS[s.layout?.preset ?? DEFAULT_PRESET].name}
              <span>বাংলা কোয়ার্টার</span>
            </h1>
            <p>
              A neighborhood. A storm.
              <br />A different possible future.
            </p>
            <div className="district-meta">
              <span>1.00 km²</span>
              <span>10 m resolution</span>
              <span>BD-inspired</span>
            </div>
          </div>
          <div className="side-tabs" data-guide="missions">
            <button
              className={tab === "missions" ? "active" : ""}
              onClick={() => {
                setTab("missions");
                setTool(null);
                setOperation(null);
              }}
            >
              <BookOpen size={15} /> Missions
            </button>
            <button
              className={tab === "storm" ? "active" : ""}
              onClick={() => {
                setTab("storm");
                setTool(null);
                setOperation(null);
              }}
            >
              <CloudRain size={16} /> Storm
            </button>
            <button
              className={tab === "build" ? "active" : ""}
              onClick={() => setTab("build")}
            >
              <Layers size={16} /> Build
              <span>{s.interventions.length}</span>
            </button>
            <button
              className={tab === "replay" ? "active" : ""}
              onClick={() => {
                setTab("replay");
                setTool(null);
                setOperation(null);
              }}
            >
              <Clapperboard size={15} />
              Replay
            </button>
            <button
              className={tab === "city" ? "active" : ""}
              onClick={() => {
                setTab("city");
                setTool(null);
                setOperation(null);
              }}
            >
              City
            </button>
            <button
              className={tab === "district" ? "active" : ""}
              onClick={() => {
                setTab("district");
                setTool(null);
                setOperation(null);
                setCompare(false);
                setSelected(null);
                setFocus(null);
              }}
            >
              District
            </button>
          </div>
          <div className="side-scroll" data-guide="controls" key={tab}>
            {tab === "district" ? (
              <DistrictPanel
                key={s.challenge ?? "sandbox"}
                s={s}
                brush={brush}
                setBrush={setBrush}
                apply={applyDistrict}
                undo={() => travelDistrict("undo")}
                redo={() => travelDistrict("redo")}
                canUndo={!!districtHistory.current.past.length}
                canRedo={!!districtHistory.current.future.length}
                exitMission={exitMission}
                tutorial={tutorial}
                startTutorial={startExperiment}
                endTutorial={() => setTutorial(false)}
                results={valid ? results : null}
                run={() => run()}
                compare={() => {
                  setCompare(true);
                  setTab("city");
                }}
              />
            ) : tab === "city" ? (
              <ServicePanel
                layout={s.layout}
                layer={layer}
                change={setLayer}
                traffic={traffic}
                toggleTraffic={() => setTraffic((v) => !v)}
                frame={frame}
                focus={focusLandmark}
                playing={playing || (!!cine && !cine.paused)}
                reduced={reduced}
              />
            ) : tab === "missions" ? (
              <>
                <WelcomeGuide
                  finished={tourCompleted}
                  start={() => moveTour(0)}
                  help={() => setHelp(true)}
                />
                <ReleasePanel
                  s={s}
                  results={valid ? results : null}
                  frame={frame}
                  start={startMission}
                  exit={exitMission}
                  focus={focusLandmark}
                  build={() => setTab("build")}
                  compare={() => setCompare(true)}
                />
              </>
            ) : tab === "replay" ? (
              <ExperiencePanel
                s={s}
                results={valid ? results : null}
                events={events}
                minute={index}
                jump={(e) => {
                  setCine(null);
                  visitEvent(e);
                }}
                replay={startReplay}
                load={adoptScenario}
                busy={!ready || progress !== null}
              />
            ) : tab === "storm" ? (
              <StormPanel s={s} change={change} />
            ) : (
              <BuildPanel
                s={s}
                tool={tool}
                operation={operation}
                canUndo={!!editHistory.current.past.length}
                canRedo={!!editHistory.current.future.length}
                cancelEdit={() => {
                  setOperation(null);
                  setTool(null);
                  setLocator(false);
                }}
                chooseTool={(id) => {
                  setOperation(null);
                  setLocator(false);
                  setTool((v) => (v === id ? null : id));
                }}
                undoEdit={undoEdit}
                showPlacement={(t) => {
                  setSelected(t.y * N + t.x);
                  setXY({ x: t.x, y: t.y });
                }}
                beginEdit={beginEdit}
                remove={remove}
                openLocator={() => setLocator(true)}
              />
            )}
          </div>
          <div className="run-area" data-guide="run">
            <p className="next-action" role="status">
              {progress !== null
                ? "Calculating rainfall and recovery…"
                : dirty
                  ? "Your plan changed. Run again to update the results."
                  : !s.interventions.length && !s.layout?.edits.length
                    ? "Next: add one improvement, then run and compare."
                    : valid
                      ? "Results ready. Compare your design or replay the storm."
                      : "Run your plan to see what changes."}
            </p>
            {progress === null ? (
              <button className="run" onClick={() => run()}>
                <Play size={17} fill="currentColor" /> Run storm
                <ArrowUpRight size={18} />
              </button>
            ) : (
              <button
                className="run running"
                onClick={() => {
                  worker.current?.terminate();
                  setProgress(null);
                  inform("Simulation cancelled.");
                }}
              >
                <span className="spinner" /> Simulating{" "}
                {Math.round(progress * 100)}%<X size={17} />
              </button>
            )}
            <span className="model-caption">
              SIMPLIFIED MODEL · {MODEL.toUpperCase()}
            </span>
          </div>
        </aside>
        <main className="main">
          <section
            data-layer={layer}
            className="map-area"
            data-guide="comparison"
            aria-label="Neighborhood simulator"
          >
            <div className="map-heading">
              <div className="eyebrow">
                THE DESIGN STUDIO <span>/</span>{" "}
                {PRESETS[s.layout?.preset ?? DEFAULT_PRESET].name.toUpperCase()}
              </div>
              <h2>
                {compare
                  ? "One storm. Two futures."
                  : "Make room for the rain."}
              </h2>
              <p>
                {tool
                  ? `${operation?.kind === "move" ? "Move" : operation?.kind === "duplicate" ? "Copy" : "Place"} ${TOOLS[tool].name.toLowerCase()} · choose a destination`
                  : weather.label +
                    " · " +
                    weather.rain.toFixed(1) +
                    " mm/h at this minute"}
              </p>
            </div>
            <div className="map-status">
              <span className="dot" />
              {progress !== null
                ? "COMPUTING"
                : dirty
                  ? "PLAN CHANGED · RERUN"
                  : valid
                    ? "SIMULATION READY"
                    : "PREPARING DISTRICT"}
            </div>
            <div
              className={`map-canvases ${compare ? "split" : ""} ${compare && reveal ? "reveal" : ""}`}
            >
              <div className="map-view">
                <Suspense fallback={sceneLoading}>
                  <City
                    layout={compare ? baseScenario.layout : s.layout}
                    construction={compare ? [] : construction}
                    {...sceneProps}
                    draining={compare ? baseFrame?.draining : frame?.draining}
                    depth={compare ? baseFrame?.depth : frame?.depth}
                    difference={!compare ? delta : undefined}
                    items={compare ? [] : s.interventions}
                    route={compare ? routes.a : routes.b}
                    connected={
                      compare ? !!routes.baseConnected : routes.connected
                    }
                  />
                </Suspense>
                {compare && <span className="view-label">A / BASELINE</span>}
              </div>
              {compare && (
                <div
                  className="map-view"
                  style={
                    reveal
                      ? { clipPath: `inset(0 0 0 ${revealPosition}%)` }
                      : undefined
                  }
                >
                  <Suspense fallback={sceneLoading}>
                    <City
                      layout={s.layout}
                      construction={construction}
                      {...sceneProps}
                      draining={frame?.draining}
                      depth={frame?.depth}
                      items={s.interventions}
                      route={routes.b}
                      connected={routes.connected}
                    />
                  </Suspense>
                  <span className="view-label improved">B / YOUR DESIGN</span>
                </div>
              )}
              {compare && reveal && (
                <div
                  className="reveal-divider"
                  style={{ left: `${revealPosition}%` }}
                  aria-hidden="true"
                >
                  <span>↔</span>
                </div>
              )}
            </div>
            <div className="experience-map-actions">
              <button
                aria-pressed={tab === "city"}
                onClick={() => {
                  setTab("city");
                  setTool(null);
                  setOperation(null);
                }}
              >
                City life
              </button>
              <button
                onClick={() => {
                  setTab("replay");
                  setTool(null);
                  setOperation(null);
                }}
              >
                <Clapperboard size={14} />
                Storm stories
              </button>
              <button
                aria-pressed={activity}
                disabled={!valid}
                onClick={() => setActivity((v) => !v)}
              >
                Activity overlay {activity ? "on" : "off"}
              </button>
              {compare && (
                <button
                  aria-pressed={reveal}
                  onClick={() => setReveal((v) => !v)}
                >
                  {reveal ? "Reveal slider" : "Side by side"}
                </button>
              )}
            </div>
            {compare && reveal && (
              <label className="reveal-control">
                Baseline{" "}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={revealPosition}
                  aria-label="Before and after reveal position"
                  onChange={(e) => setRevealPosition(+e.target.value)}
                />{" "}
                Your design
              </label>
            )}
            {activity && valid && !difference && (
              <div className="activity-legend">
                <span>
                  ↗ Surface-level direction · illustrative, not velocity
                </span>
                <span>
                  — Flood edge above 10 cm · ● Drains active in previous minute
                </span>
              </div>
            )}
            {cine && valid && (
              <ReplayControls
                events={chapters}
                step={cine.step}
                paused={cine.paused}
                reduced={reduced}
                move={moveChapter}
                toggle={() =>
                  setCine((v) => (v ? { ...v, paused: !v.paused } : v))
                }
                stop={() => {
                  setCine(null);
                  setShot(null);
                }}
              />
            )}
            {focus && (
              <div className="focus-banner">
                <MapPin size={13} />
                <span>
                  {focus.landmark.name} ·{" "}
                  {valid
                    ? routes.connected
                      ? "Access connected · green route"
                      : "Access interrupted · red reference route"
                    : "Run to evaluate access"}
                </span>
                <button
                  aria-label="Clear landmark focus"
                  onClick={() => setFocus(null)}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="map-tools">
              <button
                title="Explain map controls"
                aria-label="Explain map controls"
                onClick={() => {
                  setTour(null);
                  setHelp(true);
                }}
              >
                <BookOpen size={18} />
              </button>
              <button
                title="Landmark impacts"
                aria-label="Landmark impacts"
                onClick={() => {
                  setTab("missions");
                  focusLandmark(LANDMARKS[0]);
                }}
              >
                <MapPin size={18} />
              </button>
              <button
                title="Toggle top-down view"
                aria-label="Toggle top-down view"
                aria-pressed={top}
                onClick={() => setTop((v) => !v)}
              >
                <Expand size={18} />
              </button>
              <button
                title="Inspect coordinates"
                aria-label="Inspect coordinates"
                aria-pressed={locator}
                onClick={() => setLocator((v) => !v)}
              >
                <LocateFixed size={18} />
              </button>
              <button
                title="Toggle difference map"
                aria-label="Toggle difference map"
                aria-pressed={difference}
                onClick={() => {
                  setDifference((v) => !v);
                  setCompare(false);
                }}
              >
                <Layers size={18} />
              </button>
              <button
                title="Reduce animation effects"
                aria-label="Reduce animation effects"
                aria-pressed={reduced}
                onClick={() => setReduced((v) => !v)}
              >
                <Settings2 size={18} />
              </button>
              <button
                title="Toggle rain audio during playback"
                aria-label="Toggle rain audio during playback"
                aria-pressed={sound}
                onClick={toggleSound}
              >
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>
            {locator && (
              <LocatorForm
                s={s}
                tool={tool}
                operation={operation}
                xy={xy}
                setXY={setXY}
                designMap={designMap}
                submit={() => {
                  select(xy.x, xy.y);
                  setLocator(false);
                }}
              />
            )}
            {selected !== null && !locator && (
              <FloodInspector
                s={s}
                frame={frame}
                result={valid ? results.improved : undefined}
                selected={selected}
                close={() => setSelected(null)}
              />
            )}
            <MapLegend layer={layer} difference={difference} />
            {progress !== null && (
              <div className="progress-line">
                <i style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </section>
          <Timeline
            s={s}
            valid={!!valid}
            index={index}
            total={total}
            playing={playing}
            speed={speed}
            togglePlayback={togglePlayback}
            seek={seek}
            cycleSpeed={() => setSpeed((v) => (v === 1 ? 2 : v === 2 ? 4 : 1))}
            openReport={() => setModal("report")}
          />
          <ResultsBar
            key={results?.improved.elapsed ?? "empty"}
            m={m}
            reduction={reduction}
            connectivity={connectivity}
            hasInterventions={s.interventions.length > 0}
          />
          <footer className="footer">
            <span>
              <span className="dot" /> EXPERIMENT. OBSERVE. ADAPT.
            </span>
            <button onClick={() => setModal("notes")}>
              Educational model · Read the assumptions{" "}
              <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 100000) throw Error("Scenario file is too large.");
            const value = validate(JSON.parse(await f.text()));
            worker.current?.terminate();
            setProgress(null);
            setTool(null);
            setOperation(null);
            editHistory.current = { past: [], future: [] };
            districtHistory.current = { past: [], future: [] };
            setTutorial(false);
            setConstruction([]);
            setOperation(null);
            setPlaying(false);
            setS(value);
            inform("Scenario imported. Run the storm to see its results.");
          } catch (err) {
            inform(
              err instanceof Error ? err.message : "Could not import scenario.",
            );
          }
          e.target.value = "";
        }}
      />
      <div
        className="toast"
        role="status"
        aria-live="polite"
        data-visible={!!notice}
      >
        <Check size={15} />
        {notice}
      </div>
      {planning && (
        <Suspense fallback={null}>
          <PlanningLab
            s={s}
            results={valid ? results : null}
            close={() => setPlanning(false)}
            apply={(value) => {
              setS(value);
              setTool(null);
              setOperation(null);
              setSelected(null);
              editHistory.current = { past: [], future: [] };
              districtHistory.current = { past: [], future: [] };
              setTutorial(false);
              setConstruction([]);
              setOperation(null);
              setCompare(true);
              setDifference(false);
              run(value);
            }}
          />
        </Suspense>
      )}
      {incoming && ready && (
        <SharedScenarioDialog
          s={incoming}
          dismiss={clearShared}
          accept={async () => {
            await adoptScenario(incoming);
            clearShared();
          }}
        />
      )}
      {graphicsOpen && (
        <GraphicsPanel
          quality={quality}
          tier={tier}
          change={setQuality}
          reduced={reduced}
          toggleMotion={() => setReduced((v) => !v)}
          close={() => setGraphicsOpen(false)}
        />
      )}
      {help && (
        <HelpCenter
          close={() => setHelp(false)}
          navigate={navigateGuide}
          startTour={() => moveTour(0)}
          reduced={reduced}
          toggleMotion={() => setReduced((v) => !v)}
        />
      )}
      {tour !== null && !planning && !help && !modal && (
        <GuidedTour
          step={tour}
          move={moveTour}
          close={finishTour}
          reduced={reduced}
        />
      )}
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="modal-head">
          <span className="eyebrow">
            MONSOON / {modal === "notes" ? "FIELD NOTES" : "SCENARIO REPORT"}
          </span>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={() => setModal(null)}
          >
            <X />
          </button>
        </div>
        {modal === "notes" ? (
          <FieldNotes />
        ) : (
          valid && (
            <ScenarioReport
              s={s}
              results={results}
              exportReport={exportReport}
            />
          )
        )}
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
