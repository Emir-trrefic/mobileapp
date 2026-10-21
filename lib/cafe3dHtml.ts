// 3D kafe sahnesi: WebView içinde three.js (tarayıcının WebGL'i) ile çizilir.
// Oyuncak / diorama tarzı: alçak poligonlu, mat, yumuşak gölgeli bir kafe. Duvarlar kesik (arkada ve solda),
// önden ve sağdan içerisi görünür. Kişi sayısı kadar örnek karakter masalara oturur ya da tezgâhta sıra
// bekler; bir barista her zaman tezgâhın arkasındadır. Karakterler kimseyi temsil etmez.
// Kafenin kendi modeli varsa (modelUrl, glTF/GLB) o yüklenir; yoksa ya da yüklenemezse örnek kafe çizilir.
// Sayfa uygulamaya şu mesajları yollar: {type:'ready'}, {type:'tap', hit}, {type:'error', message}.

export const CAFE_BG = '#081028';

const THREE_VERSION = '0.180.0';

export type CafeSceneParams = {
  people: number;
  seed: string;
  modelUrl?: string | null;
};

export function buildCafeHtml(params: CafeSceneParams): string {
  const p = {
    people: Math.max(0, Math.min(13, Math.floor(params.people))),
    seed: String(params.seed).slice(0, 80),
    modelUrl: params.modelUrl && /^https:\/\//.test(params.modelUrl) ? params.modelUrl : null,
    bg: CAFE_BG,
  };
  // </script> kaçışı: JSON içindeki "<" karakterleri < olarak yazılır.
  const json = JSON.stringify(p).replace(/</g, '\\u003c');
  const cdn = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
html,body{margin:0;height:100%;overflow:hidden;background:${CAFE_BG};touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
canvas{display:block;width:100%;height:100%;outline:none}
</style>
<script type="importmap">{"imports":{"three":"${cdn}/build/three.module.min.js","three/addons/":"${cdn}/examples/jsm/"}}</script>
</head>
<body>
<script>
window.__post = function (m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
window.addEventListener('error', function (e) { window.__post({ type: 'error', message: String(e.message || 'betik yüklenemedi') }); }, true);
</script>
<script type="module">
${SCENE_JS.replace('__PARAMS__', json)}
</script>
</body>
</html>`;
}

// Sahne kodu (tarayıcıda çalışır). İçinde ters tırnak ve dolar-süslü parantez kullanılmaz.
const SCENE_JS = String.raw`
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const P = __PARAMS__;
const post = window.__post;

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
const rand = rng(P.seed);

const mats = new Map();
function mat(color, flat) {
  const key = color + (flat ? 'f' : '');
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: !!flat }));
  return mats.get(key);
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
scene.fog = new THREE.Fog(P.bg, 40, 80);

scene.add(new THREE.HemisphereLight('#FFF4E6', '#22325E', 1.1));
const sun = new THREE.DirectionalLight('#FFE2B8', 2.1);
sun.position.set(6, 10, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
scene.add(sun);
const fill = new THREE.DirectionalLight('#9DB4FF', 0.45);
fill.position.set(-6, 4, -2);
scene.add(fill);

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 200);
// Dikey ekranda kafenin tamamı sığsın diye uzaklık ekran oranına göre büyür.
const fit = Math.max(1, 0.78 / (window.innerWidth / window.innerHeight));
// Hedef biraz aşağıda: kafe ekranın üst kısmında, alttaki bilgi kartının üstünde durur.
const target = new THREE.Vector3(0.6, -1.0, 1.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.55;
controls.minDistance = 8 * fit; controls.maxDistance = 20 * fit;
controls.minPolarAngle = 0.55; controls.maxPolarAngle = 1.22;
controls.minAzimuthAngle = -0.1; controls.maxAzimuthAngle = 1.65;
controls.enabled = false;

function sph(r, phi, theta) {
  return new THREE.Vector3(
    target.x + r * Math.sin(phi) * Math.sin(theta),
    target.y + r * Math.cos(phi),
    target.z + r * Math.sin(phi) * Math.cos(theta));
}
const camEnd = sph(13.8 * fit, 0.9, 0.78);
camera.position.copy(sph(30 * fit, 0.2, 1.7));
camera.lookAt(target);

// zemin
const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat('#0D1836'));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = true;
scene.add(ground);

// ------------------------------------------------------------ karakter
const SHIRTS = ['#E07A5F', '#3D5A80', '#81B29A', '#F2CC8F', '#6D597A', '#457B9D', '#E9C46A', '#2A9D8F', '#F4A261', '#98C1D9'];
const SKINS = ['#F6D7C3', '#E9B996', '#C98E68', '#9A6343', '#6B4430'];
const HAIRS = ['#1E1A19', '#4A3022', '#8A5A35', '#D2A866', '#B9BEC9'];
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function buildPerson(pose) {
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
  if (pose === 'barista') box(g, 0.34, 0.42, 0.05, '#12296B', 0, hipY + 0.28, 0.19);
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

// ------------------------------------------------------------ örnek kafe
const drops = [];
const seats = [];
const standSpots = [];
const steamAt = [];
const lamps = [];
const sways = [];
const tableSpots = [[1.9, -1.9, 0.3], [3.2, 0.6, 1.2], [0.5, 0.9, 0.0], [2.0, 3.1, 0.7], [-2.3, 1.6, 1.0]];

function buildSampleCafe() {
  box(scene, 9.4, 0.36, 9.4, '#1C2A52', 0, -0.18, 0);
  for (let i = 0; i < 9; i++) box(scene, 9, 0.04, 0.99, i % 2 ? '#C89B6D' : '#BE9062', 0, 0.02, -4 + i);
  cyl(scene, 1.35, 1.35, 0.012, '#24407F', 0.5, 0.047, 0.9, 40);

  box(scene, 9.2, 2.9, 0.2, '#EFE6D8', 0, 1.45, -4.6);
  box(scene, 0.2, 2.9, 9.2, '#E8DECD', -4.6, 1.45, 0);
  box(scene, 9.2, 0.26, 0.24, '#12296B', 0, 0.13, -4.58);
  box(scene, 0.24, 0.26, 9.2, '#12296B', -4.58, 0.13, 0);
  for (const x of [1.6, 3.4]) {
    box(scene, 1.5, 1.3, 0.06, '#12296B', x, 1.65, -4.48);
    const glass = box(scene, 1.32, 1.12, 0.04, '#9DB4FF', x, 1.65, -4.45);
    glass.material = new THREE.MeshStandardMaterial({ color: '#BFD0FF', emissive: '#3D5FB0', emissiveIntensity: 0.35, roughness: 0.4 });
    box(scene, 0.06, 1.12, 0.05, '#12296B', x, 1.65, -4.43);
  }
  box(scene, 0.06, 2.1, 1.1, '#12296B', -4.47, 1.05, 2.8);
  box(scene, 0.04, 0.08, 0.3, '#E9C46A', -4.42, 1.05, 2.45);
  box(scene, 2.0, 1.0, 0.05, '#0A1128', -1.8, 2.15, -4.47);
  for (let i = 0; i < 4; i++) box(scene, 1.2 - (i % 2) * 0.4, 0.05, 0.02, '#DCE3F5', -2.05 + (i % 2) * 0.2, 2.45 - i * 0.2, -4.43);
  for (const y of [1.5, 2.1]) {
    box(scene, 0.3, 0.05, 1.8, '#B07A4F', -4.35, y, -1.2);
    for (let i = 0; i < 4; i++) cyl(scene, 0.07, 0.06, 0.14, i % 2 ? '#F4F6FB' : '#E07A5F', -4.33, y + 0.1, -1.9 + i * 0.45, 12);
  }

  // tezgâh
  const counter = new THREE.Group();
  box(counter, 4.2, 1.0, 0.85, '#12296B', 0, 0.5, 0);
  box(counter, 4.3, 0.08, 0.95, '#D9B48A', 0, 1.04, 0);
  box(counter, 4.2, 0.06, 0.02, '#2A4FB8', 0, 0.75, 0.43);
  box(counter, 0.75, 0.5, 0.45, '#D7DCE6', -1.2, 1.33, -0.1);
  box(counter, 0.8, 0.06, 0.5, '#0A1128', -1.2, 1.61, -0.1);
  for (const x of [-1.38, -1.02]) {
    cyl(counter, 0.05, 0.05, 0.12, '#0A1128', x, 1.18, 0.16, 10);
    cyl(counter, 0.05, 0.04, 0.08, '#FFFFFF', x, 1.12, 0.22, 12);
  }
  box(counter, 0.36, 0.22, 0.3, '#0A1128', 0.0, 1.19, 0.05);
  const vitrin = box(counter, 1.1, 0.42, 0.6, '#FFFFFF', 1.3, 1.29, 0.0);
  vitrin.material = new THREE.MeshStandardMaterial({ color: '#E8F0FF', transparent: true, opacity: 0.35, roughness: 0.2 });
  vitrin.userData.noShadow = true;
  ['#F2CC8F', '#E07A5F', '#F4F1EA'].forEach((c, i) => cyl(counter, 0.12, 0.12, 0.1, c, 0.95 + i * 0.35, 1.14, 0.0, 16));
  counter.position.set(-1.6, 0, -3.35);
  scene.add(counter); drops.push(counter);

  // masalar ve sandalyeler
  for (const [x, z, a] of tableSpots) {
    const group = new THREE.Group();
    cyl(group, 0.52, 0.52, 0.06, '#F4F1EA', 0, 0.76, 0, 32);
    cyl(group, 0.05, 0.05, 0.72, '#12296B', 0, 0.38, 0, 10);
    cyl(group, 0.26, 0.28, 0.04, '#12296B', 0, 0.06, 0, 20);
    for (const s of [0, Math.PI]) {
      const ang = a + s;
      const cx = Math.cos(ang) * 0.9, cz = Math.sin(ang) * 0.9;
      const ch = new THREE.Group();
      box(ch, 0.44, 0.06, 0.44, '#B07A4F', 0, 0.45, 0);
      box(ch, 0.44, 0.5, 0.06, '#B07A4F', 0, 0.72, -0.2);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(ch, 0.04, 0.44, 0.04, '#12296B', lx, 0.22, lz);
      ch.position.set(cx, 0, cz);
      ch.rotation.y = Math.atan2(-cx, -cz);
      group.add(ch);
      seats.push({ x: x + cx, z: z + cz, ry: Math.atan2(-cx, -cz), table: [x, z] });
    }
    group.position.set(x, 0, z);
    scene.add(group); drops.push(group);
  }

  // bitkiler
  for (const [x, z, big] of [[3.9, -3.9, true], [-3.9, 3.9, true], [-3.9, -3.9, false], [4.0, 2.0, false]]) {
    const p = new THREE.Group();
    const s = big ? 1 : 0.65;
    cyl(p, 0.3 * s, 0.24 * s, 0.5 * s, '#E9E4DA', 0, 0.25 * s + 0.04, 0, 16);
    const leaves = big ? 6 : 4;
    for (let i = 0; i < leaves; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((0.24 + rand() * 0.14) * s, 0), mat(rand() < 0.5 ? '#5E8C6A' : '#4E7A5B', true));
      const ang = (i / leaves) * Math.PI * 2;
      leaf.position.set(Math.cos(ang) * 0.16 * s, (0.75 + rand() * 0.5) * s, Math.sin(ang) * 0.16 * s);
      leaf.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      p.add(leaf);
    }
    p.userData.sway = rand() * Math.PI * 2;
    p.position.set(x, 0, z);
    scene.add(p); drops.push(p); sways.push(p);
  }

  // sarkıt lambalar
  for (const [x, z] of [[1.9, -1.9], [0.5, 0.9], [3.2, 0.6], [-1.6, -3.3]]) {
    const l = new THREE.Group();
    cyl(l, 0.008, 0.008, 1.1, '#0A1128', 0, -0.55, 0, 6);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.26, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#12296B', roughness: 0.9, side: THREE.DoubleSide }));
    shade.position.y = -1.2; l.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshBasicMaterial({ color: '#FFE7B0' }));
    bulb.position.y = -1.32; bulb.userData.noShadow = true; l.add(bulb);
    l.position.set(x, 3.6, z);
    l.userData.phase = rand() * Math.PI * 2;
    scene.add(l); lamps.push(l);
  }

  standSpots.push({ x: -1.2, z: -2.45, ry: Math.PI }, { x: -0.3, z: -2.2, ry: Math.PI - 0.4 }, { x: 3.0, z: -3.7, ry: Math.PI * 0.85 });
}

