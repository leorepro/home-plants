import {
  type DesignSystem,
  type Page,
  type SlideMeta,
  useIsActivePage,
  useSlidePageNumber,
} from '@open-slide/core';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import allPlants from './assets/all-plants.jpg';
import thanksShot from './assets/thanks.jpg';
import fernShot from './assets/fern.jpg';
import haworthiaShot from './assets/haworthia.jpg';
import mimosaShot from './assets/mimosa.jpg';
import oxalisShot from './assets/oxalis.jpg';
import pachiraShot from './assets/pachira.jpg';
import syngoniumShot from './assets/syngonium.jpg';

export const design: DesignSystem = {
  palette: { bg: '#2b2d2d', text: '#ffffff', accent: '#ff8700' },
  fonts: {
    display: 'Helvetica, "Helvetica Neue", Arial, "PingFang TC", "Microsoft JhengHei", sans-serif',
    body: 'Helvetica, "Helvetica Neue", Arial, "PingFang TC", "Microsoft JhengHei", sans-serif',
  },
  typeScale: { hero: 96, body: 32 },
  radius: 0,
};

const muted = '#9b9d9d';
const rule = '#393b3b';

const fill = {
  position: 'relative',
  width: '100%',
  height: '100%',
  background: 'var(--osd-bg)',
  color: 'var(--osd-text)',
  fontFamily: 'var(--osd-font-body)',
  overflow: 'hidden',
} as const;

// =====================================================================
// three.js plant scenes
// =====================================================================

type V3 = THREE.Vector3;

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d') as CanvasRenderingContext2D);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

const shadowed = <T extends THREE.Object3D>(o: T, cast = true, receive = true) => {
  o.castShadow = cast;
  o.receiveShadow = receive;
  return o;
};

const easeOutBack = (x: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

// ---------- room ----------

const woodTexture = (rng: () => number) =>
  canvasTexture(1024, 1024, (g) => {
    const rows = 8;
    const rh = 1024 / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rng() * 500;
      while (x < 1024) {
        const len = 320 + rng() * 420;
        const l = 17 + rng() * 9;
        g.fillStyle = `hsl(${20 + rng() * 8}, ${38 + rng() * 12}%, ${l}%)`;
        g.fillRect(x, r * rh, len, rh);
        for (let k = 0; k < 46; k++) {
          const y = r * rh + rng() * rh;
          g.strokeStyle = `rgba(${rng() < 0.5 ? '15,8,4' : '120,70,40'},${0.05 + rng() * 0.12})`;
          g.lineWidth = 0.6 + rng() * 2;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(
            x + len * 0.3,
            y + (rng() - 0.5) * 8,
            x + len * 0.65,
            y + (rng() - 0.5) * 8,
            x + len,
            y + (rng() - 0.5) * 5,
          );
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(x, r * rh, 3, rh);
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, r * rh, 1024, 3);
    }
  });

const wallTexture = (rng: () => number) =>
  canvasTexture(512, 512, (g) => {
    g.fillStyle = '#3a3c3c';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = rng() < 0.5 ? 0 : 255;
      g.fillStyle = `rgba(${v},${v},${v},${rng() * 0.05})`;
      g.fillRect(rng() * 512, rng() * 512, 1 + rng() * 3, 1 + rng() * 3);
    }
  });

const buildRoom = (scene: THREE.Scene, rng: () => number, target: V3) => {
  const wood = woodTexture(rng);
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(4, 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.62, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(shadowed(floor, false, true));

  const wallTex = wallTexture(rng);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(4, 2);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 5),
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }),
  );
  wall.position.set(0, 2.5, -1.1);
  scene.add(shadowed(wall, false, true));

  scene.add(new THREE.HemisphereLight('#c8d2dc', '#3a2a20', 0.55));
  scene.add(new THREE.AmbientLight('#ffffff', 0.12));

  // Warm late-afternoon sun coming through a window off to the left.
  const sunDir = new THREE.Vector3(-0.72, 0.62, 0.42).normalize();
  const sun = new THREE.DirectionalLight('#ffcf9a', 5.2);
  sun.position.copy(target).addScaledVector(sunDir, 7);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -2.6;
  sc.right = 2.6;
  sc.top = 2.6;
  sc.bottom = -2.6;
  sc.near = 0.5;
  sc.far = 16;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // Window frame: invisible to the camera, but it casts the mullion pattern.
  const frame = new THREE.Shape();
  frame.moveTo(-5, -5);
  frame.lineTo(5, -5);
  frame.lineTo(5, 5);
  frame.lineTo(-5, 5);
  frame.lineTo(-5, -5);
  const pane = (x0: number, y0: number, w: number, h: number) => {
    const p = new THREE.Path();
    p.moveTo(x0, y0);
    p.lineTo(x0, y0 + h);
    p.lineTo(x0 + w, y0 + h);
    p.lineTo(x0 + w, y0);
    p.lineTo(x0, y0);
    frame.holes.push(p);
  };
  const pw = 0.62;
  const ph = 0.9;
  const m = 0.07;
  pane(-pw - m / 2, m / 2, pw, ph);
  pane(m / 2, m / 2, pw, ph);
  pane(-pw - m / 2, -ph - m / 2, pw, ph);
  pane(m / 2, -ph - m / 2, pw, ph);
  const occluder = new THREE.Mesh(
    new THREE.ShapeGeometry(frame),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  occluder.position.copy(target).addScaledVector(sunDir, 2.6).add(new THREE.Vector3(0, 0.15, 0));
  occluder.lookAt(sun.position);
  occluder.castShadow = true;
  scene.add(occluder);
};

// ---------- shared pieces ----------

const tube = (points: V3[], radius: number, color: string, segs = 16, radial = 6, taper = 1) => {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  if (taper !== 1) {
    // Thin the tube toward its tip (taper = tip radius / base radius).
    const pos = geo.attributes.position;
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let j = 0; j <= segs; j++) {
      curve.getPointAt(j / segs, c);
      const k = 1 + (taper - 1) * (j / segs);
      for (let r = 0; r <= radial; r++) {
        const i = j * (radial + 1) + r;
        v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(k).add(c);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
  }
  const mesh = shadowed(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 })));
  // TubeGeometry indexes segment by segment from the start of the curve, so a
  // draw range reveals the tube as if it were growing out from its base.
  const grow = (p: number) => {
    const n = Math.floor(clamp01(p) * segs);
    mesh.visible = n > 0;
    geo.setDrawRange(0, n * radial * 6);
  };
  grow(0);
  return { mesh, curve, grow };
};

const phase = (t: number, start: number, dur: number) => clamp01((t - start) / dur);

type Plant = {
  root: THREE.Group;
  anchors: Record<string, V3>;
  /** Seconds until the plant is fully grown. */
  duration: number;
  update: (t: number) => void;
  touchTargets: THREE.Object3D[];
  touch?: (pointLocal: V3, t: number, hit?: THREE.Intersection) => void;
  /** React to the pointer just passing over the touch targets (no click needed). */
  hoverTouch?: boolean;
};

// ---------- real plant models (Poly Haven, CC0) ----------

const MODEL_URLS = {
  syngonium: new URL('./assets/models/potted_plant_02.glb', import.meta.url).href,
  haworthia: new URL('./assets/models/potted_plant_04.glb', import.meta.url).href,
  oxalis: new URL('./assets/models/shrub_sorrel_01.glb', import.meta.url).href,
  clayPot: new URL('./assets/models/planter_pot_clay.glb', import.meta.url).href,
  pachira: new URL('./assets/models/pachira_aquatica_01.glb', import.meta.url).href,
  fern: new URL('./assets/models/fern_02.glb', import.meta.url).href,
};

const gltfCache = new Map<string, Promise<GLTF>>();
const loadModel = (url: string) => {
  let p = gltfCache.get(url);
  if (!p) {
    p = new GLTFLoader().loadAsync(url).then((gltf) => {
      // Cached across page visits: never dispose these.
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.userData.shared = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.userData.shared = true;
        for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap, mat.metalnessMap]) {
          if (tex) tex.userData.shared = true;
        }
      });
      return gltf;
    });
    gltfCache.set(url, p);
  }
  return p;
};

// ---------- growth shader ----------
// Every organ (connected piece of the mesh) carries its own pivot and timing,
// so the GPU can grow it in place:
//   kind 0 stem    — elongates from its base
//   kind 1 leaf    — rises as a rolled spike, then unrolls and expands from the petiole out
//   kind 2 leaflet — hangs folded down, then lifts open (and droops again when touched)
//   kind 3 petal   — closed, twisted bud that untwists and opens

type GrowthUniforms = { uTime: { value: number }; uFold: { value: number } };

const growthChunk = /* glsl */ `
  float gT = clamp((uTime - aGrow.x) / aGrow.y, 0.0, 1.0);
  float sT = clamp((uTime - aStemGrow.x) / aStemGrow.y, 0.0, 1.0);
  float sE = sT * sT * (3.0 - 2.0 * sT);
  // Where the parent stem's tip is right now (the pivot itself once the stem is grown).
  vec3 gPivot = aStemBase + (aPivot - aStemBase) * sE;
  vec3 gOff = transformed - aPivot;
  float gD = length(gOff);
  float gE = gT * gT * (3.0 - 2.0 * gT);
  if (aKind < 0.5) {
    gOff *= gE;
  } else if (aKind < 1.5) {
    // Leaf frame: A along the midrib, N the upper surface, S across the blade.
    vec3 A = aAxis;
    vec3 N = aNorm;
    vec3 S = normalize(cross(A, N));
    float la = dot(gOff, A);
    float ls = dot(gOff, S);
    float ln = dot(gOff, N);
    // Rolled tight around the midrib at first, unrolling gradually.
    float u = smoothstep(0.12, 1.0, gT);
    float c = (1.0 - u) * 3.0 / max(aWidth, 1e-4);
    if (c > 1e-3) {
      float ph = ls * c;
      ln += (1.0 - cos(ph)) / c;
      ls = sin(ph) / c;
    }
    vec3 o = A * la + S * ls + N * ln;
    // Emerges pointing straight up, then leans out to its final angle.
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 k = cross(A, up);
    float kl = length(k);
    if (kl > 1e-4) {
      k /= kl;
      float th = acos(clamp(dot(A, up), -1.0, 1.0)) * (1.0 - smoothstep(0.05, 0.8, gT));
      float ct = cos(th);
      float st = sin(th);
      o = o * ct + cross(k, o) * st + k * dot(k, o) * (1.0 - ct);
    }
    gOff = o * mix(0.2, 1.0, gE) * smoothstep(0.0, 0.06, gT);
  } else if (aKind > 4.5) {
    // Fiddlehead: the part of the frond past the unrolled length s0 stays
    // coiled (upper surface inside) and uncoils from base to tip.
    vec3 A = aAxis;
    vec3 N = aNorm;
    vec3 S = normalize(cross(A, N));
    float la = dot(gOff, A);
    float ls = dot(gOff, S);
    float ln = dot(gOff, N);
    float L = aWidth;
    float s0 = L * smoothstep(0.12, 1.0, gT);
    float k = 1.0 / (0.06 * L + 0.003);
    vec3 o = A * la + S * ls + N * ln;
    if (la > s0) {
      float th = (la - s0) * k;
      vec3 tN = N * cos(th) - A * sin(th);
      o = A * s0 + (A * sin(th) + N * (1.0 - cos(th))) / k + S * ls + tN * ln;
    }
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 kx = cross(A, up);
    float kl = length(kx);
    if (kl > 1e-4) {
      kx /= kl;
      float th = acos(clamp(dot(A, up), -1.0, 1.0)) * (1.0 - smoothstep(0.1, 0.95, gT));
      float ct = cos(th);
      float st = sin(th);
      o = o * ct + cross(kx, o) * st + kx * dot(kx, o) * (1.0 - ct);
    }
    gOff = o * mix(0.35, 1.0, gE) * smoothstep(0.0, 0.05, gT);
  } else if (aKind > 3.5) {
    float u = smoothstep(0.3, 1.0, gT);
    vec3 rolled = vec3(gOff.x * 0.1, gD, gOff.z * 0.1);
    gOff = mix(rolled, gOff, u);
    gOff *= clamp(gT * 1.7 - aDist * 0.7, 0.0, 1.0);
  } else if (aKind < 2.5) {
    float th = (1.0 - gE) * 1.45 + uFold * 1.2;
    float r = length(gOff.xz);
    vec2 dir = r > 1e-6 ? gOff.xz / r : vec2(0.0);
    float r2 = r * cos(th) + gOff.y * sin(th);
    float y2 = gOff.y * cos(th) - r * sin(th);
    gOff = vec3(dir.x * r2, y2, dir.y * r2);
    gOff *= smoothstep(0.0, 0.3, gT) * (0.35 + 0.65 * gE);
  } else {
    float u = smoothstep(0.4, 1.0, gT);
    float tw = (1.0 - u) * 1.8;
    vec3 closed = vec3(gOff.x * 0.15, gD * 0.9, gOff.z * 0.15);
    vec3 o = mix(closed, gOff, u);
    float c = cos(tw);
    float s = sin(tw);
    o.xz = mat2(c, -s, s, c) * o.xz;
    gOff = o * smoothstep(0.0, 0.4, gT);
  }
  transformed = gPivot + gOff;
`;

