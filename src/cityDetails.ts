import * as T from "three";
import { DISTRICT, N, type District } from "./engine";
// Shared geometries and instancing keep the additional architecture inexpensive.
export function cityDetails(map: District = DISTRICT) {
  const group = new T.Group(),
    box = new T.BoxGeometry(1, 1, 1),
    dummy = new T.Object3D();
  const mesh = (color: string, max: number, geo: T.BufferGeometry = box) => {
    const m = new T.InstancedMesh(
      geo,
      new T.MeshStandardMaterial({ color, roughness: 0.78 }),
      max,
    );
    m.count = 0;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const windows = mesh("#415c59", 8000),
    trim = mesh("#e0d8bd", 5000),
    balcony = mesh("#8d9d89", 1000);
  const tanks = mesh("#668e94", 120, new T.CylinderGeometry(1, 1, 1, 12));
  const awnings = mesh("#a56248", 120),
    markings = mesh("#d2ceb4", 2200),
    doors = mesh("#384d49", 120);
  function put(
    m: T.InstancedMesh,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    m.setMatrixAt(m.count++, dummy.matrix);
  }
  for (let y = 4; y < 100; y += 10)
    for (let x = 4; x < 100; x += 10) {
      if (map.kind[y * N + x] !== 4) continue;
      const seed =
          Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1,
        h = 16 + Math.floor(seed * 6) * 9,
        b = map.z[y * N + x] * 6,
        cx = x * 10 - 500,
        cz = y * 10 - 500;
      for (let level = 7; level < h - 3; level += 10)
        for (const offset of [-11, 0, 11]) {
          put(windows, cx + offset, b + level, cz + 18.15, 5.5, 4.5, 0.4);
          put(windows, cx + 18.15, b + level, cz + offset, 0.4, 4.5, 5.5);
          put(trim, cx + offset, b + level - 2.5, cz + 18.4, 6.3, 0.6, 1);
          if (level > 10 && offset === 0 && seed > 0.45) {
            put(balcony, cx, b + level - 3, cz + 20, 12, 1, 5);
            put(trim, cx, b + level - 1.2, cz + 22.5, 12, 2.5, 0.5);
          }
        }
      put(tanks, cx + 8, b + h + 7, cz - 8, 4, 10, 4);
      put(trim, cx, b + h + 3, cz + 18, 38, 3, 1);
      put(trim, cx + 18, b + h + 3, cz, 1, 3, 38);
      put(doors, cx, b + 3.5, cz + 18.3, 5, 7, 0.6);
      if (seed > 0.35) {
        put(awnings, cx, b + 8, cz + 22, 27, 1.2, 8);
        awnings.setColorAt(
          awnings.count - 1,
          new T.Color(["#a86b4c", "#51817b", "#c5a96c"][Math.floor(seed * 3)]),
        );
        put(trim, cx, b + 6.8, cz + 26, 27, 2, 1);
      }
    }
  // Lane dashes and zebra crossings remain inside road cells.
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (map.kind[i] !== 1) continue;
      const h = map.z[i] * 6 + 0.12,
        cx = x * 10 - 495,
        cz = y * 10 - 495;
      if (x % 20 === 9 && y % 2 === 0 && !(y % 20 >= 7 && y % 20 <= 12))
        put(markings, cx + 4, h, cz, 1, 0.1, 5);
      if (y % 20 === 9 && x % 2 === 0 && !(x % 20 >= 7 && x % 20 <= 12))
        put(markings, cx, h, cz + 4, 5, 0.1, 1);
      if (x % 20 === 7 && y % 20 >= 8 && y % 20 <= 11)
        put(markings, cx, h, cz, 4, 0.1, 7);
      if (y % 20 === 7 && x % 20 >= 8 && x % 20 <= 11)
        put(markings, cx, h, cz, 7, 0.1, 4);
    }
  for (const m of [windows, trim, balcony, tanks, awnings, markings, doors]) {
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
  }
  return group;
}
