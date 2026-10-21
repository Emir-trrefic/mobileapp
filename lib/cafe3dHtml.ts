import { ACCENTS, FLOORS, WALLS } from './cafeLayout';
import type { CafeLayout } from './cafeLayout';

// 3D kafe sahnesi: WebView içinde three.js (tarayıcının WebGL'i) ile çizilir.
// Oyuncak / diorama tarzı: alçak poligonlu, mat, yumuşak gölgeli. Sahne kafenin 3D profilinden (CafeLayout)
// çizilir: ölçü, stil, renkler, tezgâh yeri, masa / bitki / pencere sayısı. Kişi sayısı kadar genel örnek
// karakter oturur ya da sıra bekler; bir barista her zaman tezgâhtadır. Karakterler kimseyi temsil etmez.
// Kafenin kendi modeli varsa (modelUrl, glTF/GLB) o yüklenir; yüklenemezse profilden çizilir.
//
// Uygulamaya giden mesajlar: {type:'ready'}, {type:'tap', hit}, {type:'colors', wall, floor, accent},
// {type:'notice', message}, {type:'error', message}.
// Uygulamadan çağrılanlar: window.applyScene(layout, people), window.analyzePhotos([dataUrl]).

export const CAFE_BG = '#081028';

const THREE_VERSION = '0.180.0';
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

export type CafeSceneParams = {
  people: number;
  seed: string;
  layout: CafeLayout;
  modelUrl?: string | null;
  mode?: 'view' | 'edit'; // edit: düzenleyicideki önizleme (giriş kısa, kadraj ortalı)
};