const patchGrowth = (mat: THREE.Material, u: GrowthUniforms) => {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uFold = u.uFold;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec3 aPivot;
attribute vec2 aGrow;
attribute float aKind;
attribute float aDist;
attribute vec3 aStemBase;
attribute vec2 aStemGrow;
attribute vec3 aAxis;
attribute vec3 aNorm;
attribute float aWidth;
uniform float uTime;
uniform float uFold;`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${growthChunk}`);
  };
  mat.customProgramCacheKey = () => 'plant-growth';
};

const applyGrowth = (mesh: THREE.Mesh) => {
  const u: GrowthUniforms = { uTime: { value: -1 }, uFold: { value: 0 } };
  const src = mesh.material as THREE.MeshStandardMaterial;
  const mat = src.clone();
  mat.side = THREE.DoubleSide;
  patchGrowth(mat, u);
  mesh.material = mat;
  const depth = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: src.map,
    alphaTest: src.alphaTest || 0,
  });
  patchGrowth(depth, u);
  mesh.customDepthMaterial = depth;
  return u;
};

// ---------- splitting a mesh into organs ----------

type Organ = {
  verts: number[];
  pivot: V3;
  centroid: V3;
  minY: number;
  maxY: number;
  /** Surface area / bounding-box diagonal²: thin tubes (stems) score low, blades high. */
  flatness: number;
  kind: number;
  start: number;
  dur: number;
  /** Organs carried by a stem (leaflets, petals) ride on its growing tip. */
  stem?: Organ;
  /** Leaf frame for unrolling blades (kind 1). */
  axis?: V3;
  normal?: V3;
  width?: number;
};

const splitOrgans = (geo: THREE.BufferGeometry): Organ[] => {
  const pos = geo.attributes.position;
  const n = pos.count;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x: number) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  // Weld split vertices (UV seams) so one leaf stays one organ.
  const seen = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    const j = seen.get(k);
    if (j === undefined) seen.set(k, i);
    else union(i, j);
  }
  const index = geo.index;
  if (index) {
    for (let t = 0; t < index.count; t += 3) {
      union(index.getX(t), index.getX(t + 1));
      union(index.getX(t), index.getX(t + 2));
    }
  }
  const area = new Map<number, number>();
  if (index) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 0; t < index.count; t += 3) {
      a.fromBufferAttribute(pos, index.getX(t));
      b.fromBufferAttribute(pos, index.getX(t + 1)).sub(a);
      c.fromBufferAttribute(pos, index.getX(t + 2)).sub(a);
      const r = find(index.getX(t));
      area.set(r, (area.get(r) ?? 0) + b.cross(c).length() / 2);
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(i);
  }
  return [...groups.entries()].map(([rootId, verts]) => {
    const box = new THREE.Box3();
    const tmpV = new THREE.Vector3();
    for (const v of verts) box.expandByPoint(tmpV.fromBufferAttribute(pos, v));
    const diag2 = Math.max(1e-9, box.getSize(tmpV).lengthSq());
    const centroid = new THREE.Vector3();
    let minY = Infinity;
    let maxY = -Infinity;
    let low = verts[0];
    for (const v of verts) {
      const y = pos.getY(v);
      centroid.x += pos.getX(v);
      centroid.y += y;
      centroid.z += pos.getZ(v);
      if (y < minY) {
        minY = y;
        low = v;
      }
      maxY = Math.max(maxY, y);
    }
    centroid.divideScalar(verts.length);
    return {
      verts,
      pivot: new THREE.Vector3(pos.getX(low), pos.getY(low), pos.getZ(low)),
      centroid,
      minY,
      maxY,
      flatness: (area.get(rootId) ?? 0) / diag2,
      kind: 1,
      start: 0,
      dur: 1,
    };
  });
};

const writeGrowth = (geo: THREE.BufferGeometry, organs: Organ[]) => {
  const pos = geo.attributes.position;
  const n = pos.count;
  const pivot = new Float32Array(n * 3);
  const grow = new Float32Array(n * 2);
  const kind = new Float32Array(n);
  const dist = new Float32Array(n);
  const stemBase = new Float32Array(n * 3);
  const stemGrow = new Float32Array(n * 2);
  const axis = new Float32Array(n * 3);
  const norm = new Float32Array(n * 3);
  const width = new Float32Array(n);
  const p = new THREE.Vector3();
  for (const o of organs) {
    let maxD = 1e-6;
    for (const v of o.verts) maxD = Math.max(maxD, p.fromBufferAttribute(pos, v).distanceTo(o.pivot));
    for (const v of o.verts) {
      pivot.set([o.pivot.x, o.pivot.y, o.pivot.z], v * 3);
      grow.set([o.start, o.dur], v * 2);
      kind[v] = o.kind;
      dist[v] = p.fromBufferAttribute(pos, v).distanceTo(o.pivot) / maxD;
      const sb = o.stem ? o.stem.pivot : o.pivot;
      stemBase.set([sb.x, sb.y, sb.z], v * 3);
      stemGrow.set(o.stem ? [o.stem.start, o.stem.dur] : [-1000, 1], v * 2);
      const ax = o.axis ?? new THREE.Vector3(0, 1, 0);
      const nm = o.normal ?? new THREE.Vector3(0, 0, 1);
      axis.set([ax.x, ax.y, ax.z], v * 3);
      norm.set([nm.x, nm.y, nm.z], v * 3);
      width[v] = o.width ?? 1;
    }
  }
  geo.setAttribute('aPivot', new THREE.BufferAttribute(pivot, 3));
  geo.setAttribute('aGrow', new THREE.BufferAttribute(grow, 2));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geo.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
  geo.setAttribute('aStemBase', new THREE.BufferAttribute(stemBase, 3));
  geo.setAttribute('aStemGrow', new THREE.BufferAttribute(stemGrow, 2));
  geo.setAttribute('aAxis', new THREE.BufferAttribute(axis, 3));
  geo.setAttribute('aNorm', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('aWidth', new THREE.BufferAttribute(width, 1));
  return Math.max(...organs.map((o) => o.start + o.dur));
};

const organsOf = (geo: THREE.BufferGeometry, prepare: (organs: Organ[]) => void) => {
  const cached = geo.userData.organs as Organ[] | undefined;
  if (cached) return { organs: cached, duration: geo.userData.growDuration as number };
  const organs = splitOrgans(geo);
  prepare(organs);
  const duration = writeGrowth(geo, organs);
  geo.userData.organs = organs;
  geo.userData.growDuration = duration;
  return { organs, duration };
};

const prepareModel = (model: THREE.Object3D) => {
  model.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) shadowed(o);
  });
  model.updateMatrixWorld(true);
};

// Midrib axis (pivot → farthest point), upper-surface normal and half-width of a blade.
const leafFrame = (geo: THREE.BufferGeometry, o: Organ) => {
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  let tip = o.pivot.clone();
  for (const v of o.verts) {
    p.fromBufferAttribute(pos, v);
    if (p.distanceTo(o.pivot) > tip.distanceTo(o.pivot)) tip = p.clone();
  }
  const axis = tip.sub(o.pivot).normalize();
  const inOrgan = new Set(o.verts);
  const normal = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const index = geo.index as THREE.BufferAttribute;
  for (let t = 0; t < index.count; t += 3) {
    const i0 = index.getX(t);
    if (!inOrgan.has(i0)) continue;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, index.getX(t + 1)).sub(a);
    c.fromBufferAttribute(pos, index.getX(t + 2)).sub(a);
    normal.add(b.cross(c));
  }
  normal.addScaledVector(axis, -normal.dot(axis));
  if (normal.lengthSq() < 1e-12) normal.set(0, 1, 0).addScaledVector(axis, -axis.y);
  normal.normalize();
  if (normal.y < 0) normal.negate();
  const side = new THREE.Vector3().crossVectors(axis, normal);
  let width = 1e-4;
  for (const v of o.verts) width = Math.max(width, Math.abs(p.fromBufferAttribute(pos, v).sub(o.pivot).dot(side)));
  o.axis = axis;
  o.normal = normal;
  o.width = width;
};

// ---------- syngonium (arrowhead plant) ----------
// New leaves come up from the soil one after another, shortest first.

const buildSyngonium = async (rng: () => number): Promise<Plant> => {
  const gltf = await loadModel(MODEL_URLS.syngonium);
  const root = new THREE.Group();
  const model = gltf.scene.clone(true);
  prepareModel(model);
  root.add(model);
  const leaves = model.getObjectByName('potted_plant_02_leaves') as THREE.Mesh;
  const { organs, duration } = organsOf(leaves.geometry, (list) => {
    const pos = leaves.geometry.attributes.position;
    const pt = new THREE.Vector3();
    // Petioles first: each one pushes up out of the soil, shortest first.
    const petioles = list.filter((o) => o.flatness < 0.12);
    const blades = list.filter((o) => o.flatness >= 0.12);
    const tips = new Map<Organ, V3>();
    for (const pe of petioles) {
      let far = pe.pivot.clone();
      for (const v of pe.verts) {
        pt.fromBufferAttribute(pos, v);
        if (pt.distanceTo(pe.pivot) > far.distanceTo(pe.pivot)) far = pt.clone();
      }
      tips.set(pe, far);
    }
    petioles.sort((x, y) => x.maxY - y.maxY);
    petioles.forEach((pe, i) => {
      pe.kind = 0;
      pe.start = 0.1 + (i / Math.max(1, petioles.length - 1)) * 3.0 + rng() * 0.15;
      pe.dur = 0.8 + (tips.get(pe) as V3).distanceTo(pe.pivot) * 2.5;
    });
    // Side petioles that branch off another one wait until their parent is mostly grown.
    for (const pe of petioles) {
      if (pe.minY < 0.04) continue;
      let parent: Organ | undefined;
      let best = Infinity;
      for (const other of petioles) {
        if (other === pe) continue;
        for (const v of other.verts) {
          const d = pt.fromBufferAttribute(pos, v).distanceTo(pe.pivot);
          if (d < best) {
            best = d;
            parent = other;
          }
        }
      }
      if (parent) pe.start = Math.max(pe.start, parent.start + parent.dur * 0.75);
    }
    // Each blade waits for its own petiole, then unrolls from the petiole tip.
    for (const bl of blades) {
      let owner: Organ | undefined;
      let attach = bl.pivot.clone();
      let best = Infinity;
      for (const pe of petioles) {
        const tip = tips.get(pe) as V3;
        for (const v of bl.verts) {
          const d = pt.fromBufferAttribute(pos, v).distanceTo(tip);
          if (d < best) {
            best = d;
            owner = pe;
            attach = pt.clone();
          }
        }
      }
      bl.kind = 1;
      bl.dur = 3.2;
      if (owner && best < 0.05) {
        bl.pivot.copy(attach);
        bl.stem = owner;
        bl.start = owner.start + owner.dur * 0.92;
      } else {
        bl.start = 0.3 + rng() * 3;
      }
      leafFrame(leaves.geometry, bl);
    }
  });
  const u = applyGrowth(leaves);

  const toRoot = (v: V3) => v.clone().applyMatrix4(leaves.matrixWorld);
  const bladeList = organs.filter((o) => o.kind === 1);
  const petioleList = organs.filter((o) => o.kind === 0);
  const front = bladeList.reduce((b, o) => (o.centroid.z + o.centroid.y > b.centroid.z + b.centroid.y ? o : b));
  const tall = petioleList.reduce((b, o) => (o.maxY > b.maxY ? o : b));
  return {
    root,
    duration,
    anchors: {
      leaf: toRoot(front.centroid),
      stem: toRoot(tall.pivot.clone().lerp(tall.centroid, 0.45)),
      pot: new THREE.Vector3(0, 0.2, 0.235),
    },
    touchTargets: [],
    update: (t) => {
      u.uTime.value = t;
    },
  };
};