// Kafenin kendi modeli: ortalanır, ~9 birimlik alana sığdırılır; karakterler ortada bir halkaya dizilir.
function loadModel(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => {
      const root = gltf.scene;
      const bb = new THREE.Box3().setFromObject(root);
      const size = bb.getSize(new THREE.Vector3());
      const s = 9 / Math.max(size.x, size.z, 0.001);
      root.scale.setScalar(s);
      const bb2 = new THREE.Box3().setFromObject(root);
      const c = bb2.getCenter(new THREE.Vector3());
      root.position.set(-c.x, -bb2.min.y, -c.z);
      scene.add(root); drops.push(root);
      for (let i = 0; i < 13; i++) {
        const ang = (i / 13) * Math.PI * 2;
        standSpots.push({ x: Math.cos(ang) * 2.2, z: Math.sin(ang) * 2.2, ry: Math.atan2(-Math.cos(ang), -Math.sin(ang)) });
      }
      resolve();
    }, undefined, reject);
  });
}

// ------------------------------------------------------------ kişiler ve buhar
const persons = [];
const puffs = [];

function placePeople() {
  const n = P.people;
  const order = seats.map((s) => ({ s, k: rand() })).sort((a, b) => a.k - b.k).map((o) => o.s);
  for (let i = 0; i < n; i++) {
    const seat = order[i];
    const spot = seat ? null : standSpots[i - order.length];
    if (!seat && !spot) break;
    const p = buildPerson(seat ? 'seat' : 'stand');
    const at = seat || spot;
    p.position.set(at.x, 0, at.z);
    p.rotation.y = at.ry;
    p.userData.baseRy = at.ry;
    p.userData.delay = 1.3 + i * 0.12;
    p.scale.setScalar(0.001);
    scene.add(p); persons.push(p);
    if (seat) steamAt.push(seat.table);
  }
  if (seats.length) {
    const b = buildPerson('barista');
    b.position.set(-2.0, 0, -4.1);
    b.userData.baseRy = 0;
    b.userData.delay = 1.15;
    b.scale.setScalar(0.001);
    scene.add(b); persons.push(b);
  }
  const seen = new Set();
  for (const [x, z] of steamAt) {
    const key = x + ',' + z;
    if (seen.has(key)) continue;
    seen.add(key);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }));
      m.userData = { x, z, offset: i / 3, noShadow: true };
      scene.add(m); puffs.push(m);
    }
  }
}

