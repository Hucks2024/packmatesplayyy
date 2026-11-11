/* Packmates: the 3D tour.
   A small world built here in code. Scrolling moves a camera through the story of one meetup:
   someone posts a run on their phone, the camera goes through the screen, the clock runs to the
   meetup time, and the strangers who tapped "I'm in" are out running. Then coffee, a walk, a
   kickabout, and up and away until the whole world map and its pins are in view.

   Loaded by js/main.js only when <head> decided the browser can draw it (html.tour).
   If anything here fails, main.js removes that class and the still page is shown instead.
   The people, places and pins are an illustration, not live data. */
import * as THREE from './vendor/three.module.min.js';
import { LAND } from './land.js';

const root = document.documentElement;
const story = document.querySelector('.story');
const stage = document.querySelector('.stage');
const canvas = document.querySelector('.stage__canvas');
if (!story || !stage || !canvas) throw new Error('tour: markup missing');

/* ---------- Little helpers ---------- */
const V3 = THREE.Vector3;
const v = (x, y, z) => new V3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const backOut = (t) => { const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
// A fixed random sequence, so the world is identical on every visit.
let seed = 20261111;
const rnd = () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rr = (a, b) => a + (b - a) * rnd();
const pick = (list) => list[Math.floor(rnd() * list.length)];

/* ---------- Renderer ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
let dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x4a2a86, 0.028);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 6000);

/* ---------- Sky, lights ---------- */
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(3000, 24, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 bot; varying vec3 d;
      void main(){ float h = smoothstep(-0.02, 0.62, d.y); gl_FragColor = vec4(mix(bot, top, h), 1.0);
      #include <colorspace_fragment>
      }`,
  }),
);
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

const stars = (() => {
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rr(0, Math.PI * 2), y = rr(-0.6, 1), r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 2400, y * 2400, Math.sin(a) * r * 2400], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = -9;
  scene.add(p);
  return p;
})();

const hemi = new THREE.HemisphereLight(0xd5dcff, 0x3a2a55, 0.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// The look of each part of the day, by scroll progress.
const MOODS = [
  { p: 0.00, top: 0x150d38, bot: 0x4a2a86, sun: 0x9aa6ff, sunI: 1.1, hemi: 0.75, fog: 0.026, exp: 1.2, stars: 1, dir: [-0.45, 0.8, 0.45] },
  { p: 0.32, top: 0x150d38, bot: 0x4a2a86, sun: 0x9aa6ff, sunI: 1.1, hemi: 0.75, fog: 0.026, exp: 1.2, stars: 1, dir: [-0.45, 0.8, 0.45] },
  { p: 0.33, top: 0x6c7de8, bot: 0xffb994, sun: 0xffd3a6, sunI: 2.6, hemi: 0.95, fog: 0.0095, exp: 1.05, stars: 0, dir: [0.75, 0.5, 0.35] },
  { p: 0.47, top: 0x6c7de8, bot: 0xffb994, sun: 0xffd3a6, sunI: 2.6, hemi: 0.95, fog: 0.0095, exp: 1.05, stars: 0, dir: [0.75, 0.5, 0.35] },
  { p: 0.52, top: 0x4d8fea, bot: 0xd3e6ff, sun: 0xfff2de, sunI: 2.9, hemi: 1.05, fog: 0.007, exp: 1.0, stars: 0, dir: [0.4, 0.85, 0.45] },
  { p: 0.59, top: 0x4d8fea, bot: 0xd3e6ff, sun: 0xfff2de, sunI: 2.9, hemi: 1.05, fog: 0.007, exp: 1.0, stars: 0, dir: [0.4, 0.85, 0.45] },
  { p: 0.635, top: 0x7a78d8, bot: 0xffc78e, sun: 0xffbb70, sunI: 2.7, hemi: 0.9, fog: 0.0085, exp: 1.05, stars: 0, dir: [-0.75, 0.4, 0.45] },
  { p: 0.70, top: 0x7a78d8, bot: 0xffc78e, sun: 0xffbb70, sunI: 2.7, hemi: 0.9, fog: 0.0085, exp: 1.05, stars: 0, dir: [-0.75, 0.4, 0.45] },
  { p: 0.74, top: 0x2a1c6e, bot: 0xd9659c, sun: 0xffa0c4, sunI: 1.7, hemi: 0.8, fog: 0.015, exp: 1.15, stars: 0.5, dir: [-0.6, 0.45, -0.3] },
  { p: 0.80, top: 0x2a1c6e, bot: 0xd9659c, sun: 0xffa0c4, sunI: 1.7, hemi: 0.8, fog: 0.012, exp: 1.15, stars: 0.5, dir: [-0.6, 0.45, -0.3] },
  { p: 0.845, top: 0x0d0822, bot: 0x170d30, sun: 0xc9bbff, sunI: 1.4, hemi: 0.9, fog: 0, exp: 1.15, stars: 1, dir: [-0.3, 0.9, 0.3] },
  { p: 1.00, top: 0x0d0822, bot: 0x170d30, sun: 0xc9bbff, sunI: 1.4, hemi: 0.9, fog: 0, exp: 1.15, stars: 1, dir: [-0.3, 0.9, 0.3] },
].map((m) => ({ ...m, top: new THREE.Color(m.top), bot: new THREE.Color(m.bot), sun: new THREE.Color(m.sun), dir: new V3(...m.dir).normalize() }));
const sunDir = new V3();
function setMood(p) {
  let i = 0;
  while (i < MOODS.length - 2 && p > MOODS[i + 1].p) i++;
  const a = MOODS[i], b = MOODS[i + 1], t = smooth(a.p, b.p, p);
  sky.material.uniforms.top.value.lerpColors(a.top, b.top, t);
  sky.material.uniforms.bot.value.lerpColors(a.bot, b.bot, t);
  scene.fog.color.lerpColors(a.bot, b.bot, t);
  scene.fog.density = lerp(a.fog, b.fog, t);
  sun.color.lerpColors(a.sun, b.sun, t);
  sun.intensity = lerp(a.sunI, b.sunI, t);
  hemi.intensity = lerp(a.hemi, b.hemi, t);
  renderer.toneMappingExposure = lerp(a.exp, b.exp, t);
  stars.material.opacity = lerp(a.stars, b.stars, t) * 0.85;
  sunDir.lerpVectors(a.dir, b.dir, t).normalize();
}

/* ---------- Materials and shapes ---------- */
const mats = new Map();
const mat = (color, rough = 0.85, extra) => {
  const key = color + ':' + rough + (extra ? JSON.stringify(extra) : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra }));
  return mats.get(key);
};
const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 9),
  blob: new THREE.IcosahedronGeometry(1, 1),
};
function mesh(geo, material, parent, pos, scale, rot) {
  const m = new THREE.Mesh(geo, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale !== undefined) { if (Array.isArray(scale)) m.scale.set(scale[0], scale[1], scale[2]); else m.scale.setScalar(scale); }
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const capsules = new Map();
const capsule = (r, len) => {
  const key = r + ':' + len;
  if (!capsules.has(key)) capsules.set(key, new THREE.CapsuleGeometry(r, len, 5, 12));
  return capsules.get(key);
};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/* ---------- The town: five places along a line, each one a scene ---------- */
const town = new THREE.Group();
scene.add(town);
const SPOT = [v(-62, 0, 0), v(-28, 0, -6), v(2, 0, 8), v(32, 0, -8), v(62, 0, 6)];
const at = (i, x, y, z) => v(SPOT[i].x + x, y, SPOT[i].z + z);
const places = SPOT.map((c) => { const g = new THREE.Group(); g.position.copy(c); town.add(g); return g; });

const ground = mesh(new THREE.CircleGeometry(260, 64), new THREE.MeshStandardMaterial({ color: 0x4f8f5c, roughness: 1, transparent: true }), town, [0, 0, 0], 1, [-Math.PI / 2, 0, 0]);
ground.castShadow = false;

function tree(parent, x, z, s = 1, colors = [0x3f8f5a, 0x4fa368, 0x2f7a52]) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = rr(0, 6);
  mesh(G.cyl, mat(0x6b4a3a), g, [0, 0.8, 0], [0.13, 1.6, 0.13]);
  const flat = { flatShading: true };
  mesh(G.blob, mat(pick(colors), 0.9, flat), g, [0, 2.3, 0], [1.15, 1.25, 1.15]);
  mesh(G.blob, mat(pick(colors), 0.9, flat), g, [0.55, 1.9, 0.2], 0.72);
  mesh(G.blob, mat(pick(colors), 0.9, flat), g, [-0.5, 2.0, -0.25], 0.66);
  parent.add(g);
  return g;
}
function pine(parent, x, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  mesh(G.cyl, mat(0x5a4032), g, [0, 0.4, 0], [0.11, 0.8, 0.11]);
  const m = mat(pick([0x2f6f55, 0x2a6650, 0x37785a]), 0.9, { flatShading: true });
  mesh(G.cone, m, g, [0, 1.3, 0], [0.95, 1.4, 0.95]);
  mesh(G.cone, m, g, [0, 2.1, 0], [0.72, 1.2, 0.72]);
  mesh(G.cone, m, g, [0, 2.8, 0], [0.48, 1.0, 0.48]);
  parent.add(g);
  return g;
}
function ringOf(parent, count, r0, r1, make, skip) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rr(-0.15, 0.15), r = rr(r0, r1);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (skip && skip(x, z)) continue;
    make(parent, x, z, rr(0.8, 1.35));
  }
}
function patch(parent, radius, color) {
  const m = mesh(new THREE.CircleGeometry(radius, 48), mat(color, 1), parent, [0, 0.02, 0], 1, [-Math.PI / 2, 0, 0]);
  m.castShadow = false;
  return m;
}

/* ---------- People ---------- */
const SKINS = [0xf2c9a5, 0xd9a273, 0xa9714b, 0x7a4b2f, 0xf6d7bd, 0xc68a5c];
const HAIRS = [0x2a1d18, 0x4a2f20, 0x151318, 0x8a5a2c, 0xd7b46a, 0x6b2e2e];
const TOPS = [0x7c3aed, 0xec4899, 0xfbbf24, 0x38bdf8, 0x34d399, 0xf97316, 0xffffff, 0xc026d3];
const BOTTOMS = [0x1f2340, 0x2b2f55, 0x3b3350, 0x23395d, 0x40304a];
const people = [];
function person(o = {}) {
  const skin = mat(o.skin ?? pick(SKINS), 0.7);
  const top = mat(o.top ?? pick(TOPS), 0.8);
  const bottom = mat(o.bottom ?? pick(BOTTOMS), 0.85);
  const hair = mat(o.hair ?? pick(HAIRS), 0.9);
  const shoe = mat(o.shoes ?? pick([0xffffff, 0xf43f5e, 0x22d3ee, 0xfde047]), 0.6);
  const g = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  g.add(hips);
  mesh(capsule(0.17, 0.34), top, hips, [0, 0.33, 0]);
  mesh(capsule(0.165, 0.06), bottom, hips, [0, 0.03, 0]);
  const head = new THREE.Group();
  head.position.y = 0.66;
  hips.add(head);
  mesh(G.sphere, skin, head, [0, 0.14, 0], 0.155);
  const cap = mesh(new THREE.SphereGeometry(0.165, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, head, [0, 0.145, -0.008], 1, [-0.32, 0, 0]);
  cap.receiveShadow = false;
  const style = o.style ?? Math.floor(rnd() * 3);
  if (style === 1) mesh(G.sphere, hair, head, [0, 0.3, -0.07], 0.075);                 // a bun
  if (style === 2) mesh(capsule(0.05, 0.16), hair, head, [0, 0.06, -0.17], 1, [0.35, 0, 0]);   // a ponytail
  const eye = mat(0x1b1626, 0.4);
  mesh(G.sphere, eye, head, [0.055, 0.16, 0.142], 0.017).castShadow = false;
  mesh(G.sphere, eye, head, [-0.055, 0.16, 0.142], 0.017).castShadow = false;
  const limb = (side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.235, 0.52, 0);
    hips.add(arm);
    mesh(capsule(0.055, 0.2), o.sleeves === false ? skin : top, arm, [0, -0.14, 0]);
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    arm.add(elbow);
    mesh(capsule(0.048, 0.18), skin, elbow, [0, -0.13, 0]);
    const hand = mesh(G.sphere, skin, elbow, [0, -0.28, 0], 0.058);
    const leg = new THREE.Group();
    leg.position.set(side * 0.095, 0, 0);
    hips.add(leg);
    mesh(capsule(0.078, 0.26), bottom, leg, [0, -0.2, 0]);
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    leg.add(knee);
    mesh(capsule(0.06, 0.26), o.shorts ? skin : bottom, knee, [0, -0.19, 0]);
    mesh(G.box, shoe, knee, [0, -0.43, 0.05], [0.11, 0.09, 0.24]);
    return { arm, elbow, hand, leg, knee };
  };
  const P = { g, hips, head, L: limb(1), R: limb(-1), phase: rr(0, 6), s: o.h ?? rr(0.9, 1.02) };
  g.scale.setScalar(P.s);
  people.push(P);
  return P;
}
// Poses. A positive turn of a leg or arm swings it back, a negative one forward.
function poseRun(P, t, speed = 9.5) {
  const ph = t * speed + P.phase;
  for (const [limb, off] of [[P.L, 0], [P.R, Math.PI]]) {
    const s = Math.sin(ph + off);
    limb.leg.rotation.x = -s * 0.85 - 0.12;
    limb.knee.rotation.x = 0.25 + 1.05 * (0.5 + 0.5 * Math.sin(ph + off - 1.35));
    limb.arm.rotation.x = s * 0.9;
    limb.elbow.rotation.x = -1.45;
  }
  P.hips.position.y = 0.9 + Math.abs(Math.sin(ph)) * 0.07;
  P.hips.rotation.x = 0.2;
  P.hips.rotation.y = Math.sin(ph) * 0.12;
  P.head.rotation.x = -0.12;
}
function poseWalk(P, t, speed = 5.2) {
  const ph = t * speed + P.phase;
  for (const [limb, off] of [[P.L, 0], [P.R, Math.PI]]) {
    const s = Math.sin(ph + off);
    limb.leg.rotation.x = -s * 0.5;
    limb.knee.rotation.x = 0.08 + 0.5 * (0.5 + 0.5 * Math.sin(ph + off - 1.3));
    limb.arm.rotation.x = s * 0.45;
    limb.elbow.rotation.x = -0.3;
  }
  P.hips.position.y = 0.91 + Math.abs(Math.sin(ph)) * 0.025;
  P.hips.rotation.y = Math.sin(ph) * 0.07;
  P.head.rotation.y = Math.sin(t * 0.7 + P.phase) * 0.35;
}
function poseSit(P, t) {
  const sip = Math.pow(Math.max(0, Math.sin(t * 0.55 + P.phase)), 14);
  for (const limb of [P.L, P.R]) { limb.leg.rotation.x = -1.45; limb.knee.rotation.x = 1.4; }
  P.hips.position.y = 0.6;
  P.hips.rotation.x = 0.08 + Math.sin(t * 0.9 + P.phase) * 0.03;
  P.L.arm.rotation.x = -0.75 - sip * 0.55; P.L.elbow.rotation.x = -1.0 - sip * 1.1; P.L.arm.rotation.z = -0.15;
  P.R.arm.rotation.x = -0.6 + Math.sin(t * 2.2 + P.phase) * 0.12; P.R.elbow.rotation.x = -1.2; P.R.arm.rotation.z = 0.15;
  P.head.rotation.y = Math.sin(t * 0.6 + P.phase * 2) * 0.5;
  P.head.rotation.x = Math.sin(t * 1.7 + P.phase) * 0.06;
}

/* ---------- The brand pin ---------- */
const pinGeo = (segments) => {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.588, 0.891)];
  for (let i = 1; i <= 14; i++) {
    const a = THREE.MathUtils.degToRad(-54 + (144 * i) / 14);
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a)), 1.7 + Math.sin(a)));
  }
  const g = new THREE.LatheGeometry(pts, segments);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), lo = new THREE.Color(0xf0489b), mid = new THREE.Color(0xc026d3), hi = new THREE.Color(0x8b5cf6);
  for (let i = 0; i < pos.count; i++) {
    const t = clamp(pos.getY(i) / 2.7);
    if (t < 0.5) c.lerpColors(lo, mid, t * 2); else c.lerpColors(mid, hi, (t - 0.5) * 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};
const bigPinGeo = pinGeo(28);
const bigPinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, emissive: 0x7c2fd0, emissiveIntensity: 0.55 });
const badge = (emoji) => canvasTex(256, 256, (g) => {
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill();
  g.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 128, 140);
});
const beacons = [];
function beacon(i, emoji, height = 6.2) {
  const g = new THREE.Group();
  g.position.set(0, height, 0);
  const pin = mesh(bigPinGeo, bigPinMat, g);
  pin.receiveShadow = false;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: badge(emoji), fog: true }));
  s.position.set(0, 1.72, 0);
  s.scale.setScalar(1.25);
  s.renderOrder = 2;
  s.material.depthTest = false;
  g.add(s);
  places[i].add(g);
  beacons.push({ g, base: height, phase: i * 1.3 });
  return g;
}

/* ---------- Place 0: evening, the host and the phone ---------- */
const host = person({ top: 0x7c3aed, bottom: 0x1f2340, skin: 0xd9a273, hair: 0x2a1d18, style: 1, shoes: 0xffffff, h: 1 });
let phone, phoneTex, phoneCtx, phoneLight, lampLight;
const floods = [];
const PHONE = { pos: new V3(), n: new V3() };
{
  const p = places[0];
  patch(p, 11, 0x56875a);
  const path = mesh(new THREE.PlaneGeometry(3.2, 30), mat(0xb9a9c9, 1), p, [0, 0.03, 0], 1, [-Math.PI / 2, 0, 0.5]);
  path.castShadow = false;
  p.add(host.g);
  // the arm that holds the phone, and the other one in a pocket
  host.L.arm.rotation.set(-0.3, 0, -0.14);
  host.L.elbow.rotation.x = -1.5;
  host.R.arm.rotation.set(0.05, 0, 0.06);
  host.R.elbow.rotation.x = -0.25;
  host.head.rotation.set(0.32, 0.22, 0);
  // a bench and a street lamp
  const bench = new THREE.Group();
  bench.position.set(-1.9, 0, -0.6);
  bench.rotation.y = 0.5;
  mesh(G.box, mat(0x8a5a3c), bench, [0, 0.45, 0], [1.7, 0.08, 0.5]);
  mesh(G.box, mat(0x8a5a3c), bench, [0, 0.8, -0.24], [1.7, 0.4, 0.07]);
  for (const x of [-0.7, 0.7]) mesh(G.box, mat(0x2b2540), bench, [x, 0.22, 0], [0.08, 0.45, 0.45]);
  p.add(bench);
  const lamp = new THREE.Group();
  lamp.position.set(1.7, 0, -1.2);
  mesh(G.cyl, mat(0x2b2540, 0.5), lamp, [0, 2.0, 0], [0.06, 4.0, 0.06]);
  mesh(G.cyl, mat(0x2b2540, 0.5), lamp, [0, 0.12, 0], [0.16, 0.24, 0.16]);
  mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xffe2a8 }), lamp, [0, 4.1, 0], 0.26).castShadow = false;
  // lights sit on the town itself, so their number never changes: a change makes the browser rebuild every material, a visible stutter on phones
  lampLight = new THREE.PointLight(0xffc37a, 26, 16, 1.8);
  lampLight.position.copy(at(0, 1.7, 3.9, -1.2));
  town.add(lampLight);
  p.add(lamp);
  // the city behind: blocks with lit windows
  const face = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#2a2147'; g.fillRect(0, 0, w, h);
    for (let y = 6; y < h - 6; y += 12) for (let x = 6; x < w - 6; x += 12) {
      g.fillStyle = rnd() < 0.45 ? pick(['#ffd98a', '#ffc46b', '#c4b5fd', '#ffe9b8']) : '#3a2f5f';
      g.fillRect(x, y, 7, 8);
    }
  });
  const lit = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.drawImage(face.image, 0, 0);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) if (d.data[i] < 150) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 0; }
    g.putImageData(d, 0, 0);
  });
  const block = new THREE.MeshStandardMaterial({ map: face, emissive: 0xffffff, emissiveMap: lit, emissiveIntensity: 0.9, roughness: 0.9 });
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * (1.08 + (i / 12) * 0.84), r = rr(15, 22), h = rr(5, 13), w = rr(3.2, 5);
    mesh(G.box, block, p, [Math.cos(a) * r, h / 2, Math.sin(a) * r], [w, h, w], [0, -a + Math.PI / 2 + rr(-0.2, 0.2), 0]);
  }
  ringOf(p, 16, 6.5, 12, tree, (x, z) => Math.abs(x - z * 0.55) < 2.6 || (z > 1 && Math.abs(x) < 5), );

  // the phone, in the host's hand, turned so someone looking over their shoulder can read it
  p.updateWorldMatrix(true, true);
  const hand = host.L.hand.getWorldPosition(new V3());
  phone = new THREE.Group();
  phone.position.copy(p.worldToLocal(hand.clone())).add(v(-0.01, 0.125, 0.0));
  phone.lookAt(at(0, 0.52, 1.92, -0.62));
  phone.translateZ(0.05);
  phone.scale.setScalar(1.25);
  mesh(new THREE.BoxGeometry(0.09, 0.19, 0.01), mat(0x16122a, 0.35), phone);
  const c = document.createElement('canvas');
  c.width = 540; c.height = 1170;
  phoneCtx = c.getContext('2d');
  phoneTex = new THREE.CanvasTexture(c);
  phoneTex.colorSpace = THREE.SRGBColorSpace;
  phoneTex.generateMipmaps = false;          // it is redrawn while scrolling: no smaller copies to rebuild each time
  phoneTex.minFilter = THREE.LinearFilter;
  const screen = mesh(new THREE.PlaneGeometry(0.082, 0.178), new THREE.MeshBasicMaterial({ map: phoneTex, toneMapped: false, fog: false }), phone, [0, 0, 0.0056]);
  screen.castShadow = false;
  phoneLight = new THREE.PointLight(0xb9a0ff, 0.5, 2.2, 2);
  p.add(phone);
  phone.updateWorldMatrix(true, false);
  phone.getWorldPosition(PHONE.pos);
  phone.getWorldDirection(PHONE.n);
  phoneLight.position.copy(PHONE.pos).addScaledVector(PHONE.n, 0.14);
  town.add(phoneLight);
}

/* ---------- Place 1: sunrise, the run ---------- */
const RUN_R = 6.6;
const runPivot = new THREE.Group();
const runners = [];
{
  const p = places[1];
  patch(p, 15, 0x6aa06a);
  const track = mesh(new THREE.RingGeometry(RUN_R - 1.5, RUN_R + 1.5, 72), mat(0xe9b9a6, 1), p, [0, 0.035, 0], 1, [-Math.PI / 2, 0, 0]);
  track.castShadow = false;
  const pond = mesh(new THREE.CircleGeometry(2.6, 40), mat(0x6fb7e8, 0.15, { metalness: 0.2 }), p, [0.3, 0.04, 0.4], [1.2, 0.85, 1], [-Math.PI / 2, 0, 0]);
  pond.castShadow = false;
  ringOf(p, 6, 2.9, 3.7, tree);
  ringOf(p, 26, 13, 16.5, tree);
  p.add(runPivot);
  const spots = [[0, 0], [0.8, 1.3], [-0.75, 1.5], [0.15, 2.9], [-0.9, 3.9]];
  const tops = [0x7c3aed, 0xec4899, 0xfbbf24, 0x38bdf8, 0x34d399];
  spots.forEach(([dx, dz], i) => {
    const P = person({ top: tops[i], shorts: true, sleeves: i % 2 === 0, skin: SKINS[i % SKINS.length], style: i % 3 });
    P.g.position.set(RUN_R + dx, 0, dz);
    P.g.rotation.y = Math.PI - dz / RUN_R;      // facing along the track
    runPivot.add(P.g);
    runners.push(P);
  });
  beacon(1, '🏃');
}

/* ---------- Place 2: midday, coffee ---------- */
const sitters = [];
const steam = [];
{
  const p = places[2];
  patch(p, 11, 0x79b07a);
  const paving = mesh(new THREE.CircleGeometry(5.2, 40), mat(0xe7dccb, 1), p, [0, 0.04, 0], 1, [-Math.PI / 2, 0, 0]);
  paving.castShadow = false;
  // the café
  const cafe = new THREE.Group();
  cafe.position.set(0, 0, -4.6);
  mesh(G.box, mat(0xf4e9dc), cafe, [0, 1.7, 0], [7, 3.4, 2.4]);
  mesh(G.box, mat(0x7c3aed), cafe, [0, 3.55, 0], [7.3, 0.3, 2.7]);
  mesh(G.box, mat(0x33294f, 0.3), cafe, [-1.6, 1.5, 1.21], [2.6, 1.7, 0.05]);
  mesh(G.box, mat(0x5b3a2a), cafe, [1.9, 1.1, 1.21], [1.1, 2.2, 0.06]);
  const stripes = canvasTex(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#c026d3'; g.fillRect(i * 16, 0, 16, h); } });
  mesh(G.box, new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.9 }), cafe, [0, 2.75, 1.85], [6.6, 0.07, 1.5], [0.3, 0, 0]);
  const sign = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#7c3aed'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = '700 40px "Open Sans",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('coffee ☕', w / 2, h / 2 + 2);
  });
  mesh(G.box, new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8 }), cafe, [0, 3.56, 1.36], [2.6, 0.3, 0.02]).castShadow = false;
  p.add(cafe);
  // the table
  mesh(G.cyl, mat(0xffffff, 0.5), p, [0, 0.76, 0], [0.85, 0.05, 0.85]);
  mesh(G.cyl, mat(0x2b2540, 0.5), p, [0, 0.38, 0], [0.06, 0.76, 0.06]);
  mesh(G.cyl, mat(0x2b2540, 0.5), p, [0, 0.03, 0], [0.35, 0.05, 0.35]);
  const tops = [0xfbbf24, 0x7c3aed, 0x38bdf8, 0xec4899, 0x34d399];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const P = person({ top: tops[i], skin: SKINS[(i + 2) % SKINS.length], style: (i + 1) % 3 });
    P.g.position.set(Math.sin(a) * 1.45, 0, Math.cos(a) * 1.45);
    P.g.rotation.y = a + Math.PI;
    p.add(P.g);
    sitters.push(P);
    mesh(G.cyl, mat(0x7c3aed, 0.7), p, [Math.sin(a) * 1.5, 0.27, Math.cos(a) * 1.5], [0.2, 0.54, 0.2]);
    const cx = Math.sin(a + 0.25) * 0.55, cz = Math.cos(a + 0.25) * 0.55;
    mesh(G.cyl, mat(0xffffff, 0.4), p, [cx, 0.84, cz], [0.05, 0.09, 0.05]);
    mesh(G.cyl, mat(0x5b3a2a, 0.4), p, [cx, 0.886, cz], [0.042, 0.004, 0.042]).castShadow = false;
    for (let k = 0; k < 2; k++) {
      const puff = mesh(G.sphere, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), p, [cx, 0.95, cz], 0.03);
      puff.castShadow = false;
      steam.push({ m: puff, x: cx, z: cz, phase: rnd() + k * 0.5 });
    }
  }
  // lights on a string, and plants in pots
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, x = lerp(-5, 5, t), y = 3.3 - Math.sin(t * Math.PI) * 0.7;
    mesh(G.sphere, new THREE.MeshBasicMaterial({ color: pick([0xffe2a8, 0xf9a8d4, 0xc4b5fd]) }), p, [x, y, 2.6 - Math.sin(t * Math.PI) * 5.2], 0.07).castShadow = false;
  }
  for (const x of [-5, 5]) mesh(G.cyl, mat(0x2b2540, 0.5), p, [x, 1.65, 2.6], [0.05, 3.3, 0.05]);
  for (const [x, z] of [[-3.6, -3.1], [3.7, -3.1], [-4.3, 1.2]]) {
    mesh(G.cyl, mat(0xc26a4a), p, [x, 0.25, z], [0.3, 0.5, 0.3]);
    mesh(G.blob, mat(0x3f8f5a, 0.9, { flatShading: true }), p, [x, 0.85, z], 0.5);
  }
  ringOf(p, 16, 8, 12, tree, (x, z) => z > 2 && Math.abs(x) < 6);
  beacon(2, '☕', 7.4);
}

/* ---------- Place 3: golden hour, the walk ---------- */
const WALK_R = 5.4;
const walkPivot = new THREE.Group();
const walkers = [];
let dog;
{
  const p = places[3];
  patch(p, 14.5, 0x86a85e);
  const trail = mesh(new THREE.RingGeometry(WALK_R - 1.2, WALK_R + 1.2, 72), mat(0xd9b98a, 1), p, [0, 0.035, 0], 1, [-Math.PI / 2, 0, 0]);
  trail.castShadow = false;
  // a hill in the middle
  mesh(G.sphere, mat(0x7c9c58, 1, { flatShading: true }), p, [0, -0.6, 0], [3.4, 2.2, 3.4]);
  ringOf(p, 5, 0.6, 2.2, (parent, x, z, s) => { const t = pine(parent, x, z, s); t.position.y = 1.2; });
  ringOf(p, 30, 11.5, 15.5, pine);
  for (let i = 0; i < 9; i++) {
    const a = rr(0, 6.28), r = rr(3.3, 3.9);
    mesh(G.blob, mat(0x9a93a8, 1, { flatShading: true }), p, [Math.cos(a) * r, 0.15, Math.sin(a) * r], [rr(0.3, 0.6), rr(0.25, 0.45), rr(0.3, 0.6)]);
  }
  p.add(walkPivot);
  const spots = [[0, 0], [0.75, 0.2], [-0.2, 1.5], [0.6, 2.8], [-0.4, 3.0]];
  const tops = [0xf97316, 0x7c3aed, 0xffffff, 0xec4899, 0x38bdf8];
  spots.forEach(([dx, dz], i) => {
    const P = person({ top: tops[i], skin: SKINS[(i + 3) % SKINS.length], style: (i + 2) % 3 });
    P.g.position.set(WALK_R + dx, 0, dz);
    P.g.rotation.y = Math.PI - dz / WALK_R;
    walkPivot.add(P.g);
    walkers.push(P);
  });
  // the dog
  dog = new THREE.Group();
  dog.position.set(WALK_R - 0.75, 0, -1.2);
  dog.rotation.y = Math.PI;
  const fur = mat(0xd9a05b, 0.9);
  mesh(capsule(0.14, 0.42), fur, dog, [0, 0.4, 0], 1, [Math.PI / 2, 0, 0]);
  mesh(G.sphere, fur, dog, [0, 0.58, 0.36], 0.15);
  mesh(G.box, fur, dog, [0, 0.54, 0.5], [0.11, 0.09, 0.16]);
  mesh(G.sphere, mat(0x1b1626), dog, [0, 0.56, 0.585], 0.03);
  for (const x of [-0.09, 0.09]) mesh(G.box, mat(0x8a5a2c), dog, [x, 0.7, 0.3], [0.06, 0.13, 0.04], [0, 0, x * 4]);
  dog.legs = [[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.2], [0.09, -0.2]].map(([x, z]) => {
    const l = new THREE.Group();
    l.position.set(x, 0.32, z);
    mesh(capsule(0.04, 0.2), fur, l, [0, -0.15, 0]);
    dog.add(l);
    return l;
  });
  dog.tail = new THREE.Group();
  dog.tail.position.set(0, 0.5, -0.33);
  mesh(capsule(0.03, 0.2), fur, dog.tail, [0, 0.12, 0]);
  dog.add(dog.tail);
  walkPivot.add(dog);
  beacon(3, '🚶', 7);
}

/* ---------- Place 4: dusk, the kickabout ---------- */
const players = [];
let ball;
{
  const p = places[4];
  patch(p, 12, 0x4f9a63);
  const white = mat(0xffffff, 0.9);
  const line = (x, z, w, d) => { mesh(G.box, white, p, [x, 0.045, z], [w, 0.01, d]).castShadow = false; };
  line(0, -5, 14, 0.09); line(0, 5, 14, 0.09); line(-7, 0, 0.09, 10); line(7, 0, 0.09, 10); line(0, 0, 0.09, 10);
  mesh(new THREE.RingGeometry(1.75, 1.84, 48), white, p, [0, 0.045, 0], 1, [-Math.PI / 2, 0, 0]).castShadow = false;
  for (const s of [-1, 1]) {
    const goal = new THREE.Group();
    goal.position.set(s * 7, 0, 0);
    mesh(G.cyl, white, goal, [0, 0.8, -1.3], [0.05, 1.6, 0.05]);
    mesh(G.cyl, white, goal, [0, 0.8, 1.3], [0.05, 1.6, 0.05]);
    mesh(G.cyl, white, goal, [0, 1.6, 0], [0.05, 2.65, 0.05], [Math.PI / 2, 0, 0]);
    mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 1 }), goal, [s * 0.5, 0.8, 0], [0.9, 1.6, 2.6]).castShadow = false;
    p.add(goal);
    // floodlights
    const pole = new THREE.Group();
    pole.position.set(s * 8.2, 0, -5.6);
    mesh(G.cyl, mat(0x2b2540, 0.5), pole, [0, 3, 0], [0.07, 6, 0.07]);
    mesh(G.box, new THREE.MeshBasicMaterial({ color: 0xfff1cf }), pole, [0, 6.1, 0.1], [0.9, 0.45, 0.12], [0.5, -s * 0.5, 0]).castShadow = false;
    const flood = new THREE.PointLight(0xffe7c2, 60, 26, 1.7);
    flood.position.copy(at(4, s * 8.2, 6, -5.2));
    town.add(flood);
    floods.push(flood);
    p.add(pole);
  }
  const tops = [0xec4899, 0x7c3aed, 0xfbbf24, 0x34d399, 0x38bdf8];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const P = person({ top: tops[i], shorts: true, skin: SKINS[(i + 1) % SKINS.length], style: i % 3 });
    P.g.position.set(Math.sin(a) * 3.1, 0, Math.cos(a) * 3.1);
    P.g.rotation.y = a + Math.PI;
    P.kick = 0;
    p.add(P.g);
    players.push(P);
  }
  const ballTex = canvasTex(64, 32, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#231a3a';
    for (const [x, y] of [[8, 8], [24, 22], [40, 8], [56, 22], [24, 2], [56, 2], [8, 28], [40, 28]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  });
  ball = mesh(G.sphere, new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.5 }), p, [0, 0.16, 0], 0.16);
  ringOf(p, 22, 11.5, 15, tree);
  beacon(4, '⚽', 7);
}

/* ---------- One mesh per place for everything that never moves ----------
   Trees, benches, the café and so on are hundreds of small parts. Drawn one by one they are what slows
   a phone down, so each place's still parts are joined into a single mesh, coloured per corner. */
function bake(place, moving) {
  place.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(place.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const groups = new Map();          // flat-shaded and smooth parts are kept apart
  const used = [];
  place.traverse((o) => {
    const m = o.material;
    if (!o.isMesh || !o.castShadow || !m.isMeshStandardMaterial || m.map || m.transparent || m.vertexColors || m.metalness > 0) return;
    for (let a = o; a && a !== place; a = a.parent) if (moving.includes(a)) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(local.multiplyMatrices(inverse, o.matrixWorld));
    const key = m.flatShading ? 'flat' : 'smooth';
    if (!groups.has(key)) groups.set(key, { pos: [], nor: [], col: [] });
    const out = groups.get(key), pos = g.attributes.position.array, nor = g.attributes.normal.array;
    for (let i = 0; i < pos.length; i += 3) {
      out.pos.push(pos[i], pos[i + 1], pos[i + 2]);
      out.nor.push(nor[i], nor[i + 1], nor[i + 2]);
      out.col.push(m.color.r, m.color.g, m.color.b);
    }
    g.dispose();
    used.push(o);
  });
  for (const o of used) o.removeFromParent();
  for (const [key, data] of groups) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(data.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
    mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: key === 'flat' }), place);
  }
}
{
  const moving = [...people.map((P) => P.g), dog, phone, ball, ...beacons.map((b) => b.g)];
  for (const place of places) bake(place, moving);
}

/* ---------- The world map ---------- */
const MAP = { lon0: -0.12, lat0: 51.5, far: 290 };
const toMap = (lat, lon) => v(lon - MAP.lon0, 0, -(lat - MAP.lat0));
const isLand = (lat, lon) => {
  const r = Math.floor((LAND.lat0 - lat) / LAND.step), c = Math.floor((lon + 180) / LAND.step);
  if (r < 0 || r >= LAND.rows.length || c < 0 || c >= LAND.cols) return false;
  return (parseInt(LAND.rows[r][c >> 2], 16) & (8 >> (c & 3))) !== 0;
};
const world = new THREE.Group();
world.visible = false;
scene.add(world);
const dots = (() => {
  const pos = [], far = [];
  LAND.rows.forEach((row, r) => {
    for (let c = 0; c < LAND.cols; c++) {
      if (!(parseInt(row[c >> 2], 16) & (8 >> (c & 3)))) continue;
      const p = toMap(LAND.lat0 - (r + 0.5) * LAND.step, -180 + (c + 0.5) * LAND.step);
      pos.push(p.x, 0, p.z);
      far.push(Math.hypot(p.x, p.z));
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('far', new THREE.Float32BufferAttribute(far, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { size: { value: 1.02 }, scale: { value: 1 }, reach: { value: 0 } },
    vertexShader: `attribute float far; uniform float size; uniform float scale; uniform float reach; varying float a; varying float edge;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        a = 1.0 - smoothstep(reach - 26.0, reach, far); edge = smoothstep(reach - 40.0, reach - 8.0, far) * a;
        gl_PointSize = size * (1.0 + edge * 0.7) * scale / -mv.z; }`,
    fragmentShader: `varying float a; varying float edge;
      void main(){ float d = length(gl_PointCoord - 0.5); float c = 1.0 - smoothstep(0.38, 0.5, d);
        vec3 col = mix(vec3(0.44, 0.36, 0.86), vec3(0.98, 0.62, 0.95), edge);
        gl_FragColor = vec4(col, c * a * 0.95); }`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  world.add(p);
  return p;
})();

// Where the pins go: big cities, and a scatter of more around each. An illustration, not live data.
const CITIES = [
  [51.5, -0.12], [48.86, 2.35], [52.52, 13.4], [40.42, -3.7], [41.9, 12.5], [52.37, 4.9], [53.35, -6.26], [55.95, -3.19],
  [53.48, -2.24], [59.33, 18.07], [55.68, 12.57], [60.17, 24.94], [48.21, 16.37], [50.08, 14.44], [52.23, 21.01], [38.72, -9.14],
  [41.39, 2.17], [37.98, 23.73], [41.01, 28.98], [47.5, 19.04], [59.91, 10.75], [50.45, 30.52], [45.46, 9.19], [47.37, 8.54],
  [40.71, -74.01], [34.05, -118.24], [41.88, -87.63], [29.76, -95.37], [43.65, -79.38], [45.5, -73.57], [49.28, -123.12],
  [47.61, -122.33], [37.77, -122.42], [25.76, -80.19], [33.75, -84.39], [39.74, -104.99], [32.78, -96.8], [38.91, -77.04],
  [42.36, -71.06], [19.43, -99.13], [20.67, -103.35], [4.71, -74.07], [-12.05, -77.04], [-33.45, -70.67], [-34.6, -58.38],
  [-23.55, -46.63], [-22.91, -43.17], [-15.79, -47.88], [10.48, -66.9], [6.25, -75.56], [-0.18, -78.47],
  [30.04, 31.24], [6.52, 3.38], [5.6, -0.19], [-1.29, 36.82], [9.03, 38.74], [-26.2, 28.05], [-33.92, 18.42], [33.57, -7.59],
  [14.72, -17.47], [-6.79, 39.21], [36.81, 10.18], [0.35, 32.58],
  [25.2, 55.27], [24.71, 46.68], [32.09, 34.78], [35.69, 51.39], [28.61, 77.21], [19.08, 72.88], [12.97, 77.59], [22.57, 88.36],
  [24.86, 67.0], [23.81, 90.41], [13.76, 100.5], [1.35, 103.82], [3.14, 101.69], [-6.21, 106.85], [14.6, 120.98], [21.03, 105.85],
  [10.82, 106.63], [22.32, 114.17], [31.23, 121.47], [39.9, 116.4], [23.13, 113.26], [30.57, 104.07], [37.57, 126.98],
  [35.68, 139.69], [34.69, 135.5], [25.03, 121.57], [43.24, 76.89], [41.3, 69.24],
  [-33.87, 151.21], [-37.81, 144.96], [-27.47, 153.03], [-31.95, 115.86], [-36.85, 174.76], [-41.29, 174.78], [21.31, -157.86],
];
const pinSpots = [];
CITIES.forEach(([lat, lon], i) => {
  pinSpots.push({ p: toMap(lat, lon), s: i === 0 ? 1.7 : rr(0.95, 1.3) });
  for (let k = 0; k < 3; k++) {
    const la = lat + rr(-5, 5), lo = lon + rr(-7, 7);
    if (isLand(la, lo)) pinSpots.push({ p: toMap(la, lo), s: rr(0.5, 0.85) });
  }
});
pinSpots.forEach((s) => { s.far = Math.hypot(s.p.x, s.p.z); s.phase = rr(0, 6.28); });
const mapPins = new THREE.InstancedMesh(pinGeo(12), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), pinSpots.length);
mapPins.frustumCulled = false;
world.add(mapPins);
const glowTex = canvasTex(64, 64, (g) => {
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,190,240,.9)'); grad.addColorStop(0.35, 'rgba(236,72,153,.35)'); grad.addColorStop(1, 'rgba(236,72,153,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
});
const glows = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pinSpots.flatMap((s) => [s.p.x, 0.05, s.p.z]), 3));
  const m = new THREE.PointsMaterial({ map: glowTex, size: 9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  world.add(p);
  return p;
})();
const pulse = mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), world, [0, 0.06, 0], 1, [-Math.PI / 2, 0, 0]);
pulse.castShadow = false;
const dummy = new THREE.Object3D();

/* ---------- The phone screen ---------- */
const INK = '#0f172a', SLATE = '#64748b', VIOLET = '#6d28d9';
const font = (px, weight = 700) => `${weight} ${px}px "Open Sans",system-ui,sans-serif`;
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function brandFill(g, x0, y0, x1, y1) {
  const f = g.createLinearGradient(x0, y0, x1, y1);
  f.addColorStop(0, '#7c3aed'); f.addColorStop(0.55, '#c026d3'); f.addColorStop(1, '#ec4899');
  return f;
}
function drawPin(g, x, y, s) {            // x, y is the point of the pin; s its height
  const r = s * 0.37, cy = y - s + r;
  g.beginPath();
  g.moveTo(x, y);
  const a = 0.63;
  g.lineTo(x - Math.cos(a) * r, cy + Math.sin(a) * r);
  g.arc(x, cy, r, Math.PI - a, a, false);
  g.closePath();
  g.fillStyle = brandFill(g, x, y - s, x, y);
  g.fill();
  g.fillStyle = '#fff';
  for (const [dx, k] of [[-0.42, 0.72], [0.42, 0.72], [0, 1]]) {
    const px = x + dx * r, u = r * 0.2 * k;
    g.beginPath(); g.arc(px, cy - u * 0.9, u * 0.72, 0, 7); g.fill();
    rrect(g, px - u, cy + u * 0.05, u * 2, u * 2.1, u * 0.9); g.fill();
  }
}
const FACES = [['#d9a273', '#7c3aed'], ['#f2c9a5', '#ec4899'], ['#a9714b', '#fbbf24'], ['#f6d7bd', '#38bdf8'], ['#7a4b2f', '#34d399']];
const NAMES = ['You', 'Maya', 'Sam', 'Jo', 'Alex'];
function drawFace(g, x, y, r, i) {
  g.fillStyle = FACES[i][1]; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
  g.fillStyle = FACES[i][0];
  g.beginPath(); g.arc(x, y - r * 0.15, r * 0.42, 0, 7); g.fill();
  g.beginPath(); g.arc(x, y + r * 0.95, r * 0.7, 0, 7); g.fill();
  g.restore();
  g.lineWidth = 5; g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
}
function drawPhone(s, t) {
  const g = phoneCtx, W = 540, H = 1170;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const slide = smooth(0.44, 0.5, s);
  // ---- the map (comes in from the right once the meetup is posted) ----
  if (slide > 0) {
    g.save();
    g.translate((1 - slide) * W, 0);
    g.fillStyle = '#eef0fb'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#cfe9d2'; rrect(g, 60, 330, 300, 250, 60); g.fill();
    g.fillStyle = '#bfdcf7';
    g.beginPath(); g.moveTo(-10, 690); g.bezierCurveTo(160, 620, 330, 760, 560, 660); g.lineTo(560, 760); g.bezierCurveTo(330, 860, 160, 720, -10, 790); g.fill();
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    g.lineWidth = 26;
    for (const [x0, y0, x1, y1] of [[-20, 250, 560, 300], [410, 150, 440, 900], [-20, 600, 560, 560], [150, 150, 110, 340], [-20, 880, 560, 840]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    g.lineWidth = 12;
    for (const [x0, y0, x1, y1] of [[250, 150, 290, 330], [-20, 420, 60, 430], [440, 430, 560, 440], [280, 580, 300, 900]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    // other meetups nearby
    g.globalAlpha = 0.55;
    drawPin(g, 470, 380, 70); drawPin(g, 120, 800, 62);
    g.globalAlpha = 1;
    // the new pin drops in
    const drop = clamp((s - 0.5) / 0.07);
    const fall = drop < 0.7 ? Math.pow(drop / 0.7, 2) : 1 - Math.sin(((drop - 0.7) / 0.3) * Math.PI) * 0.12;
    const py = lerp(-140, 470, fall);
    g.fillStyle = `rgba(60,20,120,${0.22 * clamp(drop * 1.4)})`;
    g.beginPath(); g.ellipse(210, 474, 34 * clamp(drop * 1.4), 11, 0, 0, 7); g.fill();
    if (drop >= 1) {
      const ring = (t * 0.7) % 1;
      g.strokeStyle = `rgba(192,38,211,${0.6 * (1 - ring)})`; g.lineWidth = 6;
      g.beginPath(); g.ellipse(210, 474, 30 + ring * 80, (30 + ring * 80) * 0.38, 0, 0, 7); g.stroke();
    }
    drawPin(g, 210, py, 150);
    // the card at the bottom: who is in
    const up = smooth(0.56, 0.62, s);
    const top = lerp(H + 20, 800, up);
    g.fillStyle = 'rgba(40,10,90,.10)'; rrect(g, 0, top - 10, W, 420, 50); g.fill();
    g.fillStyle = '#fff'; rrect(g, 0, top, W, 420, 44); g.fill();
    g.fillStyle = '#e2e8f0'; rrect(g, W / 2 - 34, top + 16, 68, 8, 4); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = INK; g.font = font(42, 800); g.fillText('🏃 Morning run', 34, top + 86);
    g.fillStyle = SLATE; g.font = font(27, 600); g.fillText('Sat 8:00 · Riverside Park', 34, top + 130);
    const joined = 1 + Math.floor(4 * smooth(0.64, 0.93, s) + 0.001);
    const fresh = 4 * smooth(0.64, 0.93, s) + 1 - joined;
    for (let i = 0; i < joined; i++) {
      const pop = i === joined - 1 && i > 0 ? backOut(clamp(fresh * 3)) : 1;
      drawFace(g, 72 + i * 70, top + 196, 36 * pop, i);
    }
    g.fillStyle = INK; g.font = font(28, 700); g.textAlign = 'right';
    g.fillText(`${joined} going`, W - 34, top + 206);
    g.textAlign = 'center';
    g.fillStyle = brandFill(g, 34, 0, W - 34, 0); rrect(g, 34, top + 262, W - 68, 84, 42); g.fill();
    g.fillStyle = '#fff'; g.font = font(32, 800); g.fillText("I'm in 🙌", W / 2, top + 316);
    if (joined > 1 && fresh < 0.75) {
      const a = Math.sin((fresh / 0.75) * Math.PI);
      g.globalAlpha = clamp(a * 1.6);
      g.fillStyle = INK; rrect(g, W / 2 - 150, top - 84 - a * 8, 300, 60, 30); g.fill();
      g.fillStyle = '#fff'; g.font = font(26, 700); g.fillText(`${NAMES[joined - 1]} is in 🙌`, W / 2, top - 44 - a * 8);
      g.globalAlpha = 1;
    }
    g.restore();
  }
  // ---- the form ----
  if (slide < 1) {
    g.save();
    g.translate(-slide * W, 0);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = INK; g.font = font(50, 800); g.fillText('Post a meetup', 34, 250);
    const label = (text, y) => { g.fillStyle = SLATE; g.font = font(26, 700); g.fillText(text, 34, y); };
    label('What?', 330);
    const picked = s > 0.07;
    [['🚶 Walk', 34, 150], ['🏃 Run', 196, 138], ['☕ Coffee', 346, 160]].forEach(([text, x, w], i) => {
      const on = picked && i === 1;
      g.fillStyle = on ? VIOLET : '#f5f3ff'; rrect(g, x, 354, w, 70, 35); g.fill();
      g.fillStyle = on ? '#fff' : INK; g.font = font(27, 700); g.textAlign = 'center'; g.fillText(text, x + w / 2, 399); g.textAlign = 'left';
    });
    const field = (text, y, from, to, name) => {
      label(name, y);
      const typed = text.slice(0, Math.round(text.length * clamp((s - from) / (to - from))));
      const active = s >= from - 0.02 && s < to + 0.02;
      g.fillStyle = '#f5f3ff'; rrect(g, 34, y + 24, W - 68, 84, 22); g.fill();
      if (active) { g.strokeStyle = VIOLET; g.lineWidth = 4; rrect(g, 34, y + 24, W - 68, 84, 22); g.stroke(); }
      g.fillStyle = INK; g.font = font(30, 600); g.fillText(typed, 58, y + 77);
      if (active && Math.sin(t * 7) > 0) g.fillRect(60 + g.measureText(typed).width, y + 46, 3, 40);
    };
    field('Riverside Park', 490, 0.11, 0.22, 'Where?');
    field('Sat · 8:00', 650, 0.25, 0.32, 'When?');
    const press = smooth(0.37, 0.4, s) * (1 - smooth(0.42, 0.45, s));
    const ready = s > 0.33;
    g.globalAlpha = ready ? 1 : 0.4;
    g.fillStyle = brandFill(g, 34, 0, W - 34, 0);
    rrect(g, 34 + press * 8, 880 + press * 4, W - 68 - press * 16, 96 - press * 8, 48); g.fill();
    g.fillStyle = '#fff'; g.font = font(36, 800); g.textAlign = 'center'; g.fillText('Post', W / 2, 941);
    g.globalAlpha = 1;
    if (s > 0.37 && s < 0.47) {
      const u = (s - 0.37) / 0.1;
      g.strokeStyle = `rgba(255,255,255,${0.9 * (1 - u)})`; g.lineWidth = 8;
      g.beginPath(); g.arc(W / 2, 928, 20 + u * 150, 0, 7); g.stroke();
    }
    g.restore();
  }
  // ---- the bar at the top ----
  g.fillStyle = brandFill(g, 0, 0, W, 170); g.fillRect(0, 0, W, 170);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = font(22, 700); g.textAlign = 'left'; g.fillText(s < 0.47 ? '21:14' : '21:15', 34, 46);
  rrect(g, W - 84, 26, 50, 24, 7); g.fill();
  drawPin(g, 58, 138, 62);
  g.fillStyle = '#fff'; g.font = '600 40px "Segoe UI","Open Sans",system-ui,sans-serif'; g.fillText('packmates', 96, 126);
  phoneTex.needsUpdate = true;
}

/* ---------- The camera's path ----------
   Each key is where the camera is and what it looks at when the scroll reaches p. A key with a "frame"
   is given in that object's own space, so the camera can ride along with the runners and the walkers.
   A new list is a cut: the jump through the phone happens behind the wash of colour. */
const pc = (d, side = 0, up = 0) => PHONE.pos.clone().addScaledVector(PHONE.n, d).add(v(side, up, 0));
const mapEnd = { pos: v(0, 200, 150), look: v(8, 0, 36) };
const mapEnd2 = { pos: v(0, 220, 160), look: v(8, 0, 36) };
const SHOTS = [
  [
    { p: 0.00, pos: at(0, 3.6, 2.0, 7.4), look: at(0, 0.3, 1.5, 0) },
    { p: 0.07, pos: at(0, 2.3, 1.75, 3.6), look: at(0, 0.1, 1.3, 0) },
    { p: 0.115, pos: at(0, 2.6, 1.9, 0.2), look: at(0, 0.15, 1.3, 0.2) },
    { p: 0.145, pos: pc(0.95, 0.06, 0.02), look: PHONE.pos.clone() },
    { p: 0.175, pos: pc(0.4), look: PHONE.pos.clone() },
    { p: 0.27, pos: pc(0.31), look: PHONE.pos.clone() },
    { p: 0.33, pos: pc(0.1), look: PHONE.pos.clone() },
  ],
  [
    { p: 0.33, frame: runPivot, pos: v(RUN_R + 0.6, 0.8, -9), look: v(RUN_R, 1.15, 0) },
    { p: 0.385, frame: runPivot, pos: v(RUN_R + 1.6, 1.05, -6.4), look: v(RUN_R - 0.1, 1.1, 1.2) },
    { p: 0.43, frame: runPivot, pos: v(RUN_R + 4.6, 1.5, -2.6), look: v(RUN_R - 0.2, 1.0, 1.6) },
    { p: 0.475, frame: runPivot, pos: v(RUN_R + 5.2, 2.4, 5.5), look: v(RUN_R - 0.2, 1.0, 1.2) },
    { p: 0.50, pos: v(-12, 8.5, 20), look: at(2, 0, 2.2, 0) },
    { p: 0.535, pos: at(2, 3.4, 2.1, 5.4), look: at(2, 0, 1.0, 0) },
    { p: 0.585, pos: at(2, -3.3, 1.75, 4.4), look: at(2, 0, 1.0, 0) },
    { p: 0.61, pos: v(16, 8, 14), look: at(3, 0, 2, 0) },
    { p: 0.645, frame: walkPivot, pos: v(WALK_R + 1.9, 1.25, -6.2), look: v(WALK_R, 1.05, 0.8) },
    { p: 0.69, frame: walkPivot, pos: v(WALK_R + 4.6, 1.7, -0.6), look: v(WALK_R - 0.2, 1.0, 1.4) },
    { p: 0.715, pos: v(46, 8.5, 14), look: at(4, 0, 2, 0) },
    { p: 0.745, pos: at(4, 5.2, 2.0, 6.6), look: at(4, 0, 1.0, 0) },
    { p: 0.79, pos: at(4, -4.8, 3.0, 6.4), look: at(4, 0, 1.0, 0) },
    { p: 0.825, pos: v(34, 60, 62), look: v(22, 0, 0) },
    { p: 0.87, pos: v(4, 120, 96), look: v(4, 0, 22) },
    { p: 0.93, ...mapEnd },
    { p: 1.00, ...mapEnd2 },
  ],
];
const A = { pos: [v(), v(), v(), v()], look: [v(), v(), v(), v()] };
const tan0 = v(), tan1 = v(), tmp = v();
function keyInto(key, pos, look) {
  pos.copy(key.pos); look.copy(key.look);
  if (key.frame) { pos.applyMatrix4(key.frame.matrixWorld); look.applyMatrix4(key.frame.matrixWorld); }
}
// A curve through the keys that never overshoots: the speed through a key is set by its shorter side.
function tangent(prev, here, next, has0, has1, out) {
  if (!has0 || !has1) return out.set(0, 0, 0);
  out.subVectors(next, prev);
  const len = out.length();
  if (len < 1e-6) return out.set(0, 0, 0);
  return out.multiplyScalar(Math.min(here.distanceTo(prev), here.distanceTo(next)) / len);
}
function hermite(p1, m1, p2, m2, t, out) {
  const t2 = t * t, t3 = t2 * t;
  return out.set(0, 0, 0)
    .addScaledVector(p1, 2 * t3 - 3 * t2 + 1).addScaledVector(m1, t3 - 2 * t2 + t)
    .addScaledVector(p2, -2 * t3 + 3 * t2).addScaledVector(m2, t3 - t2);
}
const camPos = v(), camLook = v();
function cameraAt(p) {
  const shot = p < SHOTS[1][0].p ? SHOTS[0] : SHOTS[1];
  let i = 0;
  while (i < shot.length - 2 && p > shot[i + 1].p) i++;
  const k = [shot[Math.max(0, i - 1)], shot[i], shot[i + 1], shot[Math.min(shot.length - 1, i + 2)]];
  for (let j = 0; j < 4; j++) keyInto(k[j], A.pos[j], A.look[j]);
  let t = clamp((p - k[1].p) / (k[2].p - k[1].p));
  t = lerp(t, t * t * (3 - 2 * t), 0.3);
  for (const [pts, out] of [[A.pos, camPos], [A.look, camLook]]) {
    tangent(pts[0], pts[1], pts[2], i > 0, true, tan0);
    tangent(pts[1], pts[2], pts[3], true, i + 2 < shot.length, tan1);
    hermite(pts[1], tan0, pts[2], tan1, t, out);
  }
}

/* ---------- The words over the scene ---------- */
const caps = [...document.querySelectorAll('.cap')].map((el) => ({ el, from: +el.dataset.from, to: +el.dataset.to, on: null }));
const rail = [...document.querySelectorAll('.rail li')].map((el) => ({ el, at: +el.dataset.at }));
const wash = document.querySelector('.wash');
const washDay = document.querySelector('.wash__day');
const washTime = document.querySelector('.wash__time');
const washClock = document.querySelector('.wash__clock');
let washOn = false, pastStage = null;
const topbar = document.querySelector('.topbar');
let lastTime = '', lastRail = -1;
// write a CSS variable only when its value changes, so a still frame costs the page nothing
const written = new Map();
function setVar(el, name, value) {
  let seen = written.get(el);
  if (!seen) written.set(el, seen = {});
  if (seen[name] === value) return;
  seen[name] = value;
  el.style.setProperty(name, value);
}
function setWords(p) {
  for (const c of caps) {
    const o = smooth(c.from, c.from + 0.022, p) * (1 - smooth(c.to - 0.022, c.to, p));
    const on = o > 0.01;
    setVar(c.el, '--o', o.toFixed(2));
    if (on !== c.on) { c.on = on; c.el.classList.toggle('is-on', on); }
  }
  let now = 0;
  rail.forEach((r, i) => { if (p >= r.at - 0.01) now = i; });
  if (now !== lastRail) {
    lastRail = now;
    rail.forEach((r, i) => { r.el.classList.toggle('is-now', i === now); r.el.classList.toggle('is-done', i < now); });
  }
  setVar(stage, '--rail', (1 - smooth(0.9, 0.94, p)).toFixed(2));
  // the wash and its clock
  const o = smooth(0.29, 0.312, p) * (1 - smooth(0.352, 0.385, p));
  setVar(wash, '--o', o.toFixed(2));
  if ((o > 0.005) !== washOn) { washOn = o > 0.005; wash.classList.toggle('is-on', washOn); }
  if (o > 0.005) {
    const c = smooth(0.3, 0.348, p);
    const mins = 21 * 60 + 14 + Math.round(646 * c);
    const hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    const text = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (text !== lastTime) {
      lastTime = text;
      washTime.textContent = text;
      washDay.textContent = mins >= 24 * 60 ? 'Saturday' : 'Friday';
    }
    const done = smooth(0.94, 1, c);
    setVar(washClock, '--n', done.toFixed(2));
    setVar(washClock, '--s', (0.92 + 0.08 * c + done * 0.05).toFixed(3));
  }
}

/* ---------- Size ---------- */
let W = 1, H = 1, aspect = 1, storyHeight = 1, barHeight = 60;
function resize() {
  W = stage.clientWidth; H = stage.clientHeight;
  if (!W || !H) return;
  storyHeight = story.offsetHeight;
  barHeight = topbar ? topbar.offsetHeight : 60;
  aspect = W / H;
  renderer.setSize(W, H, false);
  camera.aspect = aspect;
  // tall screens get a wider lens so the scenes still fit
  camera.fov = aspect < 0.75 ? 62 : aspect < 1.2 ? 56 : 50;
  camera.updateProjectionMatrix();
  // the last frame: as much of the map as fits
  const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect;
  const wide = aspect > 1.2 ? 330 : aspect > 0.75 ? 240 : 150;
  const dist = wide / 2 / half;
  MAP.pan = Math.max(6, (330 - wide) / 2);
  MAP.dist = dist;
  mapEnd.pos.set(mapEnd.look.x, dist * 0.84, mapEnd.look.z + dist * 0.54);
  mapEnd2.pos.set(mapEnd.look.x, dist * 0.92, mapEnd.look.z + dist * 0.5);
  dots.material.uniforms.scale.value = (H * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}

/* ---------- Every frame ---------- */
const clock = new THREE.Timer();
let target = 0, pNow = 0, raf = 0, visible = true, lastPhone = -1, started = false, slow = 0, phoneDrawn = -1;
const look = v(), side = v();
function readScroll() {
  const rect = story.getBoundingClientRect();
  const span = storyHeight - H;
  target = span > 0 ? clamp(-rect.top / span) : 0;
  visible = rect.bottom > 0 && rect.top < window.innerHeight;
  const past = rect.bottom <= barHeight + 6;
  if (past !== pastStage) { pastStage = past; root.classList.toggle('past-stage', past); }
}
function frame() {
  raf = 0;
  readScroll();
  if (!visible || document.hidden) return;
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.getElapsed();
  pNow += (target - pNow) * (1 - Math.exp(-dt * 5.5));
  if (Math.abs(target - pNow) < 0.00005) pNow = target;
  const p = pNow;

  setMood(p);
  setWords(p);

  // the town shrinks to a point on the map as the camera leaves
  const shrink = smooth(0.835, 0.885, p);
  const s = lerp(1, 0.012, shrink * shrink * (3 - 2 * shrink));
  const gone = shrink >= 1;
  for (const g of places) if (gone) g.visible = false;
  town.scale.setScalar(s);
  ground.material.opacity = 1 - smooth(0.80, 0.845, p);
  ground.visible = ground.material.opacity > 0.01;

  // only the places near the story are drawn and moved
  const near = (i, a, b) => { const on = !gone && ((p > a && p < b) || p > 0.8); places[i].visible = on; return on; };
  if (near(0, -1, 0.36)) {
    host.hips.position.y = 0.92 + Math.sin(t * 1.6) * 0.004;
    host.head.rotation.x = 0.32 + Math.sin(t * 0.8) * 0.02;
    // the form is filled in while the first words are up, the map and the people joining while the second are
    const ps = p < 0.215 ? 0.47 * clamp((p - 0.135) / 0.08) : 0.47 + 0.53 * clamp((p - 0.215) / 0.08);
    const due = Math.abs(ps - lastPhone) > 0.0008 ? t - phoneDrawn > 0.03 : p < 0.34 && t - phoneDrawn > 0.25;
    if (due) { lastPhone = ps; phoneDrawn = t; drawPhone(ps, t); }
  }
  const lit = 1 - shrink;
  lampLight.intensity = places[0].visible ? 26 * lit : 0;
  phoneLight.intensity = places[0].visible ? (0.45 + Math.sin(t * 2) * 0.05) * lit : 0;
  if (near(1, 0.3, 0.56)) {
    runPivot.rotation.y = t * 0.5;
    for (const P of runners) poseRun(P, t);
  }
  if (near(2, 0.44, 0.66)) {
    for (const P of sitters) poseSit(P, t);
    for (const puff of steam) {
      const u = (t * 0.35 + puff.phase) % 1;
      puff.m.position.set(puff.x + Math.sin(u * 6 + puff.phase * 9) * 0.03, 0.92 + u * 0.4, puff.z);
      puff.m.scale.setScalar(0.02 + u * 0.05);
      puff.m.material.opacity = 0.45 * Math.sin(u * Math.PI);
    }
  }
  if (near(3, 0.55, 0.76)) {
    walkPivot.rotation.y = t * 0.2;
    for (const P of walkers) poseWalk(P, t);
    dog.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 11 + (i % 3) * 2.1) * 0.6; });
    dog.tail.rotation.set(-0.7, 0, Math.sin(t * 14) * 0.6);
    dog.position.y = Math.abs(Math.sin(t * 11)) * 0.03;
  }
  const dusk = near(4, 0.66, 2);
  for (const flood of floods) flood.intensity = dusk ? 60 * lit : 0;
  if (dusk) {
    // the ball goes round in a star: 0 → 2 → 4 → 1 → 3
    const beat = t * 0.9, n = Math.floor(beat), u = beat - n;
    const from = players[(n * 2) % 5], to = players[((n + 1) * 2) % 5];
    const e = u * u * (3 - 2 * u);
    ball.position.set(lerp(from.g.position.x, to.g.position.x, e) * 0.9, 0.16 + Math.sin(u * Math.PI) * 0.7, lerp(from.g.position.z, to.g.position.z, e) * 0.9);
    ball.rotation.x += dt * 9; ball.rotation.z += dt * 5;
    players.forEach((P) => {
      const kicking = P === from ? Math.sin(Math.min(1, u * 3.5) * Math.PI) : 0;
      const waiting = P === to ? u : 0;
      P.R.leg.rotation.x = -kicking * 1.1;
      P.R.knee.rotation.x = kicking * 0.5;
      P.L.leg.rotation.x = 0; P.L.knee.rotation.x = 0.05;
      const hop = Math.abs(Math.sin(t * 3.2 + P.phase)) * 0.05;
      P.hips.position.y = 0.9 + hop;
      P.L.arm.rotation.x = Math.sin(t * 3.2 + P.phase) * 0.3; P.R.arm.rotation.x = -Math.sin(t * 3.2 + P.phase) * 0.3 + kicking * 0.6;
      P.L.arm.rotation.z = -0.25 - waiting * 0.2; P.R.arm.rotation.z = 0.25 + waiting * 0.2;
      P.L.elbow.rotation.x = P.R.elbow.rotation.x = -0.5;
      P.head.rotation.y = Math.sin(t * 0.9 + P.phase) * 0.2;
    });
  }
  for (const b of beacons) {
    b.g.position.y = b.base + Math.sin(t * 1.3 + b.phase) * 0.25;
    b.g.rotation.y = t * 0.6 + b.phase;
  }

  // camera
  town.updateMatrixWorld(true);
  cameraAt(p);
  // on a tall, narrow screen stand further back so the whole group fits
  if (aspect < 0.9) camPos.sub(camLook).multiplyScalar(1 + 0.32 * smooth(0.33, 0.34, p) * (1 - smooth(0.79, 0.83, p)) + 0.22 * smooth(0.14, 0.18, p) * (1 - smooth(0.285, 0.31, p))).add(camLook);
  const pan = smooth(0.89, 0.97, p) * Math.sin(t * 0.11) * (MAP.pan || 0);
  camPos.x += pan; camLook.x += pan;
  // a little life in the hand that holds the camera
  const reach = camPos.distanceTo(camLook);
  const sway = Math.min(0.5, reach * 0.012) * (1 - smooth(0.14, 0.17, p) * (1 - smooth(0.33, 0.34, p)));
  camPos.x += Math.sin(t * 0.43) * sway; camPos.y += Math.sin(t * 0.61 + 1) * sway * 0.6;
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  // leave room for the words: push the scene to the right on wide screens, and up on tall ones
  const room = (1 - 0.5 * smooth(0.14, 0.18, p) * (1 - smooth(0.33, 0.34, p))) * (1 - smooth(0.81, 0.86, p));
  const end = smooth(0.88, 0.94, p);
  const dx = aspect > 1.2 ? -0.11 * room : 0, dy = (aspect > 1.2 ? 0.02 : 0.13 + 0.07 * (1 - smooth(0.05, 0.1, p))) * room + (aspect > 1.2 ? 0.13 : 0.16) * end
    + (aspect > 1.2 ? 0 : 0.11 * smooth(0.14, 0.18, p) * (1 - smooth(0.3, 0.33, p)));
  camera.setViewOffset(W, H, dx * W, dy * H, W, H);
  camera.near = clamp(reach * 0.08, 0.01, 2);
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);

  // the sun follows what the camera looks at, so its shadows stay sharp
  look.copy(camLook);
  sun.target.position.copy(look);
  sun.position.copy(look).addScaledVector(sunDir, 40);
  renderer.shadowMap.autoUpdate = p < 0.87;      // nothing left to cast a shadow once only the map is in view

  // the world map
  const mapIn = smooth(0.815, 0.86, p);
  world.visible = mapIn > 0;
  if (world.visible) {
    const out = smooth(0.83, 0.955, p);
    const reachNow = lerp(0, MAP.far, out);
    dots.material.uniforms.reach.value = reachNow + 26 * mapIn;
    const size = Math.max(0.05, camera.position.length() * 0.0072);
    pinSpots.forEach((spot, i) => {
      const pop = i === 0 ? smooth(0.85, 0.885, p) : clamp((reachNow - spot.far) / 22);
      const k = pop <= 0 ? 0 : backOut(pop) * size * spot.s;
      dummy.position.copy(spot.p);
      dummy.position.y = pop > 0 ? Math.sin(t * 1.7 + spot.phase) * size * 0.12 + size * 0.12 : 0;
      dummy.scale.setScalar(Math.max(k, 0.0001));
      dummy.rotation.y = t * 0.5 + spot.phase;
      dummy.updateMatrix();
      mapPins.setMatrixAt(i, dummy.matrix);
    });
    mapPins.instanceMatrix.needsUpdate = true;
    mapPins.count = pinSpots.length;
    glows.material.size = size * 8;
    glows.material.opacity = out * 0.75;
    glows.geometry.setDrawRange(0, Math.max(1, pinSpots.filter((sp) => sp.far < reachNow).length));
    const ring = (t * 0.5) % 1;
    pulse.scale.setScalar(size * (1 + ring * 7));
    pulse.material.opacity = smooth(0.87, 0.9, p) * (1 - ring) * 0.8;
  }

  renderer.render(scene, camera);
  if (window.__tourStats) window.__tourStats = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, dpr };
  // if the device can't keep up, draw fewer pixels rather than drop frames
  // (an iPhone in Low Power Mode runs at 30 frames a second by design: that is not counted as slow)
  slow = dt > 0.042 ? slow + 1 : Math.max(0, slow - 0.5);
  if (slow > 24 && dpr > 1) {
    slow = 0;
    dpr = Math.max(1, dpr - 0.4);
    renderer.setPixelRatio(dpr);
    resize();
  }
  if (!started) { started = true; root.classList.add('tour-ready'); }
  raf = requestAnimationFrame(frame);
}
function kick() {
  readScroll();
  if (!raf && visible && !document.hidden) { clock.update(); raf = requestAnimationFrame(frame); }
}

// pins sorted by distance, so the glow can be drawn for just the ones that have landed
{
  const order = pinSpots.map((s, i) => i).sort((a, b) => pinSpots[a].far - pinSpots[b].far);
  const sorted = order.map((i) => pinSpots[i]);
  pinSpots.splice(0, pinSpots.length, ...sorted);
  glows.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pinSpots.flatMap((s) => [s.p.x, 0.05, s.p.z]), 3));
}

resize();
readScroll();
pNow = target;
drawPhone(0, 0);
// Build every material and send every texture to the graphics chip now, behind the fade-in,
// so nothing stutters the first time a new place scrolls into view.
world.visible = true;
camera.position.set(0, 60, 120);
camera.lookAt(0, 0, 0);
setMood(0);
renderer.compile(scene, camera);
renderer.render(scene, camera);
world.visible = false;
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
else window.addEventListener('resize', resize);
window.addEventListener('scroll', kick, { passive: true });
window.addEventListener('resize', kick);
document.addEventListener('visibilitychange', kick);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastPhone = -1; });
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); root.classList.remove('tour', 'tour-ready'); });
kick();