// ---------- oxalis (wood sorrel) ----------
// Stems lengthen, leaflets lift open from a folded droop, then twisted pink
// buds unwind into flowers. Touching the plant folds the leaves down again.

const soilTexture = (rng: () => number) =>
  canvasTexture(256, 256, (g) => {
    g.fillStyle = '#2b1f17';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const l = 8 + rng() * 22;
      g.fillStyle = `hsl(${20 + rng() * 15}, ${20 + rng() * 20}%, ${l}%)`;
      const s = 1 + rng() * 3.5;
      g.beginPath();
      g.arc(rng() * 256, rng() * 256, s, 0, Math.PI * 2);
      g.fill();
    }
  });

const oxalisFoldAt = (e: number) => {
  if (e < 0) return 0;
  if (e < 0.5) return smooth(e / 0.5);
  if (e < 3.5) return 1;
  return 1 - smooth((e - 3.5) / 3);
};

const buildOxalis = async (rng: () => number): Promise<Plant> => {
  const [sorrel, potGltf] = await Promise.all([loadModel(MODEL_URLS.oxalis), loadModel(MODEL_URLS.clayPot)]);
  const root = new THREE.Group();
  const pot = potGltf.scene.clone(true);
  prepareModel(pot);
  root.add(pot);
  const soilY = 0.196;
  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.118, 40),
    new THREE.MeshStandardMaterial({ map: soilTexture(rng), roughness: 1 }),
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(-0.001, soilY, 0.011);
  root.add(shadowed(soil, false, true));

  const variants: THREE.Mesh[] = [];
  sorrel.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) variants.push(o as THREE.Mesh);
  });

  // Sample the texture so organs can be told apart by color (pink petals).
  const srcMat = variants[0].material as THREE.MeshStandardMaterial;
  const img = srcMat.map?.image as CanvasImageSource & { width: number; height: number };
  let pixels: Uint8ClampedArray | null = null;
  let iw = 0;
  let ih = 0;
  if (img && img.width) {
    iw = img.width;
    ih = img.height;
    const c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.drawImage(img, 0, 0);
    pixels = g.getImageData(0, 0, iw, ih).data;
  }

  const prep = (geo: THREE.BufferGeometry) =>
    organsOf(geo, (organs) => {
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      const stems = organs.filter((o) => o.minY < 0.002 && o.maxY - o.minY > 0.004);
      stems.sort((a, b) => a.maxY - b.maxY);
      const tops = stems.map((s) => {
        let best = s.verts[0];
        for (const v of s.verts) if (pos.getY(v) > pos.getY(best)) best = v;
        return new THREE.Vector3().fromBufferAttribute(pos, best);
      });
      stems.forEach((s, i) => {
        s.kind = 0;
        s.start = i * 0.32 + rng() * 0.15;
        s.dur = 0.9 + (s.maxY / 0.05) * 0.7;
      });
      for (const o of organs) {
        if (stems.includes(o)) continue;
        let r = 0;
        let gsum = 0;
        if (pixels && uv) {
          for (const v of o.verts) {
            const x = Math.min(iw - 1, Math.max(0, Math.floor((uv.getX(v) % 1) * iw)));
            const y = Math.min(ih - 1, Math.max(0, Math.floor((uv.getY(v) % 1) * ih)));
            r += pixels[(y * iw + x) * 4];
            gsum += pixels[(y * iw + x) * 4 + 1];
          }
        }
        const petal = pixels ? (r - gsum) / o.verts.length > 25 : o.verts.length <= 15;
        let si = 0;
        let bd = Infinity;
        tops.forEach((tp, i) => {
          const d = tp.distanceTo(o.centroid);
          if (d < bd) {
            bd = d;
            si = i;
          }
        });
        const stem = stems[si];
        if (stem) {
          o.pivot.copy(tops[si]);
          o.stem = stem;
        }
        const s0 = stem ? stem.start : 0;
        const sd = stem ? stem.dur : 1;
        if (petal) {
          o.kind = 3;
          o.start = s0 + sd + 1.1 + rng() * 0.15;
          o.dur = 1.5;
        } else {
          o.kind = 2;
          o.start = s0 + sd * 0.9;
          o.dur = 1.1;
        }
      }
    });

  type Clump = { mesh: THREE.Mesh; u: GrowthUniforms; offset: number; trigger: number };
  const clumps: Clump[] = [];
  let duration = 0;
  const count = 15;
  for (let i = 0; i < count; i++) {
    const src = variants[i % variants.length];
    const { duration: d } = prep(src.geometry);
    const mesh = shadowed(new THREE.Mesh(src.geometry, src.material));
    const u = applyGrowth(mesh);
    const a = i * 2.39996;
    const r = 0.012 + 0.088 * Math.sqrt(i / (count - 1));
    mesh.position.set(Math.cos(a) * r, soilY - 0.002, 0.011 + Math.sin(a) * r);
    mesh.rotation.y = rng() * Math.PI * 2;
    mesh.scale.setScalar(2.5 + rng() * 0.7);
    root.add(mesh);
    const offset = r * 6 + rng() * 0.5;
    clumps.push({ mesh, u, offset, trigger: -1e9 });
    duration = Math.max(duration, d + offset);
  }
  root.updateMatrixWorld(true);

  // Anchors: a front leaflet and a flower.
  let leafAnchor = new THREE.Vector3(0, 0.3, 0.1);
  let flowerAnchor = new THREE.Vector3(0, 0.33, 0);
  let bestLeaf = -Infinity;
  let bestFlower = -Infinity;
  for (const c of clumps) {
    for (const o of c.mesh.geometry.userData.organs as Organ[]) {
      const w = o.centroid.clone().applyMatrix4(c.mesh.matrixWorld);
      const score = w.z + w.y * 0.5;
      if (o.kind === 2 && score > bestLeaf) {
        bestLeaf = score;
        leafAnchor = w;
      }
      if (o.kind === 3 && score > bestFlower) {
        bestFlower = score;
        flowerAnchor = w;
      }
    }
  }

  return {
    root,
    duration,
    anchors: { leaf: leafAnchor, flower: flowerAnchor, pot: new THREE.Vector3(0, 0.1, 0.14) },
    touchTargets: clumps.map((c) => c.mesh),
    touch: (pLocal, t) => {
      for (const c of clumps) {
        const e = t - c.trigger;
        if (e > 0 && e < 3.5) continue;
        c.trigger = t + c.mesh.position.distanceTo(pLocal) * 4;
      }
    },
    update: (t) => {
      for (const c of clumps) {
        c.u.uTime.value = t - c.offset;
        c.u.uFold.value = oxalisFoldAt(t - c.trigger);
      }
    },
  };
};

// ---------- haworthia (zebra plant) ----------
// The rosette starts closed and opens outward, outer leaves first. Then a
// wiry flower stalk climbs up and small white flowers open from bottom to top.

const buildHaworthia = async (rng: () => number): Promise<Plant> => {
  const gltf = await loadModel(MODEL_URLS.haworthia);
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.6 });
  const stoolH = 0.42;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.028, 40), wood);
  top.position.y = stoolH;
  root.add(shadowed(top));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, stoolH + 0.02, 10), wood);
    leg.position.set(Math.cos(a) * 0.13, stoolH / 2, Math.sin(a) * 0.13);
    leg.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12);
    root.add(shadowed(leg));
  }

  const scale = 1.7;
  const model = gltf.scene.clone(true);
  model.scale.setScalar(scale);
  model.position.y = stoolH + 0.014;
  root.add(model);
  prepareModel(model);
  const ground = model.getObjectByName('potted_plant_04_ground');
  if (ground) ground.visible = false;
  const plant = model.getObjectByName('potted_plant_04_plant') as THREE.Mesh;
  const { organs, duration: rosette } = organsOf(plant.geometry, (list) => {
    const ring = (o: Organ) => Math.hypot(o.centroid.x, o.centroid.z) - o.maxY * 0.4;
    const order = [...list].sort((a, b) => ring(b) - ring(a));
    order.forEach((o, i) => {
      o.kind = 4;
      o.start = 0.1 + (i / Math.max(1, order.length - 1)) * 2.6 + rng() * 0.1;
      o.dur = 1.5;
    });
  });
  const u = applyGrowth(plant);
  root.updateMatrixWorld(true);

  // Flower stalk.
  const base = new THREE.Vector3(0.008, stoolH + 0.014 + 0.2 * scale * 0.72, 0.004);
  const stalkStart = rosette + 0.2;
  const stalkDur = 1.6;
  const stalk = tube(
    [
      base,
      base.clone().add(new THREE.Vector3(0.012, 0.14, 0.006)),
      base.clone().add(new THREE.Vector3(0.04, 0.27, 0.018)),
      base.clone().add(new THREE.Vector3(0.09, 0.33, 0.035)),
    ],
    0.0016,
    '#7d8b58',
    40,
  );
  root.add(stalk.mesh);
  const flowerGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0008, 0),
      new THREE.Vector2(0.0024, 0.003),
      new THREE.Vector2(0.0027, 0.009),
      new THREE.Vector2(0.0034, 0.0125),
      new THREE.Vector2(0.0058, 0.0145),
    ],
    10,
  );
  flowerGeo.translate(0, 0, 0);
  const flowerMat = new THREE.MeshStandardMaterial({ color: '#f1efe4', roughness: 0.5, side: THREE.DoubleSide });
  const flowers: { mesh: THREE.Mesh; start: number }[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let j = 0; j < 8; j++) {
    const tj = 0.55 + j * 0.058;
    const p = stalk.curve.getPoint(tj);
    const tan = stalk.curve.getTangent(tj);
    const side = new THREE.Vector3().crossVectors(tan, up).normalize().multiplyScalar(j % 2 ? 1 : -1);
    const dir = side.add(new THREE.Vector3(0, 0.25, 0)).normalize();
    const f = shadowed(new THREE.Mesh(flowerGeo, flowerMat));
    f.position.copy(p);
    f.quaternion.setFromUnitVectors(up, dir);
    f.scale.setScalar(0.0001);
    root.add(f);
    flowers.push({ mesh: f, start: stalkStart + stalkDur * tj });
  }
  const end = flowers[flowers.length - 1].start + 1.2;
  const writeFlowers = (t: number) => {
    stalk.grow(phase(t, stalkStart, stalkDur));
    for (const fl of flowers) {
      const bud = smooth(phase(t, fl.start, 0.4));
      const open = smooth(phase(t, fl.start + 0.45, 0.7));
      const radial = 0.45 + 0.55 * easeOutBack(open);
      fl.mesh.scale.set(Math.max(0.0001, bud * radial), Math.max(0.0001, bud), Math.max(0.0001, bud * radial));
    }
  };
  writeFlowers(-1);

  const toRoot = (v: V3) => v.clone().applyMatrix4(plant.matrixWorld);
  const front = organs.reduce((b, o) => (o.centroid.z - o.centroid.y * 0.3 > b.centroid.z - b.centroid.y * 0.3 ? o : b));
  return {
    root,
    duration: end,
    anchors: {
      leaf: toRoot(front.centroid),
      flower: stalk.curve.getPoint(0.8),
      stand: new THREE.Vector3(0.02, stoolH - 0.004, 0.168),
    },
    touchTargets: [],
    update: (t) => {
      u.uTime.value = t;
      if (t < end + 0.1) writeFlowers(t);
    },
  };
};

// ---------- mimosa (sensitive plant) ----------
// No usable scan exists, so the plant is procedural; the pot is the real clay
// planter. Habit follows Mimosa pudica: reddish, prickly stems arching outward,
// alternate leaves, each a petiole carrying two pairs of pinnae spread like
// fingers, every pinna lined with narrow leaflets held flat.
//
// Touch response follows the real sequence:
//   1. leaflets of the touched pinna snap shut in pairs, spreading outward from
//      the touch point (other pinnae follow from base to tip)
//   2. the four pinnae draw together
//   3. the petiole drops from its pulvinus
// Folded leaflets show their duller side, so the leaf looks briefly wilted.
// Recovery runs in reverse: petiole lifts, pinnae spread, leaflets reopen.