function finishSetup() {
  scene.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
  });
  drops.forEach((d, i) => {
    d.userData.baseY = d.position.y;
    d.userData.dropDelay = 0.35 + i * 0.08;
    d.position.y = d.userData.baseY + 6;
  });
}

// ------------------------------------------------------------ etkileşim
let t0 = performance.now();
let lastInput = 0;
let down = null;
const ray = new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
  const quick = performance.now() - down.t < 350;
  down = null;
  if (moved > 8 || !quick) return;
  ray.setFromCamera(new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1), camera);
  const hits = ray.intersectObjects(persons, true);
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
function frame() {
  const now = performance.now();
  const t = (now - t0) / 1000;

  // giriş: kamera yukarıdan süzülerek yerine gelir, sonra parmak kontrolü açılır
  if (!controls.enabled) {
    const k = easeOutCubic(Math.min(1, t / 1.9));
    const start = sph(30 * fit, 0.2, 1.7);
    camera.position.lerpVectors(start, camEnd, k);
    camera.lookAt(target);
    if (k >= 1) { controls.enabled = true; controls.update(); lastInput = now - 2000; }
  } else {
    // bir süre dokunulmazsa sahne yavaşça sağa sola salınır
    if (now - lastInput > 3500) {
      const az = controls.getAzimuthalAngle();
      if (az > 1.45) swayDir = -1; else if (az < 0.15) swayDir = 1;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35 * swayDir;
    }
    controls.update();
  }

  for (const d of drops) {
    const k = clamp01((t - d.userData.dropDelay) / 0.85);
    d.position.y = d.userData.baseY + (1 - easeOutBounce(k)) * 6;
  }
  for (const p of sways) p.rotation.z = Math.sin(t * 1.2 + p.userData.sway) * 0.03;
  for (const l of lamps) l.rotation.z = Math.sin(t * 0.9 + l.userData.phase) * 0.04;

  for (const p of persons) {
    const u = p.userData;
    const k = clamp01((t - u.delay) / 0.4);
    const pop = k === 0 ? 0.001 : k * (1 + Math.sin(k * Math.PI) * 0.25 * (1 - k));
    p.scale.setScalar(Math.max(0.001, pop));
    const j = (t - u.jumpAt) / 0.6;
    const inJump = j >= 0 && j <= 1;
    p.position.y = (inJump ? Math.sin(j * Math.PI) * 0.55 : 0) + (u.pose === 'stand' ? Math.abs(Math.sin(t * 1.4 + u.phase)) * 0.02 : 0);
    p.rotation.y = u.baseRy + (inJump ? j * Math.PI * 2 : 0);
    u.head.rotation.y = Math.sin(t * 0.6 + u.phase) * 0.45;
    if (u.pose === 'seat') {
      const sip = Math.max(0, Math.sin(t * 0.7 + u.phase) - 0.6) / 0.4;
      u.arms[1].rotation.x = -0.9 - sip * 1.2;
    } else if (u.pose === 'barista') {
      p.position.x = -2.0 + Math.sin(t * 0.45) * 1.1;
      u.arms[0].rotation.x = -0.6 + Math.sin(t * 3) * 0.25;
      u.arms[1].rotation.x = -0.6 - Math.sin(t * 3) * 0.25;
    } else {
      u.arms[0].rotation.z = Math.sin(t * 1.4 + u.phase) * 0.06;
    }
  }
  for (const m of puffs) {
    const c = ((t * 0.45 + m.userData.offset) % 1 + 1) % 1;
    m.position.set(m.userData.x + Math.sin(c * 6 + m.userData.x) * 0.06, 0.96 + c * 0.7, m.userData.z);
    m.scale.setScalar(0.6 + c * 1.4);
    m.material.opacity = t < 2.2 ? 0 : 0.45 * Math.sin(c * Math.PI);
  }

  renderer.render(scene, camera);
  if (!sentReady) { sentReady = true; post({ type: 'ready' }); }
}

async function start() {
  if (P.modelUrl) {
    try { await loadModel(P.modelUrl); } catch (e) { post({ type: 'notice', message: 'Kafe modeli yüklenemedi, örnek kafe gösteriliyor.' }); buildSampleCafe(); }
  } else {
    buildSampleCafe();
  }
  placePeople();
  finishSetup();
  t0 = performance.now();
  renderer.setAnimationLoop(frame);
}
start();
`;
