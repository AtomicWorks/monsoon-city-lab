import * as T from "three";
import { DISTRICT, N, type District } from "./engine";
import {
  mobility,
  createTraffic,
  advanceVehicle,
  vehiclePosition,
  type Mobility,
  type AccessLayer,
} from "./mobility";
import type { Tier } from "./graphics";
export function mobilityView(scene: T.Scene, map: District = DISTRICT) {
  const roads = new T.InstancedMesh(
    new T.PlaneGeometry(10, 10).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false,
    }),
    N * N,
  );
  roads.count = 0;
  roads.renderOrder = 11;
  roads.frustumCulled = false;
  scene.add(roads);
  const services = new T.Group();
  scene.add(services);
  const path = new T.LineSegments(
    new T.BufferGeometry(),
    new T.LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    }),
  );
  path.renderOrder = 13;
  services.add(path);
  const halos = new T.InstancedMesh(
    new T.RingGeometry(24, 29, 40).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    }),
    3,
  );
  halos.renderOrder = 14;
  halos.frustumCulled = false;
  services.add(halos);
  const blocked = new T.InstancedMesh(
    new T.BoxGeometry(7, 2, 7),
    new T.MeshBasicMaterial({ color: "#ff9a80", depthTest: false }),
    3,
  );
  blocked.renderOrder = 15;
  blocked.frustumCulled = false;
  services.add(blocked);
  const traffic = new T.Group();
  scene.add(traffic);
  const body = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshStandardMaterial({ roughness: 0.65 }),
    18,
  );
  const cabin = new T.InstancedMesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshStandardMaterial({ color: "#bad8da", roughness: 0.3 }),
    18,
  );
  const wheels = new T.InstancedMesh(
    new T.CylinderGeometry(1, 1, 1, 8).rotateZ(Math.PI / 2),
    new T.MeshStandardMaterial({ color: "#192a26" }),
    72,
  );
  for (const m of [body, cabin, wheels]) {
    m.count = 0;
    m.frustumCulled = false;
    // Render after the access tint while retaining terrain/building occlusion.
    m.material.transparent = true;
    m.renderOrder = 12;
    traffic.add(m);
  }
  const dummy = new T.Object3D(),
    color = new T.Color();
  const green = new T.Color("#a8d68b"),
    amber = new T.Color("#e6be65"),
    coral = new T.Color("#e78e78");
  let depth: Float32Array | undefined,
    graph: Mobility | undefined,
    lastMinute = -1,
    vehicles = createTraffic(map),
    transitions = [0, 0, 0],
    prior: boolean[] = [];
  function stamp(
    m: T.InstancedMesh,
    k: number,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    heading = 0,
  ) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, heading, 0);
    dummy.updateMatrix();
    m.setMatrixAt(k, dummy.matrix);
  }
  return {
    update(
      p: {
        depth?: Float32Array;
        minute: number;
        layer: AccessLayer;
        traffic: boolean;
        animate: boolean;
        reduced: boolean;
        quality: Tier;
        comparison: boolean;
      },
      z: Float64Array,
      dt: number,
      now: number,
    ) {
      roads.visible = p.layer === "roads" && !!p.depth;
      services.visible = p.layer === "services" && !!p.depth;
      traffic.visible = p.traffic && !!p.depth;
      if (p.depth !== depth) {
        if (p.minute < lastMinute || p.minute - lastMinute > 1 || !depth)
          vehicles = createTraffic(map);
        lastMinute = p.minute;
        depth = p.depth;
        graph = depth ? mobility(depth, map) : undefined;
        if (graph && depth) {
          let count = 0;
          for (let i = 0; i < N * N; i++)
            if (map.kind[i] === 1) {
              stamp(
                roads,
                count,
                (i % N) * 10 - 495,
                z[i] * 6 + 1,
                Math.floor(i / N) * 10 - 495,
                1,
                1,
                1,
              );
              roads.setColorAt(
                count++,
                depth[i] > 0.15 ? coral : graph.north[i] >= 0 ? green : amber,
              );
            }
          roads.count = count;
          roads.instanceMatrix.needsUpdate = true;
          if (roads.instanceColor) roads.instanceColor.needsUpdate = true;
          const points: number[] = [],
            colors: number[] = [];
          let blockedCount = 0;
          graph.services.forEach((s, k) => {
            if (prior[k] !== undefined && prior[k] !== s.connected)
              transitions[k] = now;
            prior[k] = s.connected;
            const c = s.connected ? green : coral;
            for (let j = 1; j < s.path.length; j++)
              for (const i of [s.path[j - 1], s.path[j]]) {
                points.push(
                  (i % N) * 10 - 495,
                  z[i] * 6 + 3,
                  Math.floor(i / N) * 10 - 495,
                );
                colors.push(c.r, c.g, c.b);
              }
            halos.setColorAt(k, c);
            if (s.blocked !== undefined) {
              const i = s.blocked;
              stamp(
                blocked,
                blockedCount++,
                (i % N) * 10 - 495,
                z[i] * 6 + 5,
                Math.floor(i / N) * 10 - 495,
                1,
                1,
                1,
              );
            }
          });
          path.geometry.dispose();
          path.geometry = new T.BufferGeometry();
          path.geometry.setAttribute(
            "position",
            new T.Float32BufferAttribute(points, 3),
          );
          path.geometry.setAttribute(
            "color",
            new T.Float32BufferAttribute(colors, 3),
          );
          blocked.count = blockedCount;
          blocked.instanceMatrix.needsUpdate = true;
          if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
        }
      }
      if (!graph || !depth) return;
      if (services.visible) {
        graph.services.forEach((s, k) => {
          const age = (now - transitions[k]) / 700,
            scale =
              p.reduced || age >= 1 ? 1 : 1 + Math.sin(age * Math.PI) * 0.14;
          stamp(
            halos,
            k,
            s.landmark.x * 10 - 500,
            z[s.landmark.y * N + s.landmark.x] * 6 + 2,
            s.landmark.y * 10 - 500,
            scale,
            1,
            scale,
          );
        });
        halos.instanceMatrix.needsUpdate = true;
      }
      if (traffic.visible) {
        const count =
          (p.quality === "low" ? 6 : p.quality === "balanced" ? 12 : 18) /
          (p.comparison ? 2 : 1);
        body.count = cabin.count = Math.min(count, vehicles.length);
        wheels.count = body.count * 4;
        for (let k = 0; k < body.count; k++) {
          const v = vehicles[k];
          advanceVehicle(v, depth, graph, p.animate && !p.reduced ? dt : 0);
          const pos = vehiclePosition(v),
            next = v.next >= 0 ? v.next : v.cell,
            ground = (z[v.cell] * (1 - v.progress) + z[next] * v.progress) * 6;
          const bus = k % 3 === 0,
            rik = k % 3 === 2,
            width = rik ? 2.4 : 3.2,
            length = bus ? 7.2 : rik ? 3.4 : 4.5,
            height = bus ? 2 : 1.1;
          stamp(
            body,
            k,
            pos.x,
            ground + 1.1 + height / 2,
            pos.z,
            width,
            height,
            length,
            v.heading,
          );
          color.set(
            v.state === "flooded"
              ? "#dc8c7a"
              : v.state === "waiting"
                ? "#dfba69"
                : bus
                  ? "#d1d8a0"
                  : rik
                    ? "#7faf91"
                    : "#7abacb",
          );
          body.setColorAt(k, color);
          stamp(
            cabin,
            k,
            pos.x,
            ground + height + 1.4,
            pos.z,
            width * 0.82,
            1,
            length * 0.55,
            v.heading,
          );
          for (let w = 0; w < 4; w++) {
            const ox = rik && w < 2 ? 0 : (w % 2 ? 1 : -1) * width * 0.53,
              oz = (w < 2 ? 1 : -1) * length * 0.29,
              c = Math.cos(v.heading),
              s = Math.sin(v.heading);
            stamp(
              wheels,
              k * 4 + w,
              pos.x + ox * c + oz * s,
              ground + 0.8,
              pos.z - ox * s + oz * c,
              rik && w === 1 ? 0 : 0.55,
              rik && w === 1 ? 0 : 0.75,
              rik && w === 1 ? 0 : 0.75,
              v.heading,
            );
          }
        }
        body.instanceMatrix.needsUpdate =
          cabin.instanceMatrix.needsUpdate =
          wheels.instanceMatrix.needsUpdate =
            true;
        if (body.instanceColor) body.instanceColor.needsUpdate = true;
      }
    },
  };
}