type MimosaPinna = {
  pivot: THREE.Object3D;
  fan: number;
  length: number;
  start: number;
  dur: number;
  leaflets: { j: number; u: number; z: number; side: number; len: number; wid: number; index: number }[];
  grow: (p: number) => void;
};

type MimosaLeaf = {
  stem: number;
  order: number;
  pivot: THREE.Object3D;
  pulvinus: THREE.Mesh;
  axis: V3;
  h: V3;
  P: V3;
  pinnae: MimosaPinna[];
  start: number;
  growEnd: number;
  trigger: number;
  hitPinna: number;
  hitJ: number;
  settled: boolean;
};

const mimosaLeafletTexture = () =>
  canvasTexture(256, 64, (g) => {
    const leaf = new Path2D();
    leaf.moveTo(6, 34);
    leaf.bezierCurveTo(10, 10, 70, 8, 160, 12);
    leaf.bezierCurveTo(215, 15, 246, 24, 250, 32);
    leaf.bezierCurveTo(246, 42, 215, 50, 160, 53);
    leaf.bezierCurveTo(70, 57, 10, 54, 6, 34);
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#3d7a33');
    grad.addColorStop(0.5, '#5f9c47');
    grad.addColorStop(1, '#3a7431');
    g.fillStyle = grad;
    g.fill(leaf);
    g.strokeStyle = 'rgba(190,220,150,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(8, 35);
    g.quadraticCurveTo(120, 30, 246, 32);
    g.stroke();
    g.strokeStyle = 'rgba(30,60,25,0.5)';
    g.lineWidth = 2;
    g.stroke(leaf);
  });

const buildMimosa = async (rng: () => number): Promise<Plant> => {
  const potGltf = await loadModel(MODEL_URLS.clayPot);
  const root = new THREE.Group();
  const pot = potGltf.scene.clone(true);
  prepareModel(pot);
  root.add(pot);
  const soilY = 0.196;
  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.118, 40),
    new THREE.MeshStandardMaterial({ map: soilTexture(rng), roughness: 1 }),
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(-0.001, soilY, 0.011);
  root.add(shadowed(soil, false, true));
  const foliage = new THREE.Group();
  foliage.position.set(0, soilY - 0.003, 0.011);
  root.add(foliage);

  const up = new THREE.Vector3(0, 1, 0);
  const growers: { start: number; dur: number; grow: (p: number) => void }[] = [];
  const leaves: MimosaLeaf[] = [];
  const leafletInfo: { leaf: number; pinna: number; j: number }[] = [];
  const prickles: { pos: V3; q: THREE.Quaternion; s: number; start: number }[] = [];
  const flowers: { c: V3; start: number }[] = [];
  const pulvinusGeo = new THREE.SphereGeometry(0.0021, 10, 8);
  pulvinusGeo.scale(1, 1.8, 1);
  pulvinusGeo.translate(0, 0.0025, 0);
  const pulvinusMat = new THREE.MeshStandardMaterial({ color: '#7c8c4a', roughness: 0.7 });
  const pairs = 17;
  let leafletCount = 0;
  const nb = 5;
  for (let b = 0; b < nb; b++) {
    const az = (b / nb) * Math.PI * 2 + rng() * 0.5;
    const o = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const reach = 0.15 + rng() * 0.09;
    const H = 0.17 + rng() * 0.08;
    const pt = (x: number, y: number) => o.clone().multiplyScalar(x).add(new THREE.Vector3(0, y, 0));
    const stem = tube(
      [pt(0.004, 0), pt(reach * 0.15, H * 0.4), pt(reach * 0.5, H * 0.85), pt(reach * 0.85, H), pt(reach, H * 0.94)],
      0.0034,
      '#74402f',
      56,
      7,
      0.4,
    );
    foliage.add(stem.mesh);
    const sStart = 0.1 + b * 0.25;
    const sDur = 2.2 + reach * 3;
    growers.push({ start: sStart, dur: sDur, grow: stem.grow });

    // Small recurved prickles along the stem.
    for (let k = 0; k < 16; k++) {
      const t = 0.08 + rng() * 0.88;
      const p = stem.curve.getPointAt(t);
      const tan = stem.curve.getTangentAt(t);
      const ang = rng() * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).addScaledVector(tan, -0).normalize();
      radial.addScaledVector(tan, -radial.dot(tan)).normalize();
      const dir = radial.clone().addScaledVector(tan, -0.7).normalize();
      prickles.push({
        pos: p.addScaledVector(radial, 0.0028 * (1 - 0.6 * t)),
        q: new THREE.Quaternion().setFromUnitVectors(up, dir),
        s: 0.7 + rng() * 0.5,
        start: sStart + sDur * t,
      });
    }

    const nodeTs = [0.22, 0.34, 0.46, 0.57, 0.67, 0.76, 0.85, 0.93];
    nodeTs.forEach((t, order) => {
      const P = stem.curve.getPointAt(t);
      const tan = stem.curve.getTangentAt(t);
      const phi = az + (order % 2 ? 1 : -1) * (0.9 + rng() * 0.5);
      const side = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
      side.addScaledVector(tan, -side.dot(tan)).normalize();
      const youth = t; // leaves near the tip are smaller
      const elev = 0.5 + rng() * 0.25;
      const petDir = side.clone().multiplyScalar(Math.cos(elev)).add(new THREE.Vector3(0, Math.sin(elev), 0)).addScaledVector(tan, 0.35).normalize();
      const h = new THREE.Vector3(petDir.x, 0, petDir.z).normalize();
      const leafStart = sStart + sDur * t;
      const petLen = (0.032 + rng() * 0.012) * (1.1 - 0.35 * youth);

      const pivot = new THREE.Object3D();
      pivot.position.copy(P);
      foliage.add(pivot);
      const pulvinus = shadowed(new THREE.Mesh(pulvinusGeo, pulvinusMat));
      pulvinus.quaternion.setFromUnitVectors(up, petDir);
      pulvinus.scale.setScalar(0.0001);
      pivot.add(pulvinus);
      const Q = petDir.clone().multiplyScalar(petLen);
      const petiole = tube(
        [new THREE.Vector3(), petDir.clone().multiplyScalar(petLen * 0.5).add(new THREE.Vector3(0, 0.002, 0)), Q],
        0.0011,
        '#6f7a3e',
        10,
        5,
        0.7,
      );
      pivot.add(petiole.mesh);
      growers.push({ start: leafStart, dur: 0.45, grow: petiole.grow });

      const leafIndex = leaves.length;
      const pinnae: MimosaPinna[] = [];
      [-0.62, -0.21, 0.21, 0.62].forEach((fan, pi) => {
        const length = (0.045 + rng() * 0.018) * (1.15 - 0.4 * youth) * (Math.abs(fan) > 0.4 ? 0.88 : 1);
        const pp = new THREE.Object3D();
        pp.position.copy(Q);
        pivot.add(pp);
        const droopZ = -0.004;
        const rachis = tube(
          [new THREE.Vector3(), new THREE.Vector3(0, length * 0.5, droopZ * 0.25), new THREE.Vector3(0, length, droopZ)],
          0.00065,
          '#5e8436',
          16,
          4,
          0.6,
        );
        pp.add(rachis.mesh);
        const start = leafStart + 0.35 + Math.abs(fan) * 0.15;
        const dur = 0.9;
        growers.push({ start, dur, grow: rachis.grow });
        const leaflets: MimosaPinna['leaflets'] = [];
        for (let j = 0; j < pairs; j++) {
          const f = j / (pairs - 1);
          const u = length * (0.06 + 0.92 * f);
          const len = 0.0078 * (0.55 + 0.45 * Math.sin(Math.PI * (0.15 + 0.8 * f)));
          for (const sd of [1, -1]) {
            leaflets.push({ j, u, z: droopZ * f * f, side: sd, len, wid: len * 0.26, index: leafletCount });
            leafletInfo[leafletCount] = { leaf: leafIndex, pinna: pi, j };
            leafletCount++;
          }
        }
        pinnae.push({ pivot: pp, fan, length, start, dur, leaflets, grow: rachis.grow });
      });
      leaves.push({
        stem: b,
        order,
        pivot,
        pulvinus,
        axis: new THREE.Vector3().crossVectors(petDir, up).normalize(),
        h,
        P: P.clone(),
        pinnae,
        start: leafStart,
        growEnd: Math.max(...pinnae.map((p) => p.start + p.dur * 1.4)) + 0.2,
        trigger: -1e9,
        hitPinna: -1,
        hitJ: 0,
        settled: false,
      });
      if (order === nodeTs.length - 2 && b % 2 === 0) {
        const c = P.clone().addScaledVector(side.clone().negate().add(new THREE.Vector3(0, 1.6, 0)).normalize(), 0.032);
        flowers.push({ c, start: 0 });
      }
    });
  }
  const leavesDone = Math.max(...leaves.map((l) => l.growEnd));
  flowers.forEach((f, i) => {
    f.start = leavesDone + 0.3 + i * 0.5;
  });

  // Prickles.
  const prickleGeo = new THREE.ConeGeometry(0.0006, 0.0032, 5);
  prickleGeo.translate(0, 0.0016, 0);
  const prickleMesh = new THREE.InstancedMesh(
    prickleGeo,
    new THREE.MeshStandardMaterial({ color: '#b98a6a', roughness: 0.6 }),
    prickles.length,
  );
  foliage.add(prickleMesh);

  // Leaflets.
  const leafletGeo = new THREE.PlaneGeometry(1, 1);
  leafletGeo.translate(0.5, 0, 0);
  const leafletMesh = new THREE.InstancedMesh(
    leafletGeo,
    new THREE.MeshStandardMaterial({ map: mimosaLeafletTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }),
    leafletCount,
  );
  shadowed(leafletMesh);
  foliage.add(leafletMesh);

  const tmp = new THREE.Matrix4();
  const tmpR = new THREE.Matrix4();
  const tmpS = new THREE.Matrix4();
  const tmpT = new THREE.Matrix4();
  const base = new THREE.Matrix4();
  const one = new THREE.Vector3();
  const white = new THREE.Color(1, 1, 1);
  const wilted = new THREE.Color(0.74, 0.8, 0.62);
  const col = new THREE.Color();
  const pd = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const sideV = new THREE.Vector3();

  const droopAt = (e: number) => (e < 0.45 ? 0 : e < 1.0 ? smooth((e - 0.45) / 0.55) : 1 - smooth((e - 3.4) / 2.6));
  const adductAt = (e: number) => (e < 0.2 ? 0 : e < 0.7 ? smooth((e - 0.2) / 0.5) : 1 - smooth((e - 4.6) / 2.4));
  const leafletFoldAt = (e: number, delay: number, j: number) => {
    if (e < delay) return 0;
    if (e < delay + 0.14) return smooth((e - delay) / 0.14);
    return 1 - smooth((e - 6.2 - j * 0.04) / 2.6);
  };

  const writeLeaf = (leaf: MimosaLeaf, t: number) => {
    const e = t - leaf.trigger;
    const grownLeaf = smooth(phase(t, leaf.start, 0.5));
    leaf.pulvinus.scale.setScalar(Math.max(0.0001, grownLeaf));
    leaf.pivot.quaternion.setFromAxisAngle(leaf.axis, -0.95 * droopAt(e));
    leaf.pivot.updateMatrix();
    const adduct = adductAt(e);
    leaf.pinnae.forEach((p, pi) => {
      const rp = phase(t, p.start, p.dur);
      // Young pinnae unfold from a closed bundle, like after a touch.
      const a = Math.max(adduct, 1 - smooth(rp * 1.3));
      pd.copy(leaf.h).applyAxisAngle(up, p.fan * (1 - 0.82 * a));
      pd.y = -0.05 + 0.32 * a;
      pd.normalize();
      nrm.copy(up).addScaledVector(pd, -pd.y).normalize();
      sideV.crossVectors(pd, nrm);
      tmp.makeBasis(sideV, pd, nrm);
      p.pivot.quaternion.setFromRotationMatrix(tmp);
      p.pivot.updateMatrix();
      base.multiplyMatrices(leaf.pivot.matrix, p.pivot.matrix);
      const direct = leaf.hitPinna === pi;
      for (const l of p.leaflets) {
        const g = smooth((rp * 1.25 - l.u / p.length) / 0.25);
        const delay = direct ? Math.abs(l.j - leaf.hitJ) * 0.03 : 0.12 + l.j * 0.028;
        const fold = Math.max(leafletFoldAt(e, delay, l.j), 1 - g);
        const fwd = 0.38 + 0.85 * fold;
        tmpT.makeTranslation(0, l.u, l.z);
        tmpR.makeRotationY(-l.side * fold * 1.42);
        tmp.multiplyMatrices(tmpT, tmpR);
        tmpR.makeRotationZ(l.side < 0 ? Math.PI - fwd : fwd);
        tmp.multiply(tmpR);
        const s = Math.max(0.0001, g);
        tmpS.makeScale(l.len * s, l.wid * s, 1);
        tmp.multiply(tmpS);
        tmp.premultiply(base);
        leafletMesh.setMatrixAt(l.index, tmp);
        leafletMesh.setColorAt(l.index, col.lerpColors(white, wilted, fold * 0.9));
      }
    });
  };
  for (const leaf of leaves) writeLeaf(leaf, -1);
  leafletMesh.instanceMatrix.needsUpdate = true;
  if (leafletMesh.instanceColor) leafletMesh.instanceColor.needsUpdate = true;

  const writePrickles = (t: number) => {
    prickles.forEach((p, i) => {
      const s = p.s * smooth(phase(t, p.start, 0.3));
      tmp.compose(p.pos, p.q, one.set(Math.max(0.0001, s), Math.max(0.0001, s), Math.max(0.0001, s)));
      prickleMesh.setMatrixAt(i, tmp);
    });
    prickleMesh.instanceMatrix.needsUpdate = true;
  };
  writePrickles(-1);

  // Pom-pom flowers: bud swells, then stamens burst outward, top first.
  const stamenGeo = new THREE.CylinderGeometry(0.00045, 0.00045, 1, 4);
  stamenGeo.translate(0, 0.5, 0);
  const perFlower = 120;
  const stamens = new THREE.InstancedMesh(
    stamenGeo,
    new THREE.MeshStandardMaterial({ color: '#e58ac0', roughness: 0.5 }),
    perFlower * flowers.length,
  );
  const anthers = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.0011, 5, 4),
    new THREE.MeshStandardMaterial({ color: '#f6e7a8', roughness: 0.5 }),
    perFlower * flowers.length,
  );
  const stamenData: { c: V3; q: THREE.Quaternion; dir: V3; len: number; start: number }[] = [];
  const buds: { mesh: THREE.Mesh; start: number }[] = [];
  for (const f of flowers) {
    const ped = tube([f.c.clone().add(new THREE.Vector3(0, -0.03, 0)), f.c.clone().add(new THREE.Vector3(0, -0.012, 0.002)), f.c], 0.0008, '#6f7a3e', 10, 4);
    foliage.add(ped.mesh);
    growers.push({ start: f.start - 0.5, dur: 0.5, grow: ped.grow });
    const bud = shadowed(
      new THREE.Mesh(new THREE.IcosahedronGeometry(0.0045, 1), new THREE.MeshStandardMaterial({ color: '#b65682', roughness: 0.6, flatShading: true })),
    );
    bud.position.copy(f.c);
    bud.scale.setScalar(0.0001);
    foliage.add(bud);
    buds.push({ mesh: bud, start: f.start });
    for (let k = 0; k < perFlower; k++) {
      const u = rng() * 2 - 1;
      const th = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dir = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
      stamenData.push({
        c: f.c,
        q: new THREE.Quaternion().setFromUnitVectors(up, dir),
        dir,
        len: 0.0095 + rng() * 0.003,
        start: f.start + 0.6 + (1 - u) * 0.3 + rng() * 0.2,
      });
    }
  }
  foliage.add(shadowed(stamens), anthers);
  const writeFlowers = (t: number) => {
    stamenData.forEach((s, i) => {
      const p = phase(t, s.start, 0.6);
      const len = Math.max(0.0001, s.len * easeOutBack(p));
      const w = p > 0 ? 1 : 0.0001;
      tmp.compose(s.c, s.q, one.set(w, len, w));
      stamens.setMatrixAt(i, tmp);
      tmp.makeScale(w, w, w).setPosition(s.c.x + s.dir.x * len, s.c.y + s.dir.y * len, s.c.z + s.dir.z * len);
      anthers.setMatrixAt(i, tmp);
    });
    stamens.instanceMatrix.needsUpdate = true;
    anthers.instanceMatrix.needsUpdate = true;
    for (const b of buds) {
      const swell = smooth(phase(t, b.start, 0.5));
      const shrink = smooth(phase(t, b.start + 0.6, 0.5));
      b.mesh.scale.setScalar(Math.max(0.0001, swell * (1 - 0.8 * shrink)));
    }
  };
  writeFlowers(-1);
  const flowerEnd = Math.max(leavesDone, ...stamenData.map((s) => s.start + 0.6));
  const stemsDone = Math.max(...prickles.map((p) => p.start + 0.3));
  for (const g of growers) g.grow(0);

  const toRoot = (v: V3) => v.clone().add(foliage.position);
  const frontLeaf = leaves.reduce((b, l) => (l.P.z + l.P.y * 0.3 > b.P.z + b.P.y * 0.3 ? l : b));
  const frontFlower = flowers.length ? flowers.reduce((b, f) => (f.c.z + f.c.y > b.c.z + b.c.y ? f : b)).c : frontLeaf.P;

  const trigger = (leaf: MimosaLeaf, t: number, pinna: number, j: number) => {
    if (t < leaf.growEnd) return;
    const e = t - leaf.trigger;
    if (e > -1 && e < 3.4) return; // still closed: nothing more to do
    leaf.trigger = t;
    leaf.hitPinna = pinna;
    leaf.hitJ = j;
  };

  return {
    root,
    duration: flowerEnd,
    anchors: {
      leaf: toRoot(frontLeaf.P.clone().addScaledVector(frontLeaf.h, 0.05).add(new THREE.Vector3(0, 0.012, 0))),
      flower: toRoot(frontFlower),
      pot: new THREE.Vector3(0, 0.1, 0.14),
    },
    touchTargets: [leafletMesh],
    hoverTouch: true,
    touch: (_pLocal, t, hit) => {
      const info = hit?.instanceId !== undefined ? leafletInfo[hit.instanceId] : undefined;
      if (!info) return;
      const leaf = leaves[info.leaf];
      trigger(leaf, t, info.pinna, info.j);
      // The signal travels along the stem to the neighbouring leaves.
      for (const other of leaves) {
        if (other.stem === leaf.stem && Math.abs(other.order - leaf.order) === 1) trigger(other, t + 0.8, -1, 0);
      }
    },
    update: (t) => {
      for (const g of growers) g.grow(phase(t, g.start, g.dur));
      if (t < stemsDone + 0.1) writePrickles(t);
      let dirty = false;
      for (const leaf of leaves) {
        const growing = t < leaf.growEnd;
        const e = t - leaf.trigger;
        const reacting = e > -1 && e < 9.5;
        if (growing || reacting || !leaf.settled) {
          writeLeaf(leaf, t);
          leaf.settled = !growing && !reacting;
          dirty = true;
        }
      }
      if (dirty) {
        leafletMesh.instanceMatrix.needsUpdate = true;
        if (leafletMesh.instanceColor) leafletMesh.instanceColor.needsUpdate = true;
      }
      if (t < flowerEnd + 0.7) writeFlowers(t);
    },
  };
};

