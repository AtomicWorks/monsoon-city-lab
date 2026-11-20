import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LANDMARKS, type Landmark } from "./impact";
import type { Tool } from "./engine";
import { flowDirections, floodEdges, type FlowArrow } from "./experience";
import { QUALITY, type Tier, type atmosphere } from "./graphics";
import { cityDetails } from "./cityDetails";
import { waterMaterial } from "./waterMaterial";
import { mobilityView } from "./mobilityView";
import type { AccessLayer } from "./mobility";
import { placementError } from "./editing";
import {
  districtFor,
  protectedLot,
  type Layout,
  N,
  CELL,
  TOOLS,
  terrainFor,
  type Intervention,
} from "./engine";
export type CameraBus = {
  listeners: Set<(p: T.Vector3, t: T.Vector3) => void>;
  view?: { position: T.Vector3; target: T.Vector3 };
};
type Props = {
  layout?: Layout;
  districtBrush?: { x: number; y: number; radius: number; kind: number } | null;
  construction?: number[];
  comparison: boolean;
  layer: AccessLayer;
  traffic: boolean;
  minute: number;
  moveId?: string;
  placementItems: Intervention[];
  preview: { x: number; y: number } | null;
  quality: Tier;
  weather: ReturnType<typeof atmosphere>;
  depth?: Float32Array;
  difference?: Float32Array;
  items: Intervention[];
  select: (x: number, y: number) => void;
  selected: number | null;
  rain: number;
  reduced: boolean;
  top: boolean;
  bus: CameraBus;
  placing: boolean;
  tool: Tool | null;
  focus: { landmark: Landmark; nonce: number } | null;
  route: number[];
  connected: boolean;
  activity?: boolean;
  draining?: Uint16Array;
  animateActivity?: boolean;
  shot?: { x: number; y: number; nonce: number; wide: boolean } | null;
};
export default function City(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      return;
    }
    const DISTRICT = districtFor(props.layout);
    const el = host.current;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    // three.js 0.187 no longer has PCFSoftShadowMap and falls back to PCF.
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor("#15211d");
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.fog = new T.Fog("#15211d", 3500, 6500);
    const camera = new T.PerspectiveCamera(34, 1, 1, 5000);
    camera.position.set(1030, 1120, 1120);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.minDistance = 550;
    controls.maxDistance = 4500;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.enablePan = true;
    const sky = new T.HemisphereLight("#d5f0df", "#39412e", 2);
    scene.add(sky);
    const sun = new T.DirectionalLight("#ffe8bc", 3.1);
    sun.position.set(-400, 1000, -500);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -780,
      right: 780,
      top: 780,
      bottom: -780,
      far: 2300,
    });
    sun.shadow.bias = -0.001;
    scene.add(sun);
    const brushMesh = new T.InstancedMesh(
      new T.PlaneGeometry(98, 98).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color: "#d5ed9b",
        transparent: true,
        opacity: 0.25,
        depthTest: false,
        depthWrite: false,
      }),
      25,
    );
    brushMesh.count = 0;
    brushMesh.renderOrder = 20;
    brushMesh.frustumCulled = false;
    scene.add(brushMesh);
    const brushTransform = new T.Object3D();
    const movement = mobilityView(scene, DISTRICT);
    const details = cityDetails(DISTRICT);
    scene.add(details);
    const box = new T.BoxGeometry(1, 1, 1),
      dummy = new T.Object3D();
    const mat = (c: string) =>
      new T.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const base = new T.Mesh(new T.BoxGeometry(1024, 24, 1024), mat("#35453b"));
    base.position.y = -15;
    base.receiveShadow = true;
    scene.add(base);
    const groundPlane = new T.Mesh(
      new T.PlaneGeometry(10000, 10000),
      mat("#15211d"),
    );
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -30;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);
    const grid = new T.GridHelper(4000, 80, "#2c3d32", "#203128");
    grid.position.y = -29;
    scene.add(grid);
    const positions: number[] = [],
      colors: number[] = [];
    const palette = [
      "#52664b",
      "#a6aa96",
      "#7b8265",
      "#3d6962",
      "#7b8265",
      "#656e69",
    ];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x,
          h = DISTRICT.z[i] * 6,
          c = new T.Color(palette[DISTRICT.kind[i]]);
        c.multiplyScalar(0.94 + 0.06 * Math.sin(x * 43 + y * 17));
        for (const [dx, dy] of [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          positions.push((x + dx) * CELL - 500, h, (y + dy) * CELL - 500);
          colors.push(c.r, c.g, c.b);
        }
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        side: T.DoubleSide,
      }),
    );
    terrain.receiveShadow = true;
    scene.add(terrain);
    const buildings = new T.InstancedMesh(box, mat("#c5c7af"), 120),
      roofs = new T.InstancedMesh(box, mat("#8a9687"), 120),
      units = new T.InstancedMesh(box, mat("#b6bcad"), 240);
    let count = 0,
      uc = 0;
    const block = (
      mesh: T.InstancedMesh,
      k: number,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(sx, sy, sz);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    };
    for (let y = 4; y < 100; y += 10)
      for (let x = 4; x < 100; x += 10) {
        if (DISTRICT.kind[y * N + x] !== 4) continue;
        const seed =
            Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1,
          h = 16 + Math.floor(seed * 6) * 9,
          b = DISTRICT.z[y * N + x] * 6,
          cx = x * 10 - 500,
          cz = y * 10 - 500;
        block(buildings, count, cx, b + h / 2, cz, 36, h, 36);
        buildings.setColorAt(
          count,
          new T.Color(
            ["#c4c5ad", "#d4ceb4", "#a8b3a4", "#b4baa8"][Math.floor(seed * 4)],
          ),
        );
        block(roofs, count, cx, b + h + 1, cz, 38, 2, 38);
        block(units, uc++, cx - 9, b + h + 4, cz - 6, 8, 6, 8);
        block(units, uc++, cx + 8, b + h + 3, cz + 8, 5, 4, 10);
        count++;
      }
    buildings.count = count;
    roofs.count = count;
    units.count = uc;
    for (const m of [buildings, roofs, units]) {
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    const crowns = new T.InstancedMesh(
        new T.IcosahedronGeometry(1, 1),
        mat("#6f8b56"),
        1200,
      ),
      trunks = new T.InstancedMesh(box, mat("#59624b"), 1200);
    let tc = 0;
    for (let y = 2; y < 98; y += 3)
      for (let x = 2; x < 98; x += 3) {
        const i = y * N + x;
        if (
          DISTRICT.kind[i] !== 0 &&
          !(DISTRICT.kind[i] === 2 && (x * 7 + y * 3) % 11 === 0)
        )
          continue;
        const h = DISTRICT.z[i] * 6;
        block(trunks, tc, x * 10 - 495, h + 5, y * 10 - 495, 1.8, 10, 1.8);
        block(crowns, tc, x * 10 - 495, h + 13, y * 10 - 495, 7, 10, 7);
        tc++;
        if (tc >= 1200) break;
      }
    crowns.count = trunks.count = tc;
    crowns.castShadow = true;
    scene.add(crowns, trunks);
    const constructionStart = performance.now();
    const growing: {
      mesh: T.InstancedMesh;
      index: number;
      matrix: T.Matrix4;
      base: number;
    }[] = [];
    const constructionLots = new Set(props.construction ?? []);
    const original = new T.Matrix4(),
      point = new T.Vector3();
    for (const mesh of [
      buildings,
      roofs,
      units,
      crowns,
      trunks,
      ...(details.children.filter(
        (o) => o instanceof T.InstancedMesh,
      ) as T.InstancedMesh[]),
    ]) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, original);
        point.setFromMatrixPosition(original);
        const x = Math.min(99, Math.max(0, Math.floor((point.x + 500) / 10))),
          y = Math.min(99, Math.max(0, Math.floor((point.z + 500) / 10)));
        if (constructionLots.has(Math.floor(y / 10) * 10 + Math.floor(x / 10)))
          growing.push({
            mesh,
            index: i,
            matrix: original.clone(),
            base: DISTRICT.z[y * N + x] * 6,
          });
      }
    }
    let constructionDone = false;
    const waterSurface = waterMaterial();
    const waterGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const dryEdges = new T.InstancedBufferAttribute(
      new Float32Array(N * N * 4),
      4,
    );
    waterGeo.setAttribute("dryEdges", dryEdges);
    const water = new T.InstancedMesh(waterGeo, waterSurface.material, N * N);
    water.count = 0;
    water.frustumCulled = false;
    scene.add(water);
    const splashes = new T.InstancedMesh(
      new T.RingGeometry(0.7, 1, 16).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color: "#d1eddf",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      96,
    );
    splashes.count = 0;
    splashes.frustumCulled = false;
    scene.add(splashes);
    let wetCells: number[] = [];
    for (const [label, x, y] of [
      ...LANDMARKS.map(({ name, x, y }) => [name.toUpperCase(), x, y] as const),
      ["RETENTION POND", 83, 68],
    ] as const) {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 100;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#18271ee8";
      ctx.beginPath();
      ctx.roundRect(4, 4, 504, 92, 12);
      ctx.fill();
      ctx.strokeStyle = "#90a477";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "500 28px sans-serif";
      ctx.fillStyle = "#e0ebc9";
      ctx.textAlign = "center";
      ctx.fillText(label, 256, 60);
      const texture = new T.CanvasTexture(c);
      const sprite = new T.Sprite(
        new T.SpriteMaterial({
          map: texture,
          depthTest: false,
          transparent: true,
        }),
      );
      sprite.position.set(x * 10 - 500, 130, y * 10 - 500);
      sprite.scale.set(135, 26, 1);
      sprite.renderOrder = 9;
      scene.add(sprite);
    }
    const patches = new T.Group();
    for (const l of LANDMARKS) {
      const seed =
          Math.abs(Math.sin(l.x * 12.9898 + l.y * 78.233) * 43758.5453) % 1,
        roofY =
          DISTRICT.z[l.y * N + l.x] * 6 + 16 + Math.floor(seed * 6) * 9 + 3;
      const addDetail = (
        dx: number,
        dz: number,
        w: number,
        h: number,
        d: number,
        color: string,
      ) => {
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color));
        m.position.set(l.x * 10 - 500 + dx, roofY + h / 2, l.y * 10 - 500 + dz);
        m.castShadow = true;
        scene.add(m);
      };
      if (l.id === "clinic") {
        addDetail(0, 0, 24, 1, 6, "#be6a58");
        addDetail(0, 0, 6, 1.2, 24, "#be6a58");
      }
      if (l.id === "school") {
        for (let n = 0; n < 3; n++)
          addDetail(-10 + n * 10, 0, 7, 2, 23, "#365777");
        addDetail(0, 21, 36, 9, 5, "#c9b77b");
      }
      if (l.id === "market") {
        for (let n = 0; n < 6; n++)
          addDetail(-15 + n * 6, 23, 6, 2, 16, n % 2 ? "#d5b46f" : "#7d9971");
      }
    }
    const routeLine = new T.Line(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: "#d1ed9b",
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    routeLine.renderOrder = 11;
    scene.add(routeLine);
    const routeDot = new T.Mesh(
      new T.SphereGeometry(3, 8, 6),
      new T.MeshBasicMaterial({ color: "#f1ffc8", depthTest: false }),
    );
    routeDot.renderOrder = 12;
    scene.add(routeDot);
    const ghost = new T.Mesh(
      new T.RingGeometry(0.88, 1, 64),
      new T.MeshBasicMaterial({
        color: "#d0e99d",
        transparent: true,
        opacity: 0.8,
        side: T.DoubleSide,
        depthTest: false,
      }),
    );
    ghost.rotation.x = -Math.PI / 2;
    ghost.renderOrder = 12;
    ghost.visible = false;
    scene.add(ghost);
    scene.add(patches);
    const activity = new T.Group();
    scene.add(activity);
    const boundary = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: "#e0ef9c",
        depthTest: false,
        transparent: true,
        opacity: 0.8,
      }),
    );
    const flow = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: "#b5edf2",
        depthTest: false,
        transparent: true,
        opacity: 0.85,
      }),
    );
    const particles = new T.Points(
      new T.BufferGeometry(),
      new T.PointsMaterial({ color: "#f4ffe6", size: 3, depthTest: false }),
    );
    const drains = new T.InstancedMesh(
      new T.RingGeometry(3, 6, 16),
      new T.MeshBasicMaterial({
        color: "#efc778",
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      }),
      N * N,
    );
    drains.count = 0;
    boundary.renderOrder = 14;
    flow.renderOrder = 15;
    particles.renderOrder = 16;
    drains.renderOrder = 17;
    activity.add(boundary, flow, particles, drains);
    let activityDepth: Float32Array | undefined,
      activityDrain: Uint16Array | undefined,
      arrows: FlowArrow[] = [];
    const drainDummy = new T.Object3D();
    const selection = new T.Mesh(
      new T.RingGeometry(8, 11, 48),
      new T.MeshBasicMaterial({
        color: "#edfaab",
        side: T.DoubleSide,
        depthTest: false,
      }),
    );
    selection.rotation.x = -Math.PI / 2;
    selection.renderOrder = 10;
    selection.visible = false;
    scene.add(selection);
    const rainPos = new Float32Array(1600 * 6);
    for (let i = 0; i < 1600; i++) {
      const x = Math.sin(i * 18.27) * 600,
        z = Math.cos(i * 9.23) * 600,
        y = (i * 53) % 700;
      rainPos.set([x, y, z, x - 2, y - 12, z + 1], i * 6);
    }
    const rainGeo = new T.BufferGeometry();
    rainGeo.setAttribute("position", new T.BufferAttribute(rainPos, 3));
    const rain = new T.LineSegments(
      rainGeo,
      new T.LineBasicMaterial({
        color: "#b9d6cc",
        transparent: true,
        opacity: 0.18,
      }),
    );
    scene.add(rain);
    const ray = new T.Raycaster(),
      mouse = new T.Vector2();
    let downX = 0,
      downY = 0;
    const down = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const click = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(terrain)[0];
      if (hit) {
        const x = Math.floor((hit.point.x + 500) / 10),
          y = Math.floor((hit.point.z + 500) / 10);
        if (x >= 0 && x < N && y >= 0 && y < N) latest.current.select(x, y);
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", click);
    let hoverCell: { x: number; y: number } | null = null;
    const showGhost = (x: number, y: number) => {
      const p = latest.current;
      if (!p.tool || x < 0 || y < 0 || x >= N || y >= N) {
        ghost.visible = false;
        return;
      }
      ghost.visible = true;
      const radius = TOOLS[p.tool].radius * 10;
      ghost.scale.set(radius, radius, 1);
      ghost.position.set(x * 10 - 495, z[y * N + x] * 6 + 2, y * 10 - 495);
      ghost.material.color.set(
        placementError(p.placementItems, p.tool, x, y, p.moveId, DISTRICT)
          ? "#e49a83"
          : "#d0e99d",
      );
    };
    const move = (e: PointerEvent) => {
      const p = latest.current;
      if (!p.tool) {
        ghost.visible = false;
        return;
      }
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(terrain)[0];
      if (!hit) {
        ghost.visible = false;
        return;
      }
      const x = Math.floor((hit.point.x + 500) / 10),
        y = Math.floor((hit.point.z + 500) / 10);
      if (x < 0 || x >= N || y < 0 || y >= N) return;
      hoverCell = { x, y };
      showGhost(x, y);
    };
    const leave = () => {
      hoverCell = null;
      ghost.visible = false;
    };
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerleave", leave);
    let syncing = false;
    const sync = (p: T.Vector3, t: T.Vector3) => {
      syncing = true;
      camera.position.copy(p);
      controls.target.copy(t);
      controls.update();
      syncing = false;
    };
    props.bus.listeners.add(sync);
    controls.addEventListener("change", () => {
      if (!syncing)
        props.bus.view = {
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
      if (!syncing)
        for (const l of props.bus.listeners)
          if (l !== sync) l(camera.position, controls.target);
    });
    let fitFactor = 1;
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const next = Math.max(1, Math.min(2.2, 1.35 / camera.aspect));
      camera.position
        .sub(controls.target)
        .multiplyScalar(next / fitFactor)
        .add(controls.target);
      fitFactor = next;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    if (props.bus.view) sync(props.bus.view.position, props.bus.view.target);
    let lastDepth: Float32Array | undefined,
      lastDiff: Float32Array | undefined,
      lastItems = "",
      knownItems = new Set<string>(),
      lastTop = false,
      frame = 0;
    let z = DISTRICT.z;
    let lastTime = performance.now();
    let lastQuality = "",
      visualTime = 0;
    const warmSun = new T.Color("#ffe8bc"),
      rainSun = new T.Color("#b1c9d6");
    const clearSky = new T.Color("#d5f0df"),
      stormSky = new T.Color("#9ab5c3");
    const clearFog = new T.Color("#15211d"),
      stormFog = new T.Color("#283b41");
    const atmosphereColor = new T.Color();
    let cloud = props.weather.cloud;
    let lastFocus = 0,
      lastShot = 0,
      lastRoute: number[] | undefined;
    let destination: T.Vector3 | null = null;
    let cameraDestination: T.Vector3 | null = null;
    controls.addEventListener("start", () => {
      destination = null;
      cameraDestination = null;
    });
    const animate = () => {
      const p = latest.current;
      frame = requestAnimationFrame(animate);
      const now = performance.now(),
        dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (!constructionDone && constructionLots.size) {
        const t = p.reduced ? 1 : Math.min(1, (now - constructionStart) / 650),
          ease = 1 - Math.pow(1 - t, 3);
        for (const g of growing) {
          const matrix = g.matrix.clone();
          matrix.elements[5] *= Math.max(0.01, ease);
          matrix.elements[13] =
            g.base + (g.matrix.elements[13] - g.base) * ease;
          g.mesh.setMatrixAt(g.index, matrix);
          g.mesh.instanceMatrix.needsUpdate = true;
        }
        const vertices = geo.getAttribute("position");
        for (const lot of constructionLots)
          for (let dy = 0; dy < 10; dy++)
            for (let dx = 0; dx < 10; dx++) {
              const i =
                (Math.floor(lot / 10) * 10 + dy) * N + (lot % 10) * 10 + dx;
              for (let v = 0; v < 6; v++)
                vertices.setY(i * 6 + v, z[i] * 6 + (1 - ease) * 3);
            }
        vertices.needsUpdate = true;
        renderer.shadowMap.needsUpdate = true;
        constructionDone = t === 1;
      }
      brushMesh.count = 0;
      if (
        p.districtBrush &&
        Number.isInteger(p.districtBrush.x) &&
        Number.isInteger(p.districtBrush.y) &&
        p.districtBrush.x >= 0 && p.districtBrush.x <= 9 &&
        p.districtBrush.y >= 0 && p.districtBrush.y <= 9
      ) {
        const b = p.districtBrush;
        for (
          let y = Math.max(0, b.y - b.radius);
          y <= Math.min(9, b.y + b.radius);
          y++
        )
          for (
            let x = Math.max(0, b.x - b.radius);
            x <= Math.min(9, b.x + b.radius);
            x++
          ) {
            if (protectedLot(x, y)) continue;
            brushTransform.position.set(
              x * 100 - 450,
              DISTRICT.z[(y * 10 + 4) * N + x * 10 + 4] * 6 + 4,
              y * 100 - 450,
            );
            brushTransform.updateMatrix();
            brushMesh.setMatrixAt(brushMesh.count++, brushTransform.matrix);
          }
        brushMesh.instanceMatrix.needsUpdate = true;
      }
      const preset = QUALITY[p.quality];
      if (lastQuality !== p.quality + String(p.comparison)) {
        lastQuality = p.quality + String(p.comparison);
        renderer.setPixelRatio(
          Math.min(devicePixelRatio, preset.dpr, p.comparison ? 1.25 : 2),
        );
        renderer.setSize(el.clientWidth, el.clientHeight);
        renderer.shadowMap.enabled = preset.shadow > 0;
        sun.castShadow = preset.shadow > 0;
        if (preset.shadow) {
          const shadowSize = Math.min(
            preset.shadow,
            p.comparison ? 1024 : 2048,
          );
          sun.shadow.mapSize.set(shadowSize, shadowSize);
          sun.shadow.map?.dispose();
          sun.shadow.map = null;
          sun.shadow.needsUpdate = true;
        }
        renderer.shadowMap.needsUpdate = true;
        scene.traverse((o) => {
          const m = o as T.Mesh;
          if (m.material)
            for (const material of Array.isArray(m.material)
              ? m.material
              : [m.material])
              material.needsUpdate = true;
        });
        details.visible = preset.details;
        rainGeo.setDrawRange(0, preset.drops * 2);
      }
      cloud +=
        (p.weather.cloud - cloud) * (p.reduced ? 1 : 1 - Math.exp(-dt * 3));
      sun.color.copy(warmSun).lerp(rainSun, cloud);
      sun.intensity = 3.1 - cloud * 1.8;
      sky.color.copy(clearSky).lerp(stormSky, cloud);
      sky.intensity = 2 - cloud * 0.35;
      atmosphereColor.copy(clearFog).lerp(stormFog, cloud);
      (scene.fog as T.Fog).color.copy(atmosphereColor);
      (scene.fog as T.Fog).near = 3500 - cloud * 1600;
      renderer.setClearColor(atmosphereColor);
      if (!p.reduced && p.animateActivity) visualTime += dt;
      waterSurface.uniforms.monsoonTime.value = visualTime;
      waterSurface.uniforms.rippleStrength.value =
        preset.details && !p.difference ? 1 : 0;
      waterSurface.uniforms.softenEdges.value = p.difference ? 0 : 1;
      if (!p.tool) ghost.visible = false;
      else if (hoverCell || p.preview) {
        const cell = hoverCell ?? p.preview!;
        showGhost(cell.x, cell.y);
      }
      if (p.focus && p.focus.nonce !== lastFocus) {
        lastFocus = p.focus.nonce;
        destination = new T.Vector3(
          p.focus.landmark.x * 10 - 500,
          0,
          p.focus.landmark.y * 10 - 500,
        );
        cameraDestination = destination
          .clone()
          .add(
            new T.Vector3(420, 650, 520).multiplyScalar(
              Math.max(1, fitFactor * 0.8),
            ),
          );
      }
      if (p.shot && p.shot.nonce !== lastShot) {
        lastShot = p.shot.nonce;
        destination = new T.Vector3(
          p.shot.x * 10 - 500,
          0,
          p.shot.y * 10 - 500,
        );
        cameraDestination = destination
          .clone()
          .add(
            new T.Vector3(
              p.shot.wide ? 1030 : 420,
              p.shot.wide ? 1120 : 650,
              p.shot.wide ? 1120 : 520,
            ).multiplyScalar(Math.max(1, fitFactor * 0.8)),
          );
      }
      if (destination && cameraDestination) {
        const a = p.reduced ? 1 : 1 - Math.exp(-dt * 4);
        controls.target.lerp(destination, a);
        camera.position.lerp(cameraDestination, a);
        if (camera.position.distanceTo(cameraDestination) < 1) {
          destination = null;
          cameraDestination = null;
        }
      }
      if (p.route !== lastRoute) {
        lastRoute = p.route;
        routeLine.geometry.dispose();
        routeLine.geometry = new T.BufferGeometry().setFromPoints(
          p.route.map(
            (i) =>
              new T.Vector3(
                (i % N) * 10 - 495,
                DISTRICT.z[i] * 6 + 5,
                Math.floor(i / N) * 10 - 495,
              ),
          ),
        );
        routeLine.material.color.set(p.connected ? "#d1ed9b" : "#ea9275");
      }
      routeLine.visible = !!p.focus && p.route.length > 0;
      const blocked = p.route.find((i) => (p.depth?.[i] ?? 0) > 0.15);
      routeDot.visible =
        routeLine.visible && (p.connected ? !p.reduced : blocked !== undefined);
      if (routeDot.visible) {
        const i = p.connected
          ? p.route[Math.floor(now / 70) % p.route.length]
          : blocked!;
        routeDot.material.color.set(p.connected ? "#f1ffc8" : "#ff765c");
        routeDot.position.set(
          (i % N) * 10 - 495,
          DISTRICT.z[i] * 6 + 6,
          Math.floor(i / N) * 10 - 495,
        );
      }
      const key = JSON.stringify(p.items);
      if (key !== lastItems) {
        lastItems = key;
        z = terrainFor(p.items, DISTRICT);
        renderer.shadowMap.needsUpdate = true;
        const pos = geo.getAttribute("position");
        for (let i = 0; i < N * N; i++)
          for (let v = 0; v < 6; v++) pos.setY(i * 6 + v, z[i] * 6);
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        for (const child of [...patches.children]) {
          patches.remove(child);
          (child as T.Mesh).geometry.dispose();
          ((child as T.Mesh).material as T.Material).dispose();
        }
        for (const t of p.items) {
          const disk = new T.Mesh(
            new T.RingGeometry(
              TOOLS[t.type].radius * 8,
              TOOLS[t.type].radius * 10,
              64,
            ),
            new T.MeshBasicMaterial({
              color: TOOLS[t.type].color,
              transparent: true,
              opacity: 0.8,
              side: T.DoubleSide,
              depthTest: false,
            }),
          );
          disk.rotation.x = -Math.PI / 2;
          disk.position.set(
            t.x * 10 - 495,
            z[t.y * N + t.x] * 6 + 1,
            t.y * 10 - 495,
          );
          disk.renderOrder = 8;
          disk.userData.birth = knownItems.has(t.id) ? 0 : now;
          patches.add(disk);
        }
        knownItems = new Set(p.items.map((t) => t.id));
        lastDepth = undefined;
      }
      for (const child of patches.children) {
        const age = (now - child.userData.birth) / 650;
        const scale =
          p.reduced || !child.userData.birth || age >= 1
            ? 1
            : 1 + Math.sin(Math.min(1, age) * Math.PI) * 0.23;
        child.scale.setScalar(scale);
      }
      if (p.depth !== lastDepth || p.difference !== lastDiff) {
        lastDepth = p.depth;
        lastDiff = p.difference;
        let wc = 0;
        wetCells = [];
        if (p.depth)
          for (let i = 0; i < N * N; i++) {
            const h = p.depth[i],
              diff = p.difference?.[i];
            if (h < 0.006 && (!diff || Math.abs(diff) < 0.003)) continue;
            const thickness = Math.max(0.2, h * 6);
            block(
              water,
              wc,
              (i % N) * 10 - 495,
              z[i] * 6 + thickness + 0.3,
              Math.floor(i / N) * 10 - 495,
              10,
              1,
              10,
            );
            water.setColorAt(
              wc,
              new T.Color(
                diff !== undefined
                  ? diff < -0.003
                    ? "#91df9c"
                    : diff > 0.003
                      ? "#ed9d72"
                      : "#60929c"
                  : "#ffffff",
              ),
            );
            if (diff === undefined) {
              const color = new T.Color("#a6d9cb").lerp(
                new T.Color("#318ca5"),
                Math.min(1, h / 0.22),
              );
              water.setColorAt(wc, color);
            }
            const shallow = h < 0.1 ? 1 : 0,
              x = i % N,
              y = Math.floor(i / N);
            dryEdges.setXYZW(
              wc,
              shallow * (x === 0 || p.depth[i - 1] < 0.006 ? 1 : 0),
              shallow * (x === N - 1 || p.depth[i + 1] < 0.006 ? 1 : 0),
              shallow * (y === 0 || p.depth[i - N] < 0.006 ? 1 : 0),
              shallow * (y === N - 1 || p.depth[i + N] < 0.006 ? 1 : 0),
            );
            if (h > 0.006 && DISTRICT.kind[i] !== 4) wetCells.push(i);
            wc++;
          }
        water.count = wc;
        water.instanceMatrix.needsUpdate = true;
        if (water.instanceColor) water.instanceColor.needsUpdate = true;
        dryEdges.needsUpdate = true;
      }
      splashes.visible =
        !p.reduced &&
        !!p.animateActivity &&
        p.weather.rain > 0 &&
        !p.difference &&
        preset.splashes > 0 &&
        wetCells.length > 0;
      if (splashes.visible) {
        splashes.count = Math.min(preset.splashes, wetCells.length);
        for (let k = 0; k < splashes.count; k++) {
          const phase = (visualTime * 1.5 + k * 0.618) % 1;
          const i = wetCells[(k * 137) % wetCells.length],
            scale = 0.2 + phase * 2.8;
          block(
            splashes,
            k,
            (i % N) * 10 - 495,
            z[i] * 6 + Math.max(0.2, p.depth![i] * 6) + 0.34,
            Math.floor(i / N) * 10 - 495,
            scale,
            1,
            scale,
          );
        }
        splashes.instanceMatrix.needsUpdate = true;
      }
      activity.visible = !!p.activity && !!p.depth && !p.difference;
      if (
        activity.visible &&
        p.depth &&
        (activityDepth !== p.depth || activityDrain !== p.draining)
      ) {
        activityDepth = p.depth;
        activityDrain = p.draining;
        arrows = flowDirections(p.depth, z, DISTRICT);
        const flowPoints: number[] = [];
        for (const a of arrows) {
          const x = a.x * 10 - 495,
            y = z[a.y * N + a.x] * 6 + 4,
            w = a.y * 10 - 495,
            ex = x + a.dx * 8,
            ez = w + a.dy * 8;
          flowPoints.push(
            x - a.dx * 5,
            y,
            w - a.dy * 5,
            ex,
            y,
            ez,
            ex,
            y,
            ez,
            ex - a.dx * 4 - a.dy * 3,
            y,
            ez - a.dy * 4 + a.dx * 3,
            ex,
            y,
            ez,
            ex - a.dx * 4 + a.dy * 3,
            y,
            ez - a.dy * 4 - a.dx * 3,
          );
        }
        flow.geometry.dispose();
        flow.geometry = new T.BufferGeometry();
        flow.geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(flowPoints, 3),
        );
        const edges = floodEdges(p.depth),
          edgePoints: number[] = [];
        for (let k = 0; k < edges.length; k += 2) {
          const x = edges[k],
            y = edges[k + 1],
            i = Math.min(N - 1, y) * N + Math.min(N - 1, x);
          edgePoints.push(x * 10 - 500, z[i] * 6 + 4, y * 10 - 500);
        }
        boundary.geometry.dispose();
        boundary.geometry = new T.BufferGeometry();
        boundary.geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(edgePoints, 3),
        );
        particles.geometry.dispose();
        particles.geometry = new T.BufferGeometry();
        particles.geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(new Float32Array(arrows.length * 3), 3),
        );
        drains.count = p.draining?.length ?? 0;
        p.draining?.forEach((i, k) => {
          drainDummy.position.set(
            (i % N) * 10 - 495,
            z[i] * 6 + 5,
            Math.floor(i / N) * 10 - 495,
          );
          drainDummy.rotation.x = -Math.PI / 2;
          drainDummy.updateMatrix();
          drains.setMatrixAt(k, drainDummy.matrix);
        });
        drains.instanceMatrix.needsUpdate = true;
      }
      particles.visible = activity.visible && !p.reduced && !!p.animateActivity;
      if (particles.visible) {
        const fraction = (now % 1600) / 1600,
          position = particles.geometry.getAttribute("position");
        arrows.forEach((a, i) =>
          position.setXYZ(
            i,
            a.x * 10 - 495 + a.dx * (fraction * 13 - 5),
            z[a.y * N + a.x] * 6 + 5,
            a.y * 10 - 495 + a.dy * (fraction * 13 - 5),
          ),
        );
        position.needsUpdate = true;
      }
      (drains.material as T.MeshBasicMaterial).opacity =
        !p.reduced && p.animateActivity
          ? 0.65 + 0.25 * Math.sin(now / 300)
          : 0.8;
      if (p.top !== lastTop) {
        lastTop = p.top;
        camera.position.set(
          p.top ? 0 : 1030,
          p.top ? 1750 : 1120,
          p.top ? 1 : 1120,
        );
        camera.position.multiplyScalar(fitFactor);
        controls.target.set(0, 0, 0);
      }
      selection.visible = p.selected !== null;
      if (p.selected !== null)
        selection.position.set(
          (p.selected % N) * 10 - 495,
          z[p.selected] * 6 + 2,
          Math.floor(p.selected / N) * 10 - 495,
        );
      rain.visible = p.rain > 0 && !p.reduced;
      if (rain.visible) {
        for (let i = 0; i < preset.drops; i++) {
          const o = i * 6;
          rainPos[o + 1] -= dt * 240;
          rainPos[o + 4] -= dt * 240;
          if (rainPos[o + 1] < 0) {
            rainPos[o + 1] += 700;
            rainPos[o + 4] += 700;
          }
        }
        rainGeo.attributes.position.needsUpdate = true;
        rain.material.opacity = Math.min(0.25, p.rain / 400);
      }
      controls.enableDamping = !p.reduced;
      controls.update();
      movement.update(
        {
          depth: p.depth,
          minute: p.minute,
          layer: p.difference ? "water" : p.layer,
          traffic: p.traffic && !p.difference,
          animate: !!p.animateActivity,
          reduced: p.reduced,
          quality: p.quality,
          comparison: p.comparison,
        },
        z,
        dt,
        now,
      );
      renderer.domElement.style.cursor = p.placing ? "crosshair" : "grab";
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      props.bus.listeners.delete(sync);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", click);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerleave", leave);
      scene.traverse((o) => {
        const m = o as T.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material)
          for (const x of Array.isArray(m.material)
            ? m.material
            : [m.material]) {
            const texture = (x as T.MeshStandardMaterial).map;
            texture?.dispose();
            x.dispose();
          }
      });
      renderer.dispose();
      // dispose() frees GPU resources but leaves the WebGL context alive until
      // the canvas is garbage-collected. The scene is rebuilt on every
      // district edit, so release it now rather than rely on GC timing.
      // Called after dispose(), which removed three's context-lost handler.
      renderer.forceContextLoss();
      el.replaceChildren();
    };
  }, [JSON.stringify(props.layout)]);
  return (
    <div
      className="city"
      ref={host}
      role="group"
      aria-label="Interactive three dimensional neighborhood. Drag to orbit, scroll to zoom, select a location to inspect."
    >
      {error && (
        <div className="fallback">
          3D graphics are unavailable on this device. The simulation, timeline,
          results and coordinate inspector remain available.
        </div>
      )}
    </div>
  );
}