const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export function buildCafeHtml(params: CafeSceneParams): string {
  const p = {
    people: Math.max(0, Math.min(19, Math.floor(params.people))),
    seed: String(params.seed).slice(0, 80),
    layout: params.layout,
    modelUrl: params.modelUrl && /^https:\/\//.test(params.modelUrl) ? params.modelUrl : null,
    mode: params.mode ?? 'view',
    bg: CAFE_BG,
    palettes: { walls: WALLS, floors: FLOORS, accents: ACCENTS },
  };
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${CAFE_BG};touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
canvas{display:block;width:100%;height:100%;outline:none}
</style>
<script type="importmap">{"imports":{"three":"${CDN}/build/three.module.min.js","three/addons/":"${CDN}/examples/jsm/"}}</script>
</head>
<body>
<script>
window.__post = function (m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
window.addEventListener('error', function (e) { window.__post({ type: 'error', message: String(e.message || 'betik yüklenemedi') }); }, true);
</script>
<script type="module">
${SCENE_JS.replace('__PARAMS__', safeJson(p))}
</script>
</body>
</html>`;
}

// three.js'i önceden indirip önbelleğe almak için boş sayfa (uygulama açılınca gizli bir WebView'da yüklenir).
export function buildWarmupHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"${CDN}/build/three.module.min.js","three/addons/":"${CDN}/examples/jsm/"}}</script>
</head><body><script type="module">
import 'three';
import 'three/addons/controls/OrbitControls.js';
import 'three/addons/loaders/GLTFLoader.js';
if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('{"type":"warm"}');
</script></body></html>`;
}

// Sahne kodu (tarayıcıda çalışır). İçinde ters tırnak ve dolar-süslü parantez kullanılmaz.
const SCENE_JS = String.raw`
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const P = __PARAMS__;
const post = window.__post;
const PAL = P.palettes;
const EDIT = P.mode === 'edit';

// ------------------------------------------------------------ yardımcılar
function rng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
}
function easeOutBounce(x) {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

const mats = new Map();
function mat(color, flat) {
  const key = color + (flat ? 'f' : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: !!flat }));
  return mats.get(key);
}
function shade(hex, dl) {
  const c = new THREE.Color(hex); c.offsetHSL(0, 0, dl); return '#' + c.getHexString();
}
function box(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); parent.add(m); return m;
}
function cyl(parent, rt, rb, h, color, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat(color));
  m.position.set(x, y, z); parent.add(m); return m;
}

// ------------------------------------------------------------ sahne, ışık, kamera
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.bg);
scene.fog = new THREE.Fog(P.bg, 40, 90);

scene.add(new THREE.HemisphereLight('#FFF4E6', '#22325E', 1.1));
const sun = new THREE.DirectionalLight('#FFE2B8', 2.1);
sun.position.set(6, 11, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 34;
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun);
const fill = new THREE.DirectionalLight('#9DB4FF', 0.45);
fill.position.set(-6, 4, -2);
scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat('#0D1836'));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 220);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.22;
controls.minAzimuthAngle = -0.1; controls.maxAzimuthAngle = 1.65;
controls.enabled = false;

const view = { target: new THREE.Vector3(), radius: 14 };
function frameFor(W, D) {
  const s = Math.max(W, D) / 9;
  const fit = Math.max(1, 0.78 / (window.innerWidth / window.innerHeight));
  // Görüntüleme modunda kafe alttaki bilgi kartının üstünde kalsın diye hedef biraz aşağıda.
  view.target = EDIT ? new THREE.Vector3(0.2 * s, -0.6 * s, 0.6 * s) : new THREE.Vector3(0.6 * s, -1.0 * s, 1.2 * s);
  view.radius = (EDIT ? 17 : 13.8) * fit * s;
  controls.minDistance = view.radius * 0.6;
  controls.maxDistance = view.radius * 1.45;
}
function sph(r, phi, theta) {
  const t = view.target;
  return new THREE.Vector3(t.x + r * Math.sin(phi) * Math.sin(theta), t.y + r * Math.cos(phi), t.z + r * Math.sin(phi) * Math.cos(theta));
}

// ------------------------------------------------------------ karakter
const SHIRTS = ['#E07A5F', '#3D5A80', '#81B29A', '#F2CC8F', '#6D597A', '#457B9D', '#E9C46A', '#2A9D8F', '#F4A261', '#98C1D9'];
const SKINS = ['#F6D7C3', '#E9B996', '#C98E68', '#9A6343', '#6B4430'];
const HAIRS = ['#1E1A19', '#4A3022', '#8A5A35', '#D2A866', '#B9BEC9'];
let LAY = null; // çözümlenmiş profil

function buildPerson(rand, pose) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const g = new THREE.Group();
  const shirt = pose === 'barista' ? '#F4F6FB' : pick(SHIRTS);
  const skin = pick(SKINS), hair = pick(HAIRS);
  const pants = rand() < 0.5 ? '#1B2440' : '#3B3F4A';
  const seated = pose === 'seat';
  const hipY = seated ? 0.5 : 0.62;
  for (const s of [-1, 1]) {
    if (seated) {
      box(g, 0.16, 0.14, 0.42, pants, 0.1 * s, hipY, 0.2);
      box(g, 0.14, 0.46, 0.14, pants, 0.1 * s, 0.24, 0.38);
      box(g, 0.15, 0.08, 0.22, '#0A1128', 0.1 * s, 0.04, 0.44);
    } else {
      box(g, 0.15, hipY, 0.16, pants, 0.1 * s, hipY / 2, 0);
      box(g, 0.16, 0.08, 0.24, '#0A1128', 0.1 * s, 0.04, 0.04);
    }
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 6, 14), mat(shirt));
  body.position.y = hipY + 0.33; g.add(body);
  if (pose === 'barista') box(g, 0.34, 0.42, 0.05, LAY ? LAY.accentHex : '#12296B', 0, hipY + 0.28, 0.19);
  const shoulderY = hipY + 0.55;
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.26 * s, shoulderY, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.3, 4, 8), mat(shirt));
    arm.position.y = -0.2; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(skin));
    hand.position.y = -0.42; pivot.add(hand);
    g.add(pivot); arms.push(pivot);
  }
  if (seated) { arms[1].rotation.x = -0.9; cyl(arms[1], 0.055, 0.045, 0.1, '#FFFFFF', 0, -0.48, 0.04, 14); }
  const head = new THREE.Group();
  head.position.y = shoulderY + 0.28; g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), mat(skin)));
  for (const x of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), mat('#0A1128'));
    eye.position.set(x, 0.02, 0.185); head.add(eye);
  }
  const style = Math.floor(rand() * 4);
  if (style < 3) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(hair));
    cap.rotation.x = -0.3; cap.position.y = 0.02; head.add(cap);
    if (style === 1) { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), mat(hair)); bun.position.set(0, 0.18, -0.12); head.add(bun); }
    if (style === 2) { const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.18, 4, 10), mat(hair)); back.position.set(0, -0.12, -0.08); back.scale.set(1.15, 1, 0.55); head.add(back); }
  } else {
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(pick(SHIRTS)));
    beanie.position.y = 0.04; head.add(beanie);
  }
  g.userData = { isPerson: true, pose, head, arms, phase: rand() * Math.PI * 2, jumpAt: -10 };
  return g;
}

// ------------------------------------------------------------ kafe (profilden)
const SIZES = { s: [7, 6.5], m: [9, 8.5], l: [11, 10] };
const MAX_TABLES = { s: 4, m: 6, l: 8 };
let built = null;

function resolveLayout(l) {
  const size = SIZES[l.size] ? l.size : 'm';
  const wh = SIZES[size];
  return {
    size, W: wh[0], D: wh[1],
    style: l.style || 'klasik',
    wallHex: PAL.walls[l.wall] || PAL.walls[0],
    floorHex: PAL.floors[l.floor] || PAL.floors[0],
    floorTiles: l.floor === 3 || l.floor === 4,
    accentHex: PAL.accents[l.accent] || PAL.accents[0],
    counter: l.counter === 'left' ? 'left' : 'back',
    tables: Math.max(1, Math.min(MAX_TABLES[size], l.tables || 3)),
    plants: Math.max(0, Math.min(5, l.plants || 0)),
    windows: Math.max(0, Math.min(3, l.windows || 0)),
  };
}

function styleKit(L) {
  switch (L.style) {
    case 'modern': return { chair: '#F4F6FB', chairLeg: '#2E3440', tableTop: '#FFFFFF', tableLeg: '#2E3440', round: false, lamp: 'globe', rug: false };
    case 'bohem': return { chair: '#C9A26B', chairLeg: '#8A5A35', tableTop: '#C89B6D', tableLeg: '#8A5A35', round: true, lamp: 'basket', rug: 'pattern' };
    case 'endustriyel': return { chair: '#3B3F4A', chairLeg: '#1E1A19', tableTop: '#6B4A33', tableLeg: '#1E1A19', round: false, lamp: 'cage', rug: false, pipes: true };
    default: return { chair: '#B07A4F', chairLeg: L.accentHex, tableTop: '#F4F1EA', tableLeg: L.accentHex, round: true, lamp: 'cone', rug: 'plain' };
  }
}

function buildCafe(layout, people, seed) {
  const L = resolveLayout(layout);
  LAY = L;
  const K = styleKit(L);
  const rand = rng(seed + ':' + JSON.stringify(layout));
  const W = L.W, D = L.D, hw = W / 2, hd = D / 2;
  const g = new THREE.Group();
  const res = { root: g, drops: [], seats: [], stand: [], lamps: [], sways: [], steam: [], persons: [], puffs: [], barista: null, W, D };

  // platform ve zemin
  box(g, W + 0.4, 0.36, D + 0.4, '#1C2A52', 0, -0.18, 0);
  if (L.floorTiles) {
    const a = L.floorHex, b = shade(L.floorHex, -0.05);
    for (let i = 0; i < Math.ceil(W); i++) for (let j = 0; j < Math.ceil(D); j++) {
      const tw = Math.min(1, W - i), td = Math.min(1, D - j);
      box(g, tw - 0.02, 0.04, td - 0.02, (i + j) % 2 ? a : b, -hw + i + tw / 2, 0.02, -hd + j + td / 2);
    }
  } else {
    const a = L.floorHex, b = shade(L.floorHex, -0.04);
    const n = Math.ceil(D);
    for (let i = 0; i < n; i++) { const pd = Math.min(1, D - i); box(g, W, 0.04, pd - 0.01, i % 2 ? a : b, 0, 0.02, -hd + i + pd / 2); }
  }

  // duvarlar (arka ve sol), süpürgelik vurgu renginde
  box(g, W + 0.2, 2.9, 0.2, L.wallHex, 0, 1.45, -hd - 0.1);
  box(g, 0.2, 2.9, D + 0.2, shade(L.wallHex, -0.03), -hw - 0.1, 1.45, 0);
  box(g, W + 0.2, 0.26, 0.24, L.accentHex, 0, 0.13, -hd - 0.08);
  box(g, 0.24, 0.26, D + 0.2, L.accentHex, -hw - 0.08, 0.13, 0);
  if (K.pipes) {
    cyl(g, 0.06, 0.06, W, '#2E3440', 0, 2.65, -hd + 0.05, 10).rotation.z = Math.PI / 2;
    cyl(g, 0.06, 0.06, D, '#2E3440', -hw + 0.05, 2.45, 0, 10).rotation.x = Math.PI / 2;
  }

  // tezgâh
  const cLen = Math.min(4.2, (L.counter === 'back' ? W : D) * 0.48);
  const counter = new THREE.Group();
  box(counter, cLen, 1.0, 0.85, L.accentHex, 0, 0.5, 0);
  box(counter, cLen + 0.1, 0.08, 0.95, '#D9B48A', 0, 1.04, 0);
  box(counter, cLen, 0.06, 0.02, shade(L.accentHex, 0.12), 0, 0.75, 0.43);
  box(counter, 0.75, 0.5, 0.45, '#D7DCE6', -cLen / 2 + 0.7, 1.33, -0.1);
  box(counter, 0.8, 0.06, 0.5, '#0A1128', -cLen / 2 + 0.7, 1.61, -0.1);
  for (const dx of [-0.18, 0.18]) {
    cyl(counter, 0.05, 0.05, 0.12, '#0A1128', -cLen / 2 + 0.7 + dx, 1.18, 0.16, 10);
    cyl(counter, 0.05, 0.04, 0.08, '#FFFFFF', -cLen / 2 + 0.7 + dx, 1.12, 0.22, 12);
  }
  box(counter, 0.36, 0.22, 0.3, '#0A1128', 0.1, 1.19, 0.05);
  if (cLen > 3) {
    const vitrin = box(counter, 1.0, 0.42, 0.6, '#FFFFFF', cLen / 2 - 0.65, 1.29, 0);
    vitrin.material = new THREE.MeshStandardMaterial({ color: '#E8F0FF', transparent: true, opacity: 0.35, roughness: 0.2 });
    vitrin.userData.noShadow = true;
    ['#F2CC8F', '#E07A5F', '#F4F1EA'].forEach((c, i) => cyl(counter, 0.11, 0.11, 0.1, c, cLen / 2 - 0.95 + i * 0.3, 1.14, 0, 16));
  }
  let cx, cz;
  if (L.counter === 'back') {
    cx = -hw + 0.8 + cLen / 2; cz = -hd + 1.25;
    counter.position.set(cx, 0, cz);
    box(g, 2.0, 1.0, 0.05, '#0A1128', cx, 2.15, -hd + 0.03);
    for (let i = 0; i < 4; i++) box(g, 1.2 - (i % 2) * 0.4, 0.05, 0.02, '#DCE3F5', cx - 0.25 + (i % 2) * 0.2, 2.45 - i * 0.2, -hd + 0.07);
    res.stand.push({ x: cx - 1.0, z: -hd + 2.05, ry: Math.PI }, { x: cx - 0.1, z: -hd + 2.3, ry: Math.PI - 0.4 }, { x: cx + 0.8, z: -hd + 2.0, ry: Math.PI + 0.3 });
    res.barista = { x: cx, z: -hd + 0.55, ry: 0, axis: 'x', span: cLen * 0.3 };
  } else {
    cx = -hw + 1.25; cz = -hd + 0.8 + cLen / 2;
    counter.position.set(cx, 0, cz);
    counter.rotation.y = Math.PI / 2;
    box(g, 0.05, 1.0, 2.0, '#0A1128', -hw + 0.03, 2.15, cz);
    for (let i = 0; i < 4; i++) box(g, 0.02, 0.05, 1.2 - (i % 2) * 0.4, '#DCE3F5', -hw + 0.07, 2.45 - i * 0.2, cz - 0.25 + (i % 2) * 0.2);
    res.stand.push({ x: -hw + 2.05, z: cz - 1.0, ry: -Math.PI / 2 }, { x: -hw + 2.3, z: cz - 0.1, ry: -Math.PI / 2 + 0.4 }, { x: -hw + 2.0, z: cz + 0.8, ry: -Math.PI / 2 - 0.3 });
    res.barista = { x: -hw + 0.55, z: cz, ry: Math.PI / 2, axis: 'z', span: cLen * 0.3 };
  }
  g.add(counter); res.drops.push(counter);

  // raflar: tezgâhın olmadığı duvarda
  for (const y of [1.5, 2.1]) {
    if (L.counter === 'back') {
      box(g, 0.3, 0.05, 1.8, '#B07A4F', -hw + 0.15, y, -hd + 2.6);
      for (let i = 0; i < 4; i++) cyl(g, 0.07, 0.06, 0.14, i % 2 ? '#F4F6FB' : L.accentHex, -hw + 0.17, y + 0.1, -hd + 1.9 + i * 0.45, 12);
    } else {
      box(g, 1.8, 0.05, 0.3, '#B07A4F', -hw + 3.4, y, -hd + 0.15);
      for (let i = 0; i < 4; i++) cyl(g, 0.07, 0.06, 0.14, i % 2 ? '#F4F6FB' : L.accentHex, -hw + 2.7 + i * 0.45, y + 0.1, -hd + 0.17, 12);
    }
  }

  // kapı
  if (L.counter === 'back') { box(g, 0.06, 2.1, 1.1, L.accentHex, -hw + 0.03, 1.05, hd - 1.3); box(g, 0.04, 0.08, 0.3, '#E9C46A', -hw + 0.08, 1.05, hd - 1.65); }
  else { box(g, 1.1, 2.1, 0.06, L.accentHex, hw - 1.3, 1.05, -hd + 0.03); box(g, 0.3, 0.08, 0.04, '#E9C46A', hw - 1.65, 1.05, -hd + 0.08); }

  // pencereler: boş duvar parçalarına
  const slots = [];
  if (L.counter === 'back') {
    for (let x = cx + cLen / 2 + 1.1; x <= hw - 0.9; x += 1.9) slots.push({ wall: 'back', p: x });
    for (let z = -hd + 4.0; z <= hd - 2.6; z += 1.9) slots.push({ wall: 'left', p: z });
  } else {
    for (let x = -hw + 4.9; x <= hw - 2.4; x += 1.9) slots.push({ wall: 'back', p: x });
    for (let z = cz + cLen / 2 + 1.1; z <= hd - 0.9; z += 1.9) slots.push({ wall: 'left', p: z });
  }
  const glassMat = new THREE.MeshStandardMaterial({ color: '#BFD0FF', emissive: '#3D5FB0', emissiveIntensity: 0.35, roughness: 0.4 });
  slots.slice(0, L.windows).forEach((s) => {
    if (s.wall === 'back') {
      box(g, 1.5, 1.3, 0.06, L.accentHex, s.p, 1.65, -hd + 0.02);
      box(g, 1.32, 1.12, 0.04, '#BFD0FF', s.p, 1.65, -hd + 0.05).material = glassMat;
      box(g, 0.06, 1.12, 0.05, L.accentHex, s.p, 1.65, -hd + 0.07);
    } else {
      box(g, 0.06, 1.3, 1.5, L.accentHex, -hw + 0.02, 1.65, s.p);
      box(g, 0.04, 1.12, 1.32, '#BFD0FF', -hw + 0.05, 1.65, s.p).material = glassMat;
      box(g, 0.05, 1.12, 0.06, L.accentHex, -hw + 0.07, 1.65, s.p);
    }
  });

  // masalar: tezgâhın önündeki boş alana ızgara + küçük sapma
  const x0 = L.counter === 'back' ? -hw + 1.0 : -hw + 3.0;
  const z0 = L.counter === 'back' ? -hd + 3.0 : -hd + 1.0;
  const x1 = hw - 0.9, z1 = hd - 0.9;
  const aw = x1 - x0, ad = z1 - z0;
  const cols = Math.max(1, Math.round(Math.sqrt(L.tables * aw / ad)));
  const rows = Math.max(1, Math.ceil(L.tables / cols));
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([x0 + (c + 0.5) * aw / cols, z0 + (r + 0.5) * ad / rows, rand()]);
  cells.sort((a, b) => a[2] - b[2]);
  const tables = cells.slice(0, L.tables).map((c) => [c[0] + (rand() - 0.5) * 0.4, c[1] + (rand() - 0.5) * 0.4]);
  if (K.rug && tables.length) {
    const rx = tables[0][0], rz = tables[0][1];
    cyl(g, 1.35, 1.35, 0.012, K.rug === 'pattern' ? '#A4473A' : shade(L.accentHex, 0.1), rx, 0.047, rz, 40);
    if (K.rug === 'pattern') { cyl(g, 0.95, 0.95, 0.014, '#E9C46A', rx, 0.049, rz, 40); cyl(g, 0.5, 0.5, 0.016, '#2A6F5E', rx, 0.051, rz, 40); }
  }
  for (const [x, z] of tables) {
    const tg = new THREE.Group();
    if (K.round) cyl(tg, 0.52, 0.52, 0.06, K.tableTop, 0, 0.76, 0, 32);
    else box(tg, 0.95, 0.06, 0.95, K.tableTop, 0, 0.76, 0);
    cyl(tg, 0.05, 0.05, 0.72, K.tableLeg, 0, 0.38, 0, 10);
    cyl(tg, 0.26, 0.28, 0.04, K.tableLeg, 0, 0.06, 0, 20);
    const a0 = K.round ? rand() * Math.PI : Math.floor(rand() * 2) * Math.PI / 2;
    for (const s of [0, Math.PI]) {
      const ang = a0 + s;
      const ox = Math.cos(ang) * 0.9, oz = Math.sin(ang) * 0.9;
      const ch = new THREE.Group();
      box(ch, 0.44, 0.06, 0.44, K.chair, 0, 0.45, 0);
      box(ch, 0.44, 0.5, 0.06, K.chair, 0, 0.72, -0.2);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(ch, 0.04, 0.44, 0.04, K.chairLeg, lx, 0.22, lz);
      ch.position.set(ox, 0, oz);
      ch.rotation.y = Math.atan2(-ox, -oz);
      tg.add(ch);
      res.seats.push({ x: x + ox, z: z + oz, ry: Math.atan2(-ox, -oz), table: [x, z] });
    }
    tg.position.set(x, 0, z);
    g.add(tg); res.drops.push(tg);
  }

  // bitkiler: köşeler ve boş yerler
  const spots = [[hw - 0.5, -hd + 0.5], [-hw + 0.5, hd - 0.5], [hw - 0.5, hd - 0.5], [hw - 0.5, 0], [0.2, hd - 0.5], [-hw + 0.5, -hd + 0.5]];
  let placed = 0;
  for (const [x, z] of spots) {
    if (placed >= L.plants + (L.style === 'bohem' ? 1 : 0)) break;
    if (tables.some((tb) => Math.hypot(tb[0] - x, tb[1] - z) < 1.4)) continue;
    if (Math.hypot(cx - x, cz - z) < cLen / 2 + 0.8) continue;
    const big = placed % 2 === 0;
    const pg = new THREE.Group();
    const sc = big ? 1 : 0.65;
    cyl(pg, 0.3 * sc, 0.24 * sc, 0.5 * sc, L.style === 'endustriyel' ? '#3B3F4A' : '#E9E4DA', 0, 0.25 * sc + 0.04, 0, 16);
    const leaves = big ? 6 : 4;
    for (let i = 0; i < leaves; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((0.24 + rand() * 0.14) * sc, 0), mat(rand() < 0.5 ? '#5E8C6A' : '#4E7A5B', true));
      const ang = (i / leaves) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 0.16 * sc, (0.75 + rand() * 0.5) * sc, Math.sin(ang) * 0.16 * sc);
      leaf.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      pg.add(leaf);
    }
    pg.userData.sway = rand() * Math.PI * 2;
    pg.position.set(x, 0, z);
    g.add(pg); res.drops.push(pg); res.sways.push(pg);
    placed++;
  }

  // sarkıt lambalar: masaların ve tezgâhın üstünde
  const lampAt = tables.slice(0, 4).concat([[cx, cz]]);
  for (const [x, z] of lampAt) {
    const l = new THREE.Group();
    cyl(l, 0.008, 0.008, 1.1, '#0A1128', 0, -0.55, 0, 6);
    let shadeMesh;
    if (K.lamp === 'globe') shadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), new THREE.MeshStandardMaterial({ color: '#F4F6FB', emissive: '#FFE7B0', emissiveIntensity: 0.6, roughness: 0.6 }));
    else if (K.lamp === 'basket') shadeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.3, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#D9B48A', roughness: 1, side: THREE.DoubleSide }));
    else if (K.lamp === 'cage') shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#1E1A19', roughness: 0.6, side: THREE.DoubleSide, wireframe: true }));
    else shadeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.26, 20, 1, true), new THREE.MeshStandardMaterial({ color: L.accentHex, roughness: 0.9, side: THREE.DoubleSide }));
    shadeMesh.position.y = -1.2; l.add(shadeMesh);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshBasicMaterial({ color: '#FFE7B0' }));
    bulb.position.y = -1.32; bulb.userData.noShadow = true; l.add(bulb);
    l.position.set(x, 3.6, z);
    l.userData.phase = rand() * Math.PI * 2;
    g.add(l); res.lamps.push(l);
  }

  // kişiler
  const prand = rng(seed + ':people');
  const order = res.seats.map((s) => ({ s, k: prand() })).sort((a, b) => a.k - b.k).map((o) => o.s);
  const n = Math.max(0, people);
  for (let i = 0; i < n; i++) {
    const seat = order[i];
    const spot = seat ? null : res.stand[i - order.length];
    if (!seat && !spot) break;
    const p = buildPerson(prand, seat ? 'seat' : 'stand');
    const at = seat || spot;
    p.position.set(at.x, 0, at.z);
    p.userData.baseRy = at.ry;
    p.rotation.y = at.ry;
    p.userData.delay = (EDIT ? 0.1 : 1.3) + i * (EDIT ? 0.03 : 0.12);
    p.scale.setScalar(0.001);
    g.add(p); res.persons.push(p);
    if (seat) res.steam.push(seat.table);
  }
  const bdef = res.barista;
  const bar = buildPerson(prand, 'barista');
  bar.position.set(bdef.x, 0, bdef.z);
  bar.userData.baseRy = bdef.ry;
  bar.userData.baristaDef = bdef;
  bar.userData.delay = EDIT ? 0.05 : 1.15;
  bar.scale.setScalar(0.001);
  g.add(bar); res.persons.push(bar);

  const seen = new Set();
  for (const [x, z] of res.steam) {
    const key = x + ',' + z;
    if (seen.has(key)) continue;
    seen.add(key);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }));
      m.userData = { x, z, offset: i / 3, noShadow: true };
      g.add(m); res.puffs.push(m);
    }
  }

  g.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; } });
  return res;
}

// Kafenin kendi modeli: ortalanır, profil ölçüsüne sığdırılır; kişiler ortada bir halkaya dizilir.
function loadModel(url, people, seed) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => {
      const L = resolveLayout(P.layout);
      LAY = L;
      const g = new THREE.Group();
      const m = gltf.scene;
      const bb = new THREE.Box3().setFromObject(m);
      const size = bb.getSize(new THREE.Vector3());
      m.scale.setScalar(Math.max(L.W, L.D) / Math.max(size.x, size.z, 0.001));
      const bb2 = new THREE.Box3().setFromObject(m);
      const c = bb2.getCenter(new THREE.Vector3());
      m.position.set(-c.x, -bb2.min.y, -c.z);
      g.add(m);
      const res = { root: g, drops: [g], seats: [], stand: [], lamps: [], sways: [], steam: [], persons: [], puffs: [], W: L.W, D: L.D };
      const prand = rng(seed + ':people');
      for (let i = 0; i < Math.min(people, 13); i++) {
        const ang = (i / 13) * Math.PI * 2;
        const p = buildPerson(prand, 'stand');
        p.position.set(Math.cos(ang) * 2.2, 0, Math.sin(ang) * 2.2);
        p.userData.baseRy = Math.atan2(-Math.cos(ang), -Math.sin(ang));
        p.userData.delay = 1.3 + i * 0.12;
        p.scale.setScalar(0.001);
        g.add(p); res.persons.push(p);
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      resolve(res);
    }, undefined, reject);
  });
}

function disposeGroup(g) {
  g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(g);
}

// ------------------------------------------------------------ etkileşim
let t0 = performance.now();
let lastInput = 0;
let down = null;
let dropFrom = -100; // düşerek gelme animasyonunun başladığı an (saniye)
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || !built) return;
  const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
  const quick = performance.now() - down.t < 350;
  down = null;
  if (moved > 8 || !quick) return;
  ray.setFromCamera(new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), camera);
  const hits = ray.intersectObjects(built.persons, true);
  let hit = false;
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.isPerson) o = o.parent;
    if (o) {
      const t = (performance.now() - t0) / 1000;
      if (t - o.userData.jumpAt > 0.6) o.userData.jumpAt = t;
      hit = true; break;
    }
  }
  post({ type: 'tap', hit });
});
controls.addEventListener('start', () => { lastInput = performance.now(); controls.autoRotate = false; });
controls.addEventListener('end', () => { lastInput = performance.now(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------ döngü
let sentReady = false;
let swayDir = 1;
let introDone = false;
let camStart = null;
let pop = null; // düzenleyicide yeniden kurulunca kısa bir esneme
let refit = null; // ölçü değişince kameranın yeni kadraja yumuşak geçişi

function frame() {
  const now = performance.now();
  const t = (now - t0) / 1000;

  if (!introDone) {
    const dur = EDIT ? 0.9 : 1.9;
    const k = easeOutCubic(Math.min(1, t / dur));
    const end = sph(view.radius, 0.9, 0.78);
    camera.position.lerpVectors(camStart, end, k);
    camera.lookAt(view.target);
    if (k >= 1) { introDone = true; controls.target.copy(view.target); controls.enabled = true; controls.update(); lastInput = now - 2000; }
  } else {
    if (!EDIT && now - lastInput > 3500) {
      const az = controls.getAzimuthalAngle();
      if (az > 1.45) swayDir = -1; else if (az < 0.15) swayDir = 1;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35 * swayDir;
    }
    if (refit) {
      const k = easeOutCubic(clamp01((now - refit.t) / 450));
      const dir = camera.position.clone().sub(controls.target).normalize();
      controls.target.lerpVectors(refit.from, refit.to, k);
      camera.position.copy(controls.target).addScaledVector(dir, refit.r0 + (refit.r1 - refit.r0) * k);
      if (k >= 1) refit = null;
    }
    controls.update();
  }

  if (built) {
    built.drops.forEach((d, i) => {
      if (d.userData.baseY === undefined) d.userData.baseY = d.position.y;
      const k = clamp01((t - dropFrom - 0.35 - i * 0.08) / 0.85);
      d.position.y = d.userData.baseY + (1 - easeOutBounce(k)) * 6;
    });
    if (pop) {
      const k = clamp01((now - pop) / 350);
      built.root.scale.setScalar(0.96 + 0.04 * easeOutCubic(k) + Math.sin(k * Math.PI) * 0.015);
      if (k >= 1) pop = null;
    }
    for (const p of built.sways) p.rotation.z = Math.sin(t * 1.2 + p.userData.sway) * 0.03;
    for (const l of built.lamps) l.rotation.z = Math.sin(t * 0.9 + l.userData.phase) * 0.04;
    for (const p of built.persons) {
      const u = p.userData;
      const k = clamp01((t - u.delay) / 0.4);
      const sc = k === 0 ? 0.001 : k * (1 + Math.sin(k * Math.PI) * 0.25 * (1 - k));
      p.scale.setScalar(Math.max(0.001, sc));
      const j = (t - u.jumpAt) / 0.6;
      const inJump = j >= 0 && j <= 1;
      p.position.y = (inJump ? Math.sin(j * Math.PI) * 0.55 : 0) + (u.pose === 'stand' ? Math.abs(Math.sin(t * 1.4 + u.phase)) * 0.02 : 0);
      p.rotation.y = u.baseRy + (inJump ? j * Math.PI * 2 : 0);
      u.head.rotation.y = Math.sin(t * 0.6 + u.phase) * 0.45;
      if (u.pose === 'seat') {
        const sip = Math.max(0, Math.sin(t * 0.7 + u.phase) - 0.6) / 0.4;
        u.arms[1].rotation.x = -0.9 - sip * 1.2;
      } else if (u.pose === 'barista') {
        const b = u.baristaDef;
        const off = Math.sin(t * 0.45) * b.span;
        if (b.axis === 'x') p.position.x = b.x + off; else p.position.z = b.z + off;
        u.arms[0].rotation.x = -0.6 + Math.sin(t * 3) * 0.25;
        u.arms[1].rotation.x = -0.6 - Math.sin(t * 3) * 0.25;
      } else {
        u.arms[0].rotation.z = Math.sin(t * 1.4 + u.phase) * 0.06;
      }
    }
    for (const m of built.puffs) {
      const c = ((t * 0.45 + m.userData.offset) % 1 + 1) % 1;
      m.position.set(m.userData.x + Math.sin(c * 6 + m.userData.x) * 0.06, 0.96 + c * 0.7, m.userData.z);
      m.scale.setScalar(0.6 + c * 1.4);
      m.material.opacity = t < 2.2 ? 0 : 0.45 * Math.sin(c * Math.PI);
    }
  }

  renderer.render(scene, camera);
  if (!sentReady) { sentReady = true; post({ type: 'ready' }); }
}

function install(res, animateDrop) {
  if (built) disposeGroup(built.root);
  built = res;
  scene.add(res.root);
  if (!animateDrop) res.drops.forEach((d) => { d.userData.baseY = d.position.y; });
  dropFrom = animateDrop ? (performance.now() - t0) / 1000 : -100;
}

// Düzenleyiciden: profil değişince kafe yeniden kurulur (sayfa yenilenmez, kamera yerinde kalır).
window.applyScene = function (layout, people) {
  try {
    const res = buildCafe(layout, typeof people === 'number' ? people : P.people, P.seed);
    const t = (performance.now() - t0) / 1000;
    res.persons.forEach((p, i) => { p.userData.delay = t + i * 0.03; });
    const sizeChanged = !built || built.W !== res.W || built.D !== res.D;
    install(res, false);
    pop = performance.now();
    if (sizeChanged && introDone) {
      const r0 = camera.position.distanceTo(controls.target);
      frameFor(res.W, res.D);
      refit = { from: controls.target.clone(), to: view.target.clone(), r0, r1: view.radius, t: performance.now() };
    }
  } catch (e) {
    post({ type: 'notice', message: String(e && e.message) });
  }
};

// Fotoğraflardan tema renkleri: üst kısım duvar, alt kısım zemin, doygun renkler vurgu.
// Sonuç her zaman paletteki en yakın renge oturtulur (tema bozulmaz).
function nearest(rgb, list) {
  if (!rgb) return null;
  let best = 0, bd = Infinity;
  list.forEach((hex, i) => {
    const c = new THREE.Color(hex);
    const r = c.r * 255, g = c.g * 255, b = c.b * 255;
    const rm = (rgb[0] + r) / 2;
    const d = (2 + rm / 256) * (rgb[0] - r) ** 2 + 4 * (rgb[1] - g) ** 2 + (2 + (255 - rm) / 256) * (rgb[2] - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function loadImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
window.analyzePhotos = async function (urls) {
  try {
    const wall = [0, 0, 0, 0], floor = [0, 0, 0, 0], acc = [0, 0, 0, 0];
    const N = 48;
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    for (const u of urls) {
      const im = await loadImg(u);
      cx.drawImage(im, 0, 0, N, N);
      const d = cx.getImageData(0, 0, N, N).data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
        const s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
        if (y < N * 0.42 && l > 50 && l < 245) { wall[0] += r; wall[1] += g; wall[2] += b; wall[3]++; }
        if (y > N * 0.7) { floor[0] += r; floor[1] += g; floor[2] += b; floor[3]++; }
        if (s > 0.38 && l > 35 && l < 215) { acc[0] += r; acc[1] += g; acc[2] += b; acc[3]++; }
      }
    }
    const avg = (a, min) => (a[3] > min ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : null);
    post({ type: 'colors', wall: nearest(avg(wall, 20), PAL.walls), floor: nearest(avg(floor, 20), PAL.floors), accent: nearest(avg(acc, 40), PAL.accents) });
  } catch (e) {
    post({ type: 'colors', wall: null, floor: null, accent: null, error: String(e && e.message) });
  }
};

async function start() {
  let res = null;
  if (P.modelUrl) {
    try { res = await loadModel(P.modelUrl, P.people, P.seed); }
    catch (e) { post({ type: 'notice', message: 'Kafe modeli yüklenemedi, profilden çizildi.' }); }
  }
  if (!res) res = buildCafe(P.layout, P.people, P.seed);
  frameFor(res.W, res.D);
  camStart = EDIT ? sph(view.radius * 1.5, 0.5, 1.2) : sph(view.radius * 2.2, 0.2, 1.7);
  camera.position.copy(camStart);
  camera.lookAt(view.target);
  t0 = performance.now();
  install(res, !EDIT);
  renderer.setAnimationLoop(frame);
}
start();
`;