// Surface distance from the base of a woody mesh, for branch-by-branch growth.
type WoodyGrowth = {
  /** Welded id for each vertex. */
  vertex: Int32Array;
  /** One representative vertex per welded id. */
  rep: Int32Array;
  dist: Float32Array;
  parent: Int32Array;
  maxD: number;
};

const woodyGrowthOf = (geo: THREE.BufferGeometry): WoodyGrowth => {
  const cached = geo.userData.woody as WoodyGrowth | undefined;
  if (cached) return cached;
  const pos = geo.attributes.position;
  const n = pos.count;
  const vertex = new Int32Array(n);
  const repList: number[] = [];
  const keyMap = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let id = keyMap.get(k);
    if (id === undefined) {
      id = repList.length;
      keyMap.set(k, id);
      repList.push(i);
    }
    vertex[i] = id;
  }
  const m = repList.length;
  const pts = repList.map((i) => new THREE.Vector3().fromBufferAttribute(pos, i));
  const adj: number[][] = Array.from({ length: m }, () => []);
  const index = geo.index as THREE.BufferAttribute;
  const link = (a: number, b: number) => {
    if (a !== b) {
      adj[a].push(b);
      adj[b].push(a);
    }
  };
  for (let t = 0; t < index.count; t += 3) {
    const a = vertex[index.getX(t)];
    const b = vertex[index.getX(t + 1)];
    const c = vertex[index.getX(t + 2)];
    link(a, b);
    link(b, c);
    link(c, a);
  }
  let minY = Infinity;
  for (const p of pts) minY = Math.min(minY, p.y);
  const dist = new Float32Array(m).fill(Infinity);
  const parent = new Int32Array(m).fill(-1);
  // Binary-heap Dijkstra seeded from every vertex at the base.
  const heap: [number, number][] = [];
  const push = (d: number, id: number) => {
    heap.push([d, id]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop() as [number, number];
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return top;
  };
  for (let id = 0; id < m; id++) {
    if (pts[id].y < minY + 0.012) {
      dist[id] = 0;
      push(0, id);
    }
  }
  while (heap.length) {
    const [d, id] = pop();
    if (d > dist[id]) continue;
    for (const nb of adj[id]) {
      const nd = d + pts[id].distanceTo(pts[nb]);
      if (nd < dist[nb]) {
        dist[nb] = nd;
        parent[nb] = id;
        // Push the stored (float32) value so the stale-entry check stays exact.
        push(dist[nb], nb);
      }
    }
  }
  let maxD = 0;
  for (let id = 0; id < m; id++) {
    if (!Number.isFinite(dist[id])) dist[id] = 0;
    maxD = Math.max(maxD, dist[id]);
  }
  const out: WoodyGrowth = { vertex, rep: Int32Array.from(repList), dist, parent, maxD };
  geo.userData.woody = out;
  return out;
};

// ---------- pachira (money tree) ----------
// The braided trunk rises first; petioles sprout from the branches as it
// climbs, and each palmate leaf opens like a fist uncurling.

const endsOf = (geo: THREE.BufferGeometry, o: Organ): [V3, V3] => {
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  let e1 = o.centroid.clone();
  for (const v of o.verts) {
    p.fromBufferAttribute(pos, v);
    if (p.distanceTo(o.centroid) > e1.distanceTo(o.centroid)) e1 = p.clone();
  }
  let e2 = e1.clone();
  for (const v of o.verts) {
    p.fromBufferAttribute(pos, v);
    if (p.distanceTo(e1) > e2.distanceTo(e1)) e2 = p.clone();
  }
  return [e1, e2];
};

const nearestVertex = (geo: THREE.BufferGeometry, o: Organ, target: V3) => {
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  let best = Infinity;
  const out = new THREE.Vector3();
  for (const v of o.verts) {
    const d = p.fromBufferAttribute(pos, v).distanceTo(target);
    if (d < best) {
      best = d;
      out.copy(p);
    }
  }
  return { point: out, dist: best };
};

const buildPachira = async (rng: () => number): Promise<Plant> => {
  const [tree, potSrc] = await Promise.all([loadModel(MODEL_URLS.pachira), loadModel(MODEL_URLS.syngonium)]);
  const root = new THREE.Group();
  // Reuse the terracotta pot and dirt from the arrowhead-plant scan.
  const pot = potSrc.scene.clone(true);
  const potLeaves = pot.getObjectByName('potted_plant_02_leaves');
  if (potLeaves) potLeaves.removeFromParent();
  prepareModel(pot);
  root.add(pot);

  const model = tree.scene.clone(true);
  for (const child of [...model.children]) if (!child.name.endsWith('_c')) child.removeFromParent();
  const bark = model.getObjectByName('pachira_aquatica_01_bark_c') as THREE.Mesh;
  const leaves = model.getObjectByName('pachira_aquatica_01_leaves_c') as THREE.Mesh;
  const holder = new THREE.Group();
  const scale = 0.62;
  holder.scale.setScalar(scale);
  holder.position.set(-0.05, 0.312, 0.02);
  model.position.set(-bark.position.x, 0, -bark.position.z);
  holder.add(model);
  root.add(holder);
  prepareModel(holder);

  // Woody growth follows the branch structure: every bark vertex gets its
  // distance from the base measured along the surface (Dijkstra over mesh
  // edges). A growth front moves outward along that distance; anything past it
  // is pulled back along its own path, so the trunk rises first, branches push
  // out from their forks and twigs come last, each with a tapering tip.
  const growth = woodyGrowthOf(bark.geometry);
  const srcBarkGeo = bark.geometry;
  bark.geometry = srcBarkGeo.clone();
  bark.geometry.userData = {};
  const barkPos = bark.geometry.attributes.position as THREE.BufferAttribute;
  const restPos = (srcBarkGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
  const trunkStart = 0.1;
  const trunkDur = 3.6;
  // Inverse of the front's easing: when does the front reach distance d?
  const frontTime = (d: number) => trunkStart + trunkDur * (1 - Math.sqrt(Math.max(0, 1 - d / growth.maxD)));
  let lastFront = -1;
  const writeBark = (t: number) => {
    const x = phase(t, trunkStart, trunkDur);
    const F = growth.maxD * (1 - (1 - x) * (1 - x));
    if (Math.abs(F - lastFront) < 1e-5) return;
    lastFront = F;
    const arr = barkPos.array as Float32Array;
    for (let v = 0; v < growth.vertex.length; v++) {
      const w = growth.vertex[v];
      let target = w;
      let child = -1;
      while (growth.dist[target] > F && growth.parent[target] >= 0) {
        child = target;
        target = growth.parent[target];
      }
      if (child < 0) {
        arr[v * 3] = restPos[v * 3];
        arr[v * 3 + 1] = restPos[v * 3 + 1];
        arr[v * 3 + 2] = restPos[v * 3 + 2];
        continue;
      }
      // Ease toward the next point on the path for a smooth, moving tip.
      const r = growth.rep[target];
      const c = growth.rep[child];
      const f = clamp01((F - growth.dist[target]) / Math.max(1e-6, growth.dist[child] - growth.dist[target]));
      arr[v * 3] = restPos[r * 3] + (restPos[c * 3] - restPos[r * 3]) * f;
      arr[v * 3 + 1] = restPos[r * 3 + 1] + (restPos[c * 3 + 1] - restPos[r * 3 + 1]) * f;
      arr[v * 3 + 2] = restPos[r * 3 + 2] + (restPos[c * 3 + 2] - restPos[r * 3 + 2]) * f;
    }
    barkPos.needsUpdate = true;
    bark.geometry.computeVertexNormals();
    bark.visible = F > 0.002;
  };
  const nearestBarkDist = (p: V3) => {
    let best = Infinity;
    let d = 0;
    for (let v = 0; v < growth.vertex.length; v++) {
      const dx = restPos[v * 3] - p.x;
      const dy = restPos[v * 3 + 1] - p.y;
      const dz = restPos[v * 3 + 2] - p.z;
      const q = dx * dx + dy * dy + dz * dz;
      if (q < best) {
        best = q;
        d = growth.dist[growth.vertex[v]];
      }
    }
    return d;
  };
  const barkBox = new THREE.Box3().setFromBufferAttribute(srcBarkGeo.attributes.position as THREE.BufferAttribute);

  const { organs, duration } = organsOf(leaves.geometry, (list) => {
    const geo = leaves.geometry;
    const petioles = list.filter((o) => o.flatness < 0.12);
    const clusters = list.filter((o) => o.flatness >= 0.12);
    const tips = new Map<Organ, V3>();
    for (const pe of petioles) {
      const [a, b] = endsOf(geo, pe);
      // The end closer to a leaf cluster is the tip; the other end sits on the branch.
      let da = Infinity;
      let db = Infinity;
      for (const c of clusters) {
        da = Math.min(da, nearestVertex(geo, c, a).dist);
        db = Math.min(db, nearestVertex(geo, c, b).dist);
      }
      const [baseP, tipP] = da < db ? [b, a] : [a, b];
      pe.pivot.copy(baseP);
      tips.set(pe, tipP);
      pe.kind = 0;
      // A petiole appears once the growing branch has reached its base.
      pe.start = frontTime(nearestBarkDist(baseP)) + 0.15 + rng() * 0.15;
      pe.dur = 0.6;
    }
    for (const c of clusters) {
      let owner: Organ | undefined;
      let best = Infinity;
      let attach = c.pivot.clone();
      for (const pe of petioles) {
        const n = nearestVertex(geo, c, tips.get(pe) as V3);
        if (n.dist < best) {
          best = n.dist;
          owner = pe;
          attach = n.point.clone();
        }
      }
      c.kind = 4;
      c.dur = 1.6;
      if (owner && best < 0.06) {
        c.pivot.copy(attach);
        c.start = owner.start + owner.dur * 0.9;
      } else {
        c.start = 1 + rng() * 2;
      }
    }
  });
  writeBark(-1);
  const u = applyGrowth(leaves);

  const toRoot = (v: V3) => v.clone().applyMatrix4(leaves.matrixWorld);
  const clusterList = organs.filter((o) => o.kind === 4);
  const front = clusterList.reduce((b, o) => (o.centroid.z + o.centroid.y * 0.3 > b.centroid.z + b.centroid.y * 0.3 ? o : b));
  return {
    root,
    duration: Math.max(duration, trunkStart + trunkDur),
    anchors: {
      leaf: toRoot(front.centroid),
      trunk: new THREE.Vector3(
        (barkBox.min.x + barkBox.max.x) * 0.25,
        barkBox.min.y + (barkBox.max.y - barkBox.min.y) * 0.25,
        0,
      ).applyMatrix4(bark.matrixWorld),
      pot: new THREE.Vector3(0, 0.2, 0.235),
    },
    touchTargets: [],
    update: (t) => {
      u.uTime.value = t;
      if (t < trunkStart + trunkDur + 0.1) writeBark(t);
    },
  };
};

// ---------- fern (sword fern) ----------
// Each frond comes up as a fiddlehead: a tight coil on an upright stalk that
// unrolls from the base toward the tip while leaning out to its final arc.

const buildFern = async (rng: () => number): Promise<Plant> => {
  const [fern, potSrc] = await Promise.all([loadModel(MODEL_URLS.fern), loadModel(MODEL_URLS.clayPot)]);
  const root = new THREE.Group();
  const potScale = 1.25;
  const pot = potSrc.scene.clone(true);
  pot.scale.setScalar(potScale);
  prepareModel(pot);
  root.add(pot);
  const soilY = 0.196 * potScale;
  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.118 * potScale, 48),
    new THREE.MeshStandardMaterial({ map: soilTexture(rng), roughness: 1 }),
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(0, soilY, 0.011 * potScale);
  root.add(shadowed(soil, false, true));

  const model = fern.scene.clone(true);
  for (const child of [...model.children]) if (child.name !== 'fern_02_b') child.removeFromParent();
  const clump = model.getObjectByName('fern_02_b') as THREE.Mesh;
  const holder = new THREE.Group();
  holder.scale.setScalar(0.5);
  holder.position.set(0, soilY + 0.004, 0.011 * potScale);
  holder.add(model);
  root.add(holder);
  prepareModel(holder);

  const { organs, duration } = organsOf(clump.geometry, (list) => {
    const geo = clump.geometry;
    const pos = geo.attributes.position;
    const p = new THREE.Vector3();
    const length = (o: Organ) => {
      let L = 0;
      for (const v of o.verts) L = Math.max(L, p.fromBufferAttribute(pos, v).distanceTo(o.pivot));
      return L;
    };
    // Arching fronds dip below their base, so the base is the point nearest
    // the centre of the clump, not the lowest point.
    for (const o of list) {
      let best = Infinity;
      for (const v of o.verts) {
        p.fromBufferAttribute(pos, v);
        const d = p.x * p.x + p.z * p.z + p.y * p.y * 0.25;
        if (d < best) {
          best = d;
          o.pivot.copy(p);
        }
      }
    }
    // Older, longer fronds unroll first; the young ones in the middle follow.
    const order = [...list].sort((a, b) => length(b) - length(a));
    order.forEach((o, i) => {
      leafFrame(geo, o);
      o.width = length(o);
      o.kind = 5;
      o.start = 0.1 + (i / Math.max(1, order.length - 1)) * 2.6 + rng() * 0.15;
      o.dur = 2.8;
    });
  });
  const u = applyGrowth(clump);

  const toRoot = (v: V3) => v.clone().applyMatrix4(clump.matrixWorld);
  const byFront = [...organs].sort((a, b) => b.centroid.z - a.centroid.z);
  const young = organs.reduce((b, o) => (o.start > b.start ? o : b));
  return {
    root,
    duration,
    anchors: {
      crozier: toRoot(young.centroid),
      frond: toRoot(byFront[0].centroid),
      sori: toRoot(byFront[Math.min(2, byFront.length - 1)].centroid.clone().lerp(byFront[Math.min(2, byFront.length - 1)].pivot, 0.3)),
    },
    touchTargets: [],
    update: (t) => {
      u.uTime.value = t;
    },
  };
};

// ---------- scene specs ----------

type PlantKind = 'syngonium' | 'oxalis' | 'haworthia' | 'mimosa' | 'pachira' | 'fern';
type Hotspot = { plant: number; anchor: string; title: string; body: string; tag: string };
type SceneSpec = {
  plants: { kind: PlantKind; x: number; z: number; rotY: number }[];
  hotspots: Hotspot[];
  radius: number;
  lookY: number;
  zoomY: number;
  phi: number;
  shift: number;
};

// Tall plants at the back, low ones in front, so all six read at once.
const overviewPlants: SceneSpec['plants'] = [
  { kind: 'pachira', x: -0.3, z: -0.42, rotY: 0.5 },
  { kind: 'syngonium', x: 0.36, z: -0.34, rotY: 0 },
  { kind: 'fern', x: -0.7, z: 0.06, rotY: 0.3 },
  { kind: 'haworthia', x: 0.64, z: 0.14, rotY: 0 },
  { kind: 'mimosa', x: -0.24, z: 0.38, rotY: 0.2 },
  { kind: 'oxalis', x: 0.34, z: 0.42, rotY: 0.3 },
];

const overviewHotspots: Hotspot[] = [
  { plant: 1, anchor: 'leaf', title: '合果芋', body: '觀葉植物，箭形葉片。喜歡明亮散射光與較高濕度。', tag: '01 · 室內明亮窗邊' },
  { plant: 5, anchor: 'flower', title: '紅花酢漿草', body: '三片心形小葉，入夜會閉合下垂；晴天開粉紅小花。', tag: '02 · 陽台、花台' },
  { plant: 3, anchor: 'leaf', title: '條紋十二卷', body: '多肉植物，葉面白色橫紋像斑馬，耐旱好養。', tag: '03 · 窗台、書桌' },
  { plant: 4, anchor: 'leaf', title: '含羞草', body: '豆科植物，一碰葉子就閉合下垂。滑過葉子試試！', tag: '04 · 陽光充足的陽台' },
  { plant: 0, anchor: 'leaf', title: '馬拉巴栗', body: '又稱發財樹，編辮樹幹配上掌狀複葉，耐陰好養。', tag: '05 · 客廳、辦公室' },
  { plant: 2, anchor: 'frond', title: '腎蕨', body: '新葉以蕨捲方式展開，喜歡潮濕與散射光。', tag: '06 · 浴室、北向窗邊' },
];

const SCENES: Record<string, SceneSpec> = {
  cover: { plants: overviewPlants, hotspots: overviewHotspots, radius: 1.04, lookY: 0.48, zoomY: 0.55, phi: 1.3, shift: 0.06 },
  thanks: { plants: overviewPlants, hotspots: overviewHotspots, radius: 1.0, lookY: 0.48, zoomY: 0.55, phi: 1.3, shift: 0.1 },
  syngonium: {
    plants: [{ kind: 'syngonium', x: 0, z: 0, rotY: 0.6 }],
    hotspots: [
      { plant: 0, anchor: 'leaf', title: '箭形葉', body: '幼葉呈箭頭狀，成熟後會裂成 3–5 片；新葉捲成筒狀冒出，再慢慢展開。', tag: 'LEAF · 葉' },
      { plant: 0, anchor: 'stem', title: '長葉柄', body: '葉柄從莖節一根根抽出，把葉片撐向光源。剪下帶節的莖可以水耕繁殖。', tag: 'STEM · 莖' },
      { plant: 0, anchor: 'pot', title: '陶盆與介質', body: '用排水良好的介質，表土乾了再澆透，避免盆底積水。', tag: 'POT · 盆' },
    ],
    radius: 0.62,
    lookY: 0.46,
    zoomY: 0.6,
    phi: 1.3,
    shift: 0.08,
  },
  oxalis: {
    plants: [{ kind: 'oxalis', x: 0, z: 0, rotY: 0 }],
    hotspots: [
      { plant: 0, anchor: 'leaf', title: '心形三出葉', body: '三片心形小葉，入夜或陰天會閉合下垂（睡眠運動）。點一下葉子試試！', tag: 'LEAF · 葉' },
      { plant: 0, anchor: 'flower', title: '粉紅花', body: '花苞呈旋捲狀，開花時像螺旋般展開；只在晴天打開，傍晚又合起來。', tag: 'FLOWER · 花' },
      { plant: 0, anchor: 'pot', title: '素燒陶盆', body: '透氣排水，適合喜歡乾爽根部的酢漿草。', tag: 'POT · 盆' },
    ],
    radius: 0.34,
    lookY: 0.25,
    zoomY: 0.3,
    phi: 1.18,
    shift: 0.08,
  },
  haworthia: {
    plants: [{ kind: 'haworthia', x: 0, z: 0, rotY: 0.4 }],
    hotspots: [
      { plant: 0, anchor: 'leaf', title: '斑馬紋葉', body: '葉背的白色凸點排成橫紋，肥厚葉片儲存水分，層層排成蓮座。', tag: 'LEAF · 葉' },
      { plant: 0, anchor: 'flower', title: '細長花梗', body: '春夏抽出細長花梗，白色小花由下往上依序綻放。', tag: 'FLOWER · 花' },
      { plant: 0, anchor: 'stand', title: '高腳盆架', body: '墊高通風，避免盆底積水悶根。', tag: 'STAND · 架' },
    ],
    radius: 0.46,
    lookY: 0.66,
    zoomY: 0.74,
    phi: 1.2,
    shift: 0.08,
  },
};

SCENES.pachira = {
  plants: [{ kind: 'pachira', x: 0, z: 0, rotY: 0.5 }],
  hotspots: [
    { plant: 0, anchor: 'leaf', title: '掌狀複葉', body: '5–7 片小葉排成手掌狀；新葉像握起的拳頭，從葉柄頂端慢慢張開。', tag: 'LEAF · 葉' },
    { plant: 0, anchor: 'trunk', title: '編辮樹幹', body: '幼苗時把幾株樹幹編在一起，長大後就成了辮子造型；樹幹基部膨大能儲水。', tag: 'TRUNK · 幹' },
    { plant: 0, anchor: 'pot', title: '陶盆與介質', body: '排水良好最重要，土乾了再澆透，盆底不要積水。', tag: 'POT · 盆' },
  ],
  radius: 0.72,
  lookY: 0.6,
  zoomY: 0.78,
  phi: 1.33,
  shift: 0.08,
};

SCENES.fern = {
  plants: [{ kind: 'fern', x: 0, z: 0, rotY: 0.3 }],
  hotspots: [
    { plant: 0, anchor: 'crozier', title: '蕨捲', body: '新葉捲成像小提琴頭的漩渦，由下往上慢慢展開。', tag: 'FIDDLEHEAD · 新芽' },
    { plant: 0, anchor: 'frond', title: '羽狀葉', body: '一回羽狀複葉，小羽片排在葉軸兩側，邊緣有細鋸齒。', tag: 'FROND · 葉' },
    { plant: 0, anchor: 'sori', title: '孢子', body: '蕨類不開花，靠葉背的孢子囊群繁殖。', tag: 'SPORE · 孢子' },
  ],
  radius: 0.34,
  lookY: 0.26,
  zoomY: 0.3,
  phi: 1.15,
  shift: 0.08,
};

SCENES.mimosa = {
  plants: [{ kind: 'mimosa', x: 0, z: 0, rotY: 0 }],
  hotspots: [
    { plant: 0, anchor: 'leaf', title: '會害羞的葉子', body: '二回羽狀複葉，被碰觸時小葉成對闔起、葉柄下垂，幾分鐘後再張開。滑過葉子試試！', tag: 'LEAF · 葉' },
    { plant: 0, anchor: 'flower', title: '粉紅花球', body: '夏秋開出絨球狀的頭狀花序，由許多細長雄蕊組成。', tag: 'FLOWER · 花' },
    { plant: 0, anchor: 'pot', title: '素燒陶盆', body: '透氣排水；根部有根瘤菌，能固定空氣中的氮。', tag: 'POT · 盆' },
  ],
  radius: 0.3,
  lookY: 0.31,
  zoomY: 0.36,
  phi: 1.1,
  shift: 0.08,
};

const BUILDERS: Record<PlantKind, (rng: () => number) => Promise<Plant>> = {
  syngonium: buildSyngonium,
  oxalis: buildOxalis,
  haworthia: buildHaworthia,
  mimosa: buildMimosa,
  pachira: buildPachira,
  fern: buildFern,
};

// ---------- React stage ----------

const stageCss = `
  @keyframes hp-pulse { 0% { transform: scale(1); opacity: .9 } 70% { transform: scale(2.4); opacity: 0 } 100% { opacity: 0 } }
  .hp-marker { position: absolute; left: 0; top: 0; width: 0; height: 0; transition: opacity .25s; }
  .hp-marker > span { position: absolute; left: -9px; top: -9px; width: 18px; height: 18px; pointer-events: none; }
  .hp-marker i { position: absolute; inset: 4px; border-radius: 50%; background: #ff8700; box-shadow: 0 0 0 2px rgba(255,255,255,.85); }
  .hp-marker b { position: absolute; inset: 0; border-radius: 50%; border: 2px solid #ff8700; animation: hp-pulse 2s ease-out infinite; }
  .hp-marker em { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; }
`;

const fadeMask = (fadeAt: number) =>
  `linear-gradient(to right, transparent 0%, #000 ${fadeAt}%), linear-gradient(transparent 0%, #000 9%, #000 92%, transparent 100%)`;

const PlantStage = ({
  scene,
  left,
  fadeAt,
  fallback,
}: {
  scene: keyof typeof SCENES;
  left: number;
  fadeAt: number;
  fallback: string;
}) => {
  const active = useIsActivePage();
  const spec = SCENES[scene];
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tipRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(-1);
  const [hover, setHover] = useState(-1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  useEffect(() => {
    if (!active) return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const rng = mulberry32(20261002);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const scene3 = new THREE.Scene();
    scene3.background = new THREE.Color('#2b2d2d');
    const target = new THREE.Vector3(0, spec.lookY, 0);
    buildRoom(scene3, rng, new THREE.Vector3(0, 0.45, 0));

    // Models load asynchronously; growth starts once every plant is in the scene.
    const plants: Plant[] = [];
    let hotspotWorld: V3[] = [];
    let loadedAt = -1;
    // Growth time advances only while frames are actually drawn, so a hidden
    // tab pauses the animation instead of finishing it off-screen.
    let growT = -1;
    let growEnd = Infinity;
    const stagger = 0.35;
    Promise.all(spec.plants.map((p) => BUILDERS[p.kind](rng)))
      .then((built) => {
        if (disposed) return;
        built.forEach((plant, i) => {
          const p = spec.plants[i];
          plant.root.position.set(p.x, 0, p.z);
          plant.root.rotation.y = p.rotY;
          plant.update(-1);
          scene3.add(plant.root);
          plants.push(plant);
        });
        scene3.updateMatrixWorld(true);
        hotspotWorld = spec.hotspots.map((h) => plants[h.plant].root.localToWorld(plants[h.plant].anchors[h.anchor].clone()));
        growEnd = Math.max(...plants.map((p, i) => p.duration + i * stagger)) + 0.2;
        loadedAt = clock.getElapsedTime();
        growT = 0;
        setReady(true);
      })
      .catch((err) => console.error('[home-plants] failed to load plant models', err));

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 40);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.9;
    controls.minPolarAngle = 0.85;
    controls.maxPolarAngle = 1.52;
    controls.minAzimuthAngle = -1.05;
    controls.maxAzimuthAngle = 1.05;

    let baseDist = 3;
    let w = 1;
    let h = 1;
    const resize = () => {
      w = host.offsetWidth;
      h = host.offsetHeight;
      const displayScale = host.getBoundingClientRect().width / Math.max(1, w);
      renderer.setPixelRatio(Math.min(2, Math.max(0.75, window.devicePixelRatio * displayScale)));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
      const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
      baseDist = spec.radius / Math.tan(Math.min(halfV, halfH));
      camera.setViewOffset(w, h, -spec.shift * w, 0, w, h);
      camera.updateProjectionMatrix();
    };
    resize();
    camera.position.setFromSphericalCoords(baseDist, spec.phi, 0).add(target);
    controls.minDistance = controls.maxDistance = baseDist;
    controls.update();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Click (not drag): touch the oxalis if a leaf is hit, otherwise zoom in/out.
    let zoomTarget = 0;
    let zoom = 0;
    let down: { x: number; y: number } | null = null;
    const raycaster = new THREE.Raycaster();
    const clock = new THREE.Clock();
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      for (const [i, plant] of plants.entries()) {
        if (!plant.touch || plant.touchTargets.length === 0) continue;
        const hit = raycaster.intersectObjects(plant.touchTargets, false)[0];
        if (hit) {
          plant.touch(plant.root.worldToLocal(hit.point.clone()), growT - i * stagger, hit);
          return;
        }
      }
      zoomTarget = zoomTarget ? 0 : 1;
    };
    // Hover: remember where the pointer is; the render loop raycasts once per frame.
    const hoverNdc = new THREE.Vector2();
    let hoverDirty = false;
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return;
      const rect = renderer.domElement.getBoundingClientRect();
      hoverNdc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      hoverDirty = true;
    };
    const hoverRay = new THREE.Raycaster();
    const checkHover = () => {
      if (!hoverDirty) return;
      hoverDirty = false;
      hoverRay.setFromCamera(hoverNdc, camera);
      for (const [i, plant] of plants.entries()) {
        if (!plant.hoverTouch || !plant.touch) continue;
        const hit = hoverRay.intersectObjects(plant.touchTargets, false)[0];
        if (hit) plant.touch(plant.root.worldToLocal(hit.point.clone()), growT - i * stagger, hit);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);

    const v = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      if (loadedAt >= 0) growT += dt;
      const tg = growT;
      if (loadedAt >= 0) checkHover();
      plants.forEach((p, i) => p.update(tg - i * stagger));

      zoom += (zoomTarget - zoom) * Math.min(1, dt * 4);
      const dist = baseDist * (1 - 0.42 * zoom);
      controls.minDistance = controls.maxDistance = dist;
      controls.target.y = THREE.MathUtils.lerp(spec.lookY, spec.zoomY, zoom);
      controls.update();
      renderer.render(scene3, camera);

      const markersOn = loadedAt >= 0 && tg > growEnd;
      hotspotWorld.forEach((p, i) => {
        const el = markerRefs.current[i];
        if (!el) return;
        v.copy(p).project(camera);
        const x = ((v.x + 1) / 2) * w;
        const y = ((1 - v.y) / 2) * h;
        el.style.transform = `translate(${x}px, ${y}px)`;
        const inView = v.z < 1 && x > w * 0.18 && x < w - 20 && y > 20 && y < h - 20;
        el.style.opacity = markersOn && inView ? '1' : '0';
        el.style.pointerEvents = markersOn && inView ? 'auto' : 'none';
        if (hoverRef.current === i && tipRef.current) {
          const flip = x + 400 > w;
          const ty = Math.max(24, Math.min(y - 24, h - tipRef.current.offsetHeight - 24));
          tipRef.current.style.transform = `translate(${flip ? x - 384 : x + 24}px, ${ty}px)`;
        }
      });
    };
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      controls.dispose();
      // Shared (cached glTF) resources stay alive for the next visit.
      scene3.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
        const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        if (mesh.customDepthMaterial) mats.push(mesh.customDepthMaterial);
        for (const m of mats) {
          if (m.userData.shared) continue;
          const std = m as THREE.MeshStandardMaterial;
          if (std.map && !std.map.userData.shared) std.map.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      setReady(false);
      setHover(-1);
    };
  }, [active, spec]);

  const mask = fadeMask(fadeAt);
  const tip = hover >= 0 ? spec.hotspots[hover] : null;

  return (
    <div
      data-osd-interactive={active ? '' : undefined}
      style={{ position: 'absolute', left, top: 0, width: 1920 - left, height: 1080 }}
    >
      <style>{stageCss}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          maskImage: mask,
          WebkitMaskImage: mask,
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
        {active ? (
          <div ref={hostRef} style={{ position: 'absolute', inset: 0, cursor: 'grab' }} />
        ) : (
          <img alt="" src={fallback} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
        )}
      </div>
      {active &&
        spec.hotspots.map((hs, i) => (
          <div
            key={hs.title}
            ref={(el) => {
              markerRefs.current[i] = el;
            }}
            className="hp-marker"
            style={{ opacity: 0 }}
          >
            <span>
              <b />
              <i />
            </span>
            <em onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(-1)} />
          </div>
        ))}
      {active && (
        <div
          ref={tipRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 360,
            padding: '22px 26px 24px',
            background: 'rgba(24, 25, 25, 0.88)',
            borderTop: '3px solid var(--osd-accent)',
            boxShadow: 'rgba(0, 0, 0, 0.45) 0px 18px 50px',
            opacity: tip ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--osd-accent)', marginBottom: 10 }}>{tip?.title}</div>
          <div style={{ fontSize: 22, lineHeight: 1.55, color: 'var(--osd-text)' }}>{tip?.body}</div>
          <div style={{ marginTop: 14, fontSize: 18, letterSpacing: '0.1em', color: 'rgba(255, 255, 255, 0.55)' }}>
            {tip?.tag}
          </div>
        </div>
      )}
      {active && !ready && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            letterSpacing: '0.2em',
            color: muted,
          }}
        >
          LOADING 3D…
        </div>
      )}
    </div>
  );
};

// =====================================================================
// page chrome
// =====================================================================

const CoverBackground = () => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      <rect width="1920" height="1080" fill="var(--osd-bg)" />
      <polygon points="691,0 1920,0 1920,125" fill="#393b3b" />
      <polygon points="0,0 504,0 154,900 0,845" fill="#2e2f2f" />
      <polygon points="504,0 154,900 634,1080 864,1080 235,902 499,14" fill="#272828" />
      <polygon points="0,845 154,900 634,1080 0,1080" fill="#2e2f2f" />
      <polygon points="0,989 413,1080 0,1080" fill="#393b3b" />
    </svg>
  </div>
);

const ContentBackground = () => (
  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      <rect width="1920" height="1080" fill="var(--osd-bg)" />
      <polygon points="0,0 1920,0 1920,101 0,8" fill="#2e2f2f" />
      <polygon points="1181,0 1920,0 1920,101" fill="#393b3b" />
      <polygon points="0,8 1920,101 1920,154 1900,154 0,16" fill="#272828" />
      <polygon points="1900,154 1920,154 1920,500 1838,1080 1757,1080 1900,500" fill="#272828" />
      <polygon points="1920,520 1920,1080 1838,1080" fill="#2e2f2f" />
    </svg>
  </div>
);

const Footer = () => {
  const { current, total } = useSlidePageNumber();
  return (
    <div style={{ position: 'absolute', left: 117, bottom: 56, fontSize: 22, letterSpacing: '0.1em', color: muted }}>
      {String(current).padStart(2, '0')} / {String(total).padStart(2, '0')}
    </div>
  );
};

const InteractionHint = ({ children }: { children?: ReactNode }) => (
  <div
    style={{
      position: 'absolute',
      right: 120,
      bottom: 56,
      fontSize: 20,
      letterSpacing: '0.12em',
      color: muted,
      pointerEvents: 'none',
    }}
  >
    {children ?? (
      <>
        移到 <span style={{ color: 'var(--osd-accent)' }}>●</span> 看說明 · 點擊放大 · 拖曳旋轉
      </>
    )}
  </div>
);

const PlantHeading = ({ eyebrow, name, latin }: { eyebrow: string; name: string; latin: string }) => (
  <div style={{ position: 'absolute', left: 117, top: 137, width: 820 }}>
    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--osd-accent)', marginBottom: 24 }}>
      {eyebrow}
    </div>
    <h2
      style={{
        fontFamily: 'var(--osd-font-display)',
        fontSize: 80,
        fontWeight: 700,
        lineHeight: 1.15,
        margin: 0,
        color: 'var(--osd-accent)',
        textTransform: 'uppercase',
      }}
    >
      {name}
    </h2>
    <div style={{ fontSize: 40, lineHeight: 1.3, textTransform: 'uppercase', marginTop: 8 }}>{latin}</div>
  </div>
);

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', gap: 28, fontSize: 'var(--osd-size-body)', lineHeight: 1.5 }}>
    <span style={{ color: 'var(--osd-accent)', fontWeight: 700, flexShrink: 0 }}>{label}</span>
    <span>{children}</span>
  </div>
);

const Placement = ({ children }: { children: ReactNode }) => (
  <div>
    <div
      style={{
        marginTop: 56,
        display: 'inline-block',
        padding: '12px 24px',
        border: `2px solid ${rule}`,
        fontSize: 24,
        letterSpacing: '0.08em',
        color: muted,
      }}
    >
      適合位置　<span style={{ color: 'var(--osd-text)' }}>{children}</span>
    </div>
  </div>
);

const FactList = ({ children }: { children: ReactNode }) => (
  <div style={{ position: 'absolute', left: 117, top: 470, width: 820, display: 'flex', flexDirection: 'column', gap: 28 }}>
    {children}
  </div>
);

// =====================================================================
// pages
// =====================================================================

const Cover: Page = () => (
  <div style={fill}>
    <CoverBackground />
    <PlantStage scene="cover" left={820} fadeAt={30} fallback={allPlants} />
    <div style={{ position: 'absolute', left: 254, top: 602, width: 760 }}>
      <h1
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontSize: 'var(--osd-size-hero)',
          fontWeight: 700,
          lineHeight: 1.15,
          margin: 0,
          color: 'var(--osd-accent)',
          textTransform: 'uppercase',
        }}
      >
        陽台與室內植物
      </h1>
      <div style={{ fontSize: 48, lineHeight: 1.3, textTransform: 'uppercase', marginTop: 8 }}>觀葉・草花・多肉・豆科・蕨類</div>
      <div style={{ marginTop: 24, fontSize: 28, color: muted, letterSpacing: '0.05em' }}>六種居家植物的生長環境與寓意</div>
    </div>
  </div>
);

const Syngonium: Page = () => (
  <div style={fill}>
    <ContentBackground />
    <PlantStage scene="syngonium" left={820} fadeAt={24} fallback={syngoniumShot} />
    <PlantHeading eyebrow="01 · 觀葉植物" name="合果芋" latin="Syngonium podophyllum · 天南星科" />
    <FactList>
      <Fact label="環境">明亮散射光，也耐半陰，18–30°C</Fact>
      <Fact label="照顧">表土乾了再澆水，喜歡較高濕度</Fact>
      <Fact label="寓意">名字有「合果」，象徵闔家和樂</Fact>
      <Placement>室內明亮窗邊</Placement>
    </FactList>
    <InteractionHint />
    <Footer />
  </div>
);

const Oxalis: Page = () => (
  <div style={fill}>
    <ContentBackground />
    <PlantStage scene="oxalis" left={820} fadeAt={24} fallback={oxalisShot} />
    <PlantHeading eyebrow="02 · 草本花卉" name="紅花酢漿草" latin="Oxalis debilis · 酢漿草科" />
    <FactList>
      <Fact label="環境">全日照到半日照，15–28°C，怕積水</Fact>
      <Fact label="特色">入夜葉片閉合下垂，晴天才開花</Fact>
      <Fact label="寓意">外形像幸運草，象徵幸運與守護</Fact>
      <Placement>陽光充足的陽台</Placement>
    </FactList>
    <InteractionHint />
    <Footer />
  </div>
);

const Haworthia: Page = () => (
  <div style={fill}>
    <ContentBackground />
    <PlantStage scene="haworthia" left={820} fadeAt={24} fallback={haworthiaShot} />
    <PlantHeading eyebrow="03 · 多肉植物" name="條紋十二卷" latin="Haworthiopsis fasciata · 阿福花科" />
    <FactList>
      <Fact label="環境">明亮散射光，避免烈日直曬</Fact>
      <Fact label="照顧">土乾透再澆，寧乾勿濕，夏季少水</Fact>
      <Fact label="寓意">耐旱好養，象徵堅韌與長久</Fact>
      <Placement>室內窗台、書桌</Placement>
    </FactList>
    <InteractionHint />
    <Footer />
  </div>
);

const Mimosa: Page = () => (
  <div style={fill}>
    <ContentBackground />
    <PlantStage scene="mimosa" left={820} fadeAt={24} fallback={mimosaShot} />
    <PlantHeading eyebrow="04 · 豆科植物" name="含羞草" latin="Mimosa pudica · 豆科" />
    <FactList>
      <Fact label="環境">全日照到半日照，20–30°C，怕積水</Fact>
      <Fact label="特色">一碰葉片就閉合；根瘤菌能固氮養土</Fact>
      <Fact label="寓意">象徵謙遜、含蓄的心意</Fact>
      <Placement>陽光充足的陽台</Placement>
    </FactList>
    <InteractionHint>
      滑過葉子它會害羞 · 移到 <span style={{ color: 'var(--osd-accent)' }}>●</span> 看說明 · 拖曳旋轉
    </InteractionHint>
    <Footer />
  </div>
);

const Pachira: Page = () => (
  <div style={fill}>
    <ContentBackground />
    <PlantStage scene="pachira" left={820} fadeAt={24} fallback={pachiraShot} />
    <PlantHeading eyebrow="05 · 觀葉植物" name="馬拉巴栗" latin="Pachira aquatica · 錦葵科" />
    <FactList>
      <Fact label="環境">明亮散射光，耐陰也耐旱，15–30°C</Fact>
      <Fact label="照顧">土乾了再澆透，避免盆底積水</Fact>
      <Fact label="寓意">又稱「發財樹」，象徵招財進寶</Fact>
      <Placement>客廳、辦公室</Placement>
    </FactList>
    <InteractionHint />
    <Footer />
  </div>
);

const Fern: Page = () => (
  <div style={fill}>
    <ContentBackground />
    <PlantStage scene="fern" left={820} fadeAt={24} fallback={fernShot} />
    <PlantHeading eyebrow="06 · 蕨類植物" name="腎蕨" latin="Nephrolepis cordifolia · 腎蕨科" />
    <FactList>
      <Fact label="環境">散射光到半陰，喜歡潮濕，15–28°C</Fact>
      <Fact label="照顧">盆土保持微濕，常噴霧增加濕度</Fact>
      <Fact label="寓意">四季常綠，象徵生生不息</Fact>
      <Placement>浴室、北向窗邊</Placement>
    </FactList>
    <InteractionHint />
    <Footer />
  </div>
);

const ThankYou: Page = () => (
  <div style={fill}>
    <ContentBackground />
    <PlantStage scene="thanks" left={620} fadeAt={28} fallback={thanksShot} />
    <div style={{ position: 'absolute', left: 117, top: 517 }}>
      <h2
        style={{
          fontFamily: 'var(--osd-font-display)',
          fontSize: 80,
          fontWeight: 700,
          lineHeight: 1.15,
          margin: 0,
          color: 'var(--osd-accent)',
          textTransform: 'uppercase',
        }}
      >
        Thank you!
      </h2>
      <div style={{ marginTop: 16, fontSize: 32, color: muted }}>選對位置，植物就會好好長大</div>
    </div>
  </div>
);

export const meta: SlideMeta = {
  title: '陽台與室內植物',
  createdAt: '2026-10-02T15:52:51.961Z',
};

export const notes: (string | undefined)[] = [
  '右側是 three.js 即時 3D 場景：可拖曳旋轉、點擊放大，滑到橘點看說明。',
  undefined,
  '酢漿草這頁可以點葉子，小葉會由近到遠依序閉合下垂，幾秒後再張開。',
  undefined,
  '含羞草這頁不用點，滑鼠滑過葉子就會害羞：小葉先成對闔起，葉柄接著下垂，旁邊的葉子也跟著反應，幾秒後慢慢恢復。',
  '馬拉巴栗：編辮樹幹先長高，葉柄沿著枝條冒出，掌狀葉像握拳的手慢慢張開。',
  '腎蕨：每片新葉都是一個蕨捲，從基部往尖端慢慢展開。',
];

export default [Cover, Syngonium, Oxalis, Haworthia, Mimosa, Pachira, Fern, ThankYou] satisfies Page[];
